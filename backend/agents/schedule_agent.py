import json
import logging
from typing import Optional, Any
from datetime import datetime, timedelta

from langchain_google_genai import ChatGoogleGenerativeAI
from langchain_core.messages import HumanMessage, SystemMessage

from config import settings
from models.safety import SafetyReport, ThreatLevel
from models.itinerary import ItineraryDay, ItineraryItem

logger = logging.getLogger(__name__)

SYSTEM_PROMPT = """You are the SafeHer Schedule Agent. Your job is to create a safe, detailed 
day-by-day travel itinerary for a solo female traveler.

Safety curfew rules you MUST follow:
- CRITICAL or HIGH threat level: no solo walking or outdoor activities after 21:00 (9pm)
- MEDIUM threat level: no solo walking or outdoor activities after 22:00 (10pm)
- LOW threat level: no solo walking or outdoor activities after 23:00 (11pm)

For each day, include:
- A mix of cultural, culinary, and leisure activities
- Activities that are known to be solo-female-friendly
- Safety notes for any activity that needs extra caution
- Flag (is_flagged: true) any activity with elevated risk
- A "safe_return_time" (the latest recommended return time to hotel that evening)
- A daily safety tip specific to that day's activities

Return a JSON array of days, each with this structure:
{
  "date": "YYYY-MM-DD",
  "day_number": 1,
  "safe_return_time": "21:00",
  "daily_safety_tip": "string",
  "items": [
    {
      "time": "09:00",
      "activity": "string",
      "location": "string",
      "description": "1-2 sentences explaining why this place is interesting and what to expect",
      "image_query": "short keyword for image search, e.g. 'thai temple Bangkok' or 'street food market'",
      "safety_note": "string or null",
      "is_flagged": false
    }
  ]
}

Return ONLY valid JSON array."""



def _get_curfew_time(threat_level: ThreatLevel) -> str:
    if threat_level in (ThreatLevel.CRITICAL, ThreatLevel.HIGH):
        return "21:00"
    elif threat_level == ThreatLevel.MEDIUM:
        return "22:00"
    return "23:00"


def _generate_date_range(start_date: str, end_date: str) -> list[str]:
    start = datetime.strptime(start_date, "%Y-%m-%d")
    end = datetime.strptime(end_date, "%Y-%m-%d")
    dates = []
    current = start
    while current <= end:
        dates.append(current.strftime("%Y-%m-%d"))
        current += timedelta(days=1)
    return dates


def _fallback_itinerary(start_date: str, end_date: str, destination: str, threat_level: ThreatLevel) -> list[ItineraryDay]:
    dates = _generate_date_range(start_date, end_date)
    curfew = _get_curfew_time(threat_level)
    days = []
    for i, date in enumerate(dates):
        days.append(ItineraryDay(
            date=date,
            day_number=i + 1,
            safe_return_time=curfew,
            daily_safety_tip=f"Stay aware of your surroundings in {destination} and keep emergency contacts handy.",
            items=[
                ItineraryItem(
                    time="09:00",
                    activity="Explore local area",
                    location=destination,
                    safety_note="Stay in well-lit, populated areas.",
                    is_flagged=False,
                ),
                ItineraryItem(
                    time="13:00",
                    activity="Lunch at a recommended local restaurant",
                    location=destination,
                    safety_note=None,
                    is_flagged=False,
                ),
                ItineraryItem(
                    time="15:00",
                    activity="Visit local attractions",
                    location=destination,
                    safety_note="Check opening hours in advance.",
                    is_flagged=False,
                ),
            ],
        ))
    return days


async def run_schedule_agent(
    destination: str,
    trip_id: str,
    start_date: str,
    end_date: str,
    safety_report: SafetyReport,
    emergency_contact: Optional[str],
) -> tuple[list[ItineraryDay], Optional[str]]:
    try:
        dates = _generate_date_range(start_date, end_date)
        curfew = _get_curfew_time(safety_report.threat_level)

        human_content = (
            f"Destination: {destination}\n"
            f"Dates: {start_date} to {end_date} ({len(dates)} days)\n"
            f"Threat Level: {safety_report.threat_level.value}\n"
            f"Curfew Time: {curfew} (no outdoor solo activities after this time)\n"
            f"Safety Flags: {', '.join(safety_report.flags) if safety_report.flags else 'None'}\n"
            f"Night Safety: {'Yes' if safety_report.night_safety else 'No'}\n"
            f"Transportation Safe: {'Yes' if safety_report.transportation_safe else 'No'}\n"
            f"Local Laws: {safety_report.local_laws_notes}\n\n"
            f"Days to plan: {json.dumps(dates)}\n\n"
            "Create a complete day-by-day itinerary following all safety rules. "
            "Include at least 4-6 activities per day with appropriate safety notes."
        )

        llm = ChatGoogleGenerativeAI(google_api_key=settings.GEMINI_API_KEY, model="gemini-3.1-flash-lite-preview", temperature=0.3, max_tokens=8192)
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

        days_data = json.loads(raw)
        itinerary_days = []

        for day_data in days_data:
            items = [
                ItineraryItem(
                    time=item.get("time", "09:00"),
                    activity=item.get("activity", ""),
                    location=item.get("location", destination),
                    description=item.get("description"),
                    image_query=item.get("image_query"),
                    safety_note=item.get("safety_note"),
                    is_flagged=bool(item.get("is_flagged", False)),
                )
                for item in day_data.get("items", [])
            ]
            itinerary_days.append(
                ItineraryDay(
                    date=day_data.get("date", ""),
                    day_number=int(day_data.get("day_number", 1)),
                    items=items,
                    safe_return_time=day_data.get("safe_return_time", curfew),
                    daily_safety_tip=day_data.get("daily_safety_tip", "Stay safe and aware."),
                )
            )

        calendar_id = None
        try:
            from mcp_client import get_calendar_mcp_client
            async with get_calendar_mcp_client() as client:
                tools = await client.get_tools()
                cal_tool = next((t for t in tools if t.name == "create_itinerary_calendar"), None)
                if cal_tool:
                    itinerary_json = json.dumps([d.model_dump() for d in itinerary_days], default=str)
                    raw = await cal_tool.ainvoke({
                        "trip_id": trip_id,
                        "itinerary_json": itinerary_json,
                        "emergency_contact": emergency_contact or "",
                    })
                    # MCP may return list of content blocks
                    text = raw if isinstance(raw, str) else (raw[0].get("text", "") if isinstance(raw, list) and raw else str(raw))
                    result = json.loads(text.strip()) if text.strip() else {}
                    calendar_id = result.get("calendar_id")
        except Exception as cal_err:
            logger.warning(f"Calendar MCP call failed (non-fatal): {cal_err}")

        return itinerary_days, calendar_id

    except Exception as e:
        logger.error(f"Schedule agent error for '{destination}': {e}")
        fallback = _fallback_itinerary(start_date, end_date, destination, safety_report.threat_level)
        return fallback, None
