import json
import logging

from langchain_google_genai import ChatGoogleGenerativeAI
from langchain_core.messages import HumanMessage, SystemMessage

from config import settings
from models.hotel import Hotel

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
    if not hotels_raw:
        return []

    try:
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

        llm = ChatGoogleGenerativeAI(google_api_key=settings.GEMINI_API_KEY, model="gemini-3.1-flash-lite-preview", temperature=0.1, max_tokens=4096)
        messages = [
            SystemMessage(content=SYSTEM_PROMPT),
            HumanMessage(content=human_content),
        ]

        response = await llm.ainvoke(messages)
        raw_text = (response.content if isinstance(response.content, str) else response.content[0].get("text", "") if isinstance(response.content, list) else str(response.content)).strip()

        if raw_text.startswith("```"):
            raw_text = raw_text.split("```")[1]
            if raw_text.startswith("json"):
                raw_text = raw_text[4:]
            raw_text = raw_text.strip()

        scored_hotels = json.loads(raw_text)

        scored_map = {h["place_id"]: h for h in scored_hotels if isinstance(h, dict)}

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
        if passing:
            return passing
        return result_hotels

    except Exception as e:
        logger.error(f"Accommodation agent error for '{destination}': {e}")
        return [_build_fallback_hotel(h, destination_id, area_safety) for h in hotels_raw]
