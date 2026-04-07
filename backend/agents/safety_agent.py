import json
import logging
import traceback
from datetime import datetime, timezone

from langchain_google_genai import ChatGoogleGenerativeAI
from langchain_core.messages import HumanMessage, SystemMessage

from config import settings
from models.safety import SafetyReport, ThreatLevel

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
- emergency_number: string (local emergency number)
- overall_score: float 0-10 (10 = completely safe)
- summary: string (2-3 sentence summary for the traveler)

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
) -> SafetyReport:
    try:
        results_text = "\n\n".join(
            f"[{i+1}] {r.get('title','')}\n{r.get('snippet','')}\nSource: {r.get('link','')}"
            for i, r in enumerate(search_results)
        )

        human_content = (
            f"Destination: {destination}\n\n"
            f"Search Results:\n{results_text}\n\n"
            "Analyze these results and return the JSON safety report."
        )

        llm = ChatGoogleGenerativeAI(google_api_key=settings.GEMINI_API_KEY, model="gemini-3.1-flash-lite-preview", temperature=0.1, max_tokens=2048)
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

        logger.info(f"Safety agent for '{destination}': threat={data.get('threat_level')}, flags={len(data.get('flags', []))}, sources={normalized_sources}")

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
            emergency_number=data.get("emergency_number", "112"),
            overall_score=float(data.get("overall_score", 5.0)),
            summary=data.get("summary", ""),
        )

    except Exception as e:
        logger.error(f"Safety agent error for '{destination}': {e}\n{traceback.format_exc()}")
        return _fallback_safety_report(destination_id, city, country)
