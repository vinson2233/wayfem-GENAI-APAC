import json
import logging
import re

from langchain_google_genai import ChatGoogleGenerativeAI
from langchain_core.messages import HumanMessage, SystemMessage

from config import settings
from models.hotel import Hotel
from events import get_emitter

logger = logging.getLogger(__name__)

SYSTEM_PROMPT = """You are the SafeHer Accommodation Agent. Your job is to analyze hotels for 
women traveling solo and compute a Female Friendliness Index (FFI) score (0-10) for each hotel.

FFI Calculation weights:
- Solo female positive reviews: 35%
- Area safety score (provided): 25%
- Security features (locks, cameras, 24hr desk, safe, keycard): 20%
- Female staff/ownership: 10%
- Emergency proximity (hospital, police): 10%

For each hotel, analyze the available reviews and details and return a JSON array where each item has:
- place_id: string
- female_friendliness_score: float (0-10, the FFI)
- solo_female_reviews_count: int (number of solo female travel mentions)
- positive_mentions: array of strings (safety/comfort positives)
- negative_mentions: array of strings (safety/comfort negatives)
- owner_female: boolean or null (if detectable from reviews)
- security_features: array of strings (detected security features)

Return ONLY a valid JSON array. Be thorough in reviewing for mentions of: solo female, woman alone, 
harassment, safety, lighting, lock quality, all-female dorms, female staff, secure storage."""



def _build_fallback_hotel(raw: dict, destination_id: str, area_safety: dict) -> Hotel:
    return Hotel(
        place_id=raw.get("place_id", "unknown"),
        name=raw.get("name", "Unknown Hotel"),
        destination_id=destination_id,
        search_city=raw.get("search_city"),
        female_friendliness_score=5.0,
        solo_female_reviews_count=0,
        positive_mentions=[],
        negative_mentions=[],
        owner_female=None,
        area_safety_score=area_safety.get("area_safety_score", 5.0),
        security_features=[],
        price_per_night=None,
        currency="USD",
        address=raw.get("address", raw.get("formatted_address", "")),
        rating=float(raw.get("rating", 0.0)),
        image_url=None,
        booking_url=None,
    )


