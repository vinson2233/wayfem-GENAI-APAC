import json
import logging
import traceback
from datetime import datetime, timezone
from typing import Optional

from langchain_google_genai import ChatGoogleGenerativeAI
from langchain_core.messages import HumanMessage, SystemMessage

from config import settings
from models.safety import SafetyReport, ThreatLevel, NearbyPlace, RecentIncident, CrisisContact
from events import get_emitter

logger = logging.getLogger(__name__)

SYSTEM_PROMPT = """You are the SafeHer Safety Intelligence Agent. Your job is to analyze safety
conditions for women traveling solo to a given destination. You will receive numbered search results,
each with a title, snippet, and a full URL on the "Source:" line.

Analyze these results and return a JSON safety report with these exact fields:
- threat_level: "LOW" | "MEDIUM" | "HIGH" | "CRITICAL"
- flags: array of specific safety concerns for women (each flag should be a concise sentence)
- flag_sources: array of full URLs paired 1:1 with flags — MUST be the exact full URL from the
  "Source:" line of the search result that supports each flag (e.g. "https://travel.state.gov/content/travel/en/traveladvisories/...").
  Never use a homepage URL like "https://travel.state.gov" alone — always use the full article URL.
  If no URL matches, use the most relevant Source URL from any result.
- night_safety: boolean (is it safe to walk alone at night?)
- transportation_safe: boolean (are taxis/rideshares safe?)
- local_laws_notes: string (any laws affecting women: dress codes, restrictions)
- emergency_number: string. Extract ONLY from results marked "[OFFICIAL SOURCE]" (Wikipedia / .gov).
  Format: "<police> police · <ambulance> ambulance · <fire> fire" (omit any service whose number is not stated).
  Example: "122 police · 123 ambulance · 180 fire". If NO official source provides numbers, return "unknown" — DO NOT guess.
- overall_score: float 0-10 (10 = completely safe)
- summary: string (2-3 sentence summary for the traveler)
- cultural_notes: array of 3-5 practical cultural etiquette tips specific to women (e.g. dress expectations,
  interactions with men, photography norms, tipping customs). Be concrete and actionable.
- local_safe_phrases: object mapping useful local-language phrases to their meaning and context.
  Include 4-6 phrases a solo female traveler might need: help phrases, polite refusals, taxi confirmations,
  medical requests. Format: { "phrase in local script or romanized": "English meaning + when to use" }
  Example: { "Bırakın beni!": "Leave me alone! — use if harassed" }
- women_health_notes: string covering practical health logistics for women: tampon/pad availability,
  24h pharmacy presence, women-only clinics or hospitals, any relevant health insurance note.
  Keep it factual and 2-3 sentences.
- recent_incidents: array of dated, sourced safety events from the last ~30 days. Pull ONLY from
  results marked "[RECENT]". Each entry: { "date": "<YYYY-MM-DD or relative like '3 days ago'>",
  "summary": "<one sentence>", "source_url": "<full URL from the Source: line>",
  "severity": "info" | "caution" | "alert" }. Empty array if no real recent items in the data.
  NEVER fabricate dates — use what the snippet shows or the literal "recent".
- crisis_contacts: array of women-focused emergency resources. Pull ONLY from results marked
  "[CRISIS]". Each entry: { "label": "<short name>", "kind": "women_crisis" | "sexual_assault"
  | "tourist_police" | "embassy" | "other", "phone": "<number or null>",
  "website": "<url or null>", "notes": "<short note or null>" }. Maximum 5 entries. Empty
  array if results don't contain real hotlines.

Be specific and accurate. Base your assessment on the provided search results. Return ONLY valid JSON."""



def _fallback_safety_report(destination_id: str, city: str, country: str) -> SafetyReport:
    return SafetyReport(
        destination_id=destination_id,
        country=country,
        city=city,
        threat_level=ThreatLevel.MEDIUM,
        last_updated=datetime.now(timezone.utc),
        flags=["Safety data unavailable — exercise standard caution"],
        night_safety=False,
        transportation_safe=True,
        local_laws_notes="Research local laws before traveling.",
        emergency_number="112",
        overall_score=5.0,
        summary=(
            "Safety information could not be retrieved at this time. "
            "Please consult official travel advisories before your trip. "
            "Standard solo travel precautions are recommended."
        ),
    )