async def run_accommodation_agent(
    destination: str,
    destination_id: str,
    hotels_raw: list[dict],
    review_results: list[dict],
    area_safety: dict,
) -> list[Hotel]:
    emitter = get_emitter()
    if not hotels_raw:
        if emitter:
            emitter.emit("accommodation", "No hotels found for this destination")
            emitter.agent_complete("accommodation", "No hotels found")
        return []

    try:
        if emitter:
            emitter.emit("accommodation", f"Computing Female Friendliness Index for {len(hotels_raw)} hotels…")
        hotels_summary = []
        for hotel in hotels_raw:
            details = hotel.get("details", {})
            reviews = details.get("reviews", [])
            review_texts = [r.get("text", "") for r in reviews[:10]]
            hotels_summary.append({
                "place_id": hotel.get("place_id", ""),
                "name": hotel.get("name", ""),
                "rating": hotel.get("rating", 0.0),
                "address": hotel.get("address", hotel.get("formatted_address", "")),
                "reviews": review_texts,
                "types": hotel.get("types", []),
            })

        search_snippets = "\n".join(
            f"- {r.get('title','')}: {r.get('snippet','')}"
            for r in review_results[:15]
        )

        human_content = (
            f"Destination: {destination}\n"
            f"Area Safety Score: {area_safety.get('area_safety_score', 5.0)}/10\n"
            f"Nearest Hospital: {area_safety.get('nearest_hospital_m', 'unknown')}m\n"
            f"Nearest Police: {area_safety.get('nearest_police_m', 'unknown')}m\n\n"
            f"Hotels to analyze:\n{json.dumps(hotels_summary, indent=2)}\n\n"
            f"Additional Web Review Data:\n{search_snippets}\n\n"
            "Analyze each hotel and return the JSON array with FFI scores."
        )

        if emitter:
            emitter.emit("accommodation", "Scoring solo female reviews with Gemini…")
        # Multi-city searches can produce 20-30 hotels — bump tokens to avoid truncation
        llm = ChatGoogleGenerativeAI(google_api_key=settings.GEMINI_API_KEY, model="gemini-3-flash-preview", temperature=0.1, max_output_tokens=12288)
        messages = [
            SystemMessage(content=SYSTEM_PROMPT),
            HumanMessage(content=human_content),
        ]

        response = await llm.ainvoke(messages)
        # Robust extraction across str / list[dict] / list[block] formats
        content = response.content
        if isinstance(content, str):
            raw_text = content
        elif isinstance(content, list):
            parts: list[str] = []
            for item in content:
                if isinstance(item, dict):
                    parts.append(item.get("text", ""))
                elif hasattr(item, "text"):
                    parts.append(getattr(item, "text", ""))
            raw_text = "".join(parts)
        else:
            raw_text = str(content)
        raw_text = raw_text.strip()

        if raw_text.startswith("```"):
            raw_text = raw_text.split("```")[1]
            if raw_text.startswith("json"):
                raw_text = raw_text[4:]
            raw_text = raw_text.strip()

        # Strip trailing commas — Gemini sometimes emits JS-style JSON
        raw_text = re.sub(r',\s*([}\]])', r'\1', raw_text)

        # Try strict parse first; if that fails (truncation, partial JSON), salvage
        # whatever hotel objects we can so we don't lose the entire batch.
        try:
            scored_hotels = json.loads(raw_text)
        except json.JSONDecodeError as je:
            logger.warning(
                f"Accommodation JSON malformed ({je}); attempting to salvage objects from partial response"
            )
            scored_hotels = []
            # Find balanced {...} substrings and try to parse each one independently
            depth = 0
            start = -1
            for i, ch in enumerate(raw_text):
                if ch == "{":
                    if depth == 0:
                        start = i
                    depth += 1
                elif ch == "}":
                    depth -= 1
                    if depth == 0 and start >= 0:
                        chunk = raw_text[start : i + 1]
                        try:
                            scored_hotels.append(json.loads(chunk))
                        except json.JSONDecodeError:
                            pass
                        start = -1
            if emitter:
                emitter.emit("accommodation", f"Recovered {len(scored_hotels)} hotels from partial response")

        scored_map = {h["place_id"]: h for h in scored_hotels if isinstance(h, dict) and h.get("place_id")}

        result_hotels = []
        for raw_hotel in hotels_raw:
            place_id = raw_hotel.get("place_id", "")
            details = raw_hotel.get("details", {})
            scored = scored_map.get(place_id, {})

            photo_url = None
            if details.get("photos"):
                photo_ref = details["photos"][0].get("photo_reference")
                if photo_ref:
                    photo_url = (
                        f"https://maps.googleapis.com/maps/api/place/photo"
                        f"?maxwidth=800&photoreference={photo_ref}"
                        f"&key={settings.GOOGLE_MAPS_API_KEY}"
                    )

            ffi = float(scored.get("female_friendliness_score", 5.0))

            hotel = Hotel(
                place_id=place_id,
                name=raw_hotel.get("name", details.get("name", "")),
                destination_id=destination_id,
                search_city=raw_hotel.get("search_city"),
                female_friendliness_score=round(ffi, 1),
                solo_female_reviews_count=int(scored.get("solo_female_reviews_count", 0)),
                positive_mentions=scored.get("positive_mentions", []),
                negative_mentions=scored.get("negative_mentions", []),
                owner_female=scored.get("owner_female"),
                area_safety_score=area_safety.get("area_safety_score", 5.0),
                security_features=scored.get("security_features", []),
                price_per_night=None,
                currency="USD",
                address=details.get("formatted_address", raw_hotel.get("address", "")),
                rating=float(raw_hotel.get("rating", details.get("rating", 0.0))),
                image_url=photo_url,
                booking_url=details.get("website"),
            )
            result_hotels.append(hotel)

        result_hotels.sort(key=lambda h: h.female_friendliness_score, reverse=True)

        passing = [h for h in result_hotels if h.female_friendliness_score >= 4.0]
        top = passing if passing else result_hotels
        if emitter and top:
            top_score = top[0].female_friendliness_score
            emitter.emit("accommodation", f"Top hotel FFI: {top_score}/10 · {len(top)} recommended")
            emitter.agent_complete("accommodation", f"{len(top)} hotels · top FFI {top_score}/10")
        return top

    except Exception as e:
        logger.error(f"Accommodation agent error for '{destination}': {e}")
        if emitter:
            emitter.agent_complete("accommodation", "Fallback scores used")
        return [_build_fallback_hotel(h, destination_id, area_safety) for h in hotels_raw]