async def run_safety_agent(
    destination: str,
    destination_id: str,
    city: str,
    country: str,
    search_results: list[dict],
    area_safety: Optional[dict] = None,
) -> SafetyReport:
    emitter = get_emitter()
    try:
        if emitter:
            emitter.emit("safety", f"Analyzing {len(search_results)} search results…")
            emitter.emit("safety", "Running threat analysis with Gemini…")

        def _tag(r: dict) -> str:
            tags = []
            if r.get("_emergency_source"):
                tags.append("[OFFICIAL SOURCE]")
            if r.get("_recent_incidents"):
                tags.append("[RECENT]")
            if r.get("_crisis_directory"):
                tags.append("[CRISIS]")
            return (" " + " ".join(tags)) if tags else ""

        results_text = "\n\n".join(
            f"[{i+1}]{_tag(r)} {r.get('title','')}\n"
            f"{r.get('snippet','')}\n"
            f"{('Date: ' + r['date'] + chr(10)) if r.get('date') else ''}"
            f"Source: {r.get('link','')}"
            for i, r in enumerate(search_results)
        )

        human_content = (
            f"Destination: {destination}\n\n"
            f"Search Results:\n{results_text}\n\n"
            "Analyze these results and return the JSON safety report."
        )

        # Larger budget — recent_incidents + crisis_contacts add significant output
        llm = ChatGoogleGenerativeAI(google_api_key=settings.GEMINI_API_KEY, model="gemini-3-flash-preview", temperature=0.1, max_tokens=6144)
        messages = [
            SystemMessage(content=SYSTEM_PROMPT),
            HumanMessage(content=human_content),
        ]

        response = await llm.ainvoke(messages)
        raw = (response.content if isinstance(response.content, str) else response.content[0].get("text", "") if isinstance(response.content, list) else str(response.content)).strip()

        if raw.startswith("```"):
            raw = raw.split("```")[1]
            if raw.startswith("json"):
                raw = raw[4:]
            raw = raw.strip()

        data = json.loads(raw)

        # Build a list of actual article URLs from search results for fallback matching
        result_urls = [r.get("link", "") for r in search_results if r.get("link", "").startswith("http")]

        # Normalize flag_sources: if LLM returned a bare domain instead of a full article URL,
        # find the best matching actual URL from search results
        raw_sources = data.get("flag_sources", [])
        normalized_sources = []
        for src in raw_sources:
            src = (src or "").strip()
            if src.startswith("http") and len(src) > 20:
                # Already a full URL — use as-is
                normalized_sources.append(src)
            else:
                # LLM returned a domain name or source label — find matching article URL
                src_lower = src.lower().replace("https://", "").replace("http://", "").split("/")[0]
                matched = next(
                    (url for url in result_urls if src_lower and src_lower in url.lower()),
                    None
                )
                if matched:
                    normalized_sources.append(matched)
                elif result_urls:
                    # Fallback: use the first search result URL rather than a bare homepage
                    normalized_sources.append(result_urls[0])
                else:
                    # Last resort: construct a URL from domain if it looks like one
                    if "." in src and " " not in src:
                        normalized_sources.append(f"https://{src}")
                    else:
                        normalized_sources.append(src)

        threat = data.get("threat_level", "MEDIUM")
        score = data.get("overall_score", 5.0)
        n_flags = len(data.get("flags", []))
        logger.info(f"Safety agent for '{destination}': threat={threat}, flags={n_flags}, sources={normalized_sources}")
        if emitter:
            emitter.emit("safety", f"Threat level: {threat} · Score: {score}/10 · {n_flags} flag(s)")
            emitter.agent_complete("safety", f"Threat: {threat} · {score}/10")

        # Build nearest police/hospital from area_safety if present
        def _to_nearby(p: Optional[dict]) -> Optional[NearbyPlace]:
            if not p or not p.get("name"):
                return None
            return NearbyPlace(
                name=p.get("name", ""),
                address=p.get("address", ""),
                place_id=p.get("place_id"),
                distance_meters=p.get("distance_meters"),
            )

        nearest_police = _to_nearby((area_safety or {}).get("nearest_police_place"))
        nearest_hospital = _to_nearby((area_safety or {}).get("nearest_hospital_place"))

        # Parse recent incidents — keep only those with a real source URL
        recent_incidents: list[RecentIncident] = []
        for inc in (data.get("recent_incidents") or [])[:6]:
            if not isinstance(inc, dict):
                continue
            url = (inc.get("source_url") or "").strip()
            summary = (inc.get("summary") or "").strip()
            if not (url.startswith("http") and summary):
                continue
            severity = inc.get("severity", "info")
            if severity not in ("info", "caution", "alert"):
                severity = "info"
            recent_incidents.append(RecentIncident(
                date=(inc.get("date") or "recent").strip(),
                summary=summary,
                source_url=url,
                severity=severity,
            ))

        # Parse crisis contacts — must have a phone OR website to be useful
        crisis_contacts: list[CrisisContact] = []
        for c in (data.get("crisis_contacts") or [])[:6]:
            if not isinstance(c, dict):
                continue
            label = (c.get("label") or "").strip()
            phone = (c.get("phone") or "").strip() or None
            website = (c.get("website") or "").strip() or None
            if not label or (not phone and not website):
                continue
            kind = c.get("kind", "other")
            if kind not in ("women_crisis", "sexual_assault", "tourist_police", "embassy", "other"):
                kind = "other"
            crisis_contacts.append(CrisisContact(
                label=label,
                kind=kind,
                phone=phone,
                website=website,
                notes=(c.get("notes") or None),
            ))

        return SafetyReport(
            destination_id=destination_id,
            country=country,
            city=city,
            threat_level=ThreatLevel(data.get("threat_level", "MEDIUM")),
            last_updated=datetime.now(timezone.utc),
            flags=data.get("flags", []),
            flag_sources=normalized_sources,
            night_safety=bool(data.get("night_safety", False)),
            transportation_safe=bool(data.get("transportation_safe", True)),
            local_laws_notes=data.get("local_laws_notes", ""),
            emergency_number=data.get("emergency_number") or "unknown",
            overall_score=float(data.get("overall_score", 5.0)),
            summary=data.get("summary", ""),
            cultural_notes=data.get("cultural_notes", []),
            local_safe_phrases=data.get("local_safe_phrases", {}),
            women_health_notes=data.get("women_health_notes", ""),
            nearest_police=nearest_police,
            nearest_hospital=nearest_hospital,
            recent_incidents=recent_incidents,
            crisis_contacts=crisis_contacts,
        )

    except Exception as e:
        logger.error(f"Safety agent error for '{destination}': {e}\n{traceback.format_exc()}")
        return _fallback_safety_report(destination_id, city, country)
