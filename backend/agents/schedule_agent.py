import asyncio
import json
import logging
import re
from typing import Optional, Any
from datetime import datetime, timedelta

from langchain_google_genai import ChatGoogleGenerativeAI
from langchain_core.messages import HumanMessage, SystemMessage

from config import settings
from models.safety import SafetyReport, ThreatLevel
from models.itinerary import ItineraryDay, ItineraryItem, NightTransportPlan, TransportOption
from tools.maps_tool import get_distance_matrix, geocode_place_id, get_pairwise_transport
from events import get_emitter

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
- Realistic travel times between activities — schedule times so they account for travel between locations

Set "travel_time_minutes" to null for all items — travel times will be calculated separately via
the Maps API after the itinerary is generated.

Return a JSON array of days, each with this structure:
{
  "date": "YYYY-MM-DD",
  "day_number": 1,
  "safe_return_time": "21:00",
  "daily_safety_tip": "string",
  "day_summary": "2-3 sentence narrative describing the overall vibe, theme, and flow of this day — e.g. what neighbourhoods you'll wander, what kind of energy the day has, and one specific thing to look forward to. Write in second person, warm and evocative.",
  "items": [
    {
      "time": "09:00",
      "activity": "string",
      "location": "string",
      "description": "REQUIRED. 3-4 sentences: what makes this place special, what you'll see/taste/experience, any insider tips specific to this venue, and why it is great for a solo female traveler. Never null.",
      "image_query": "2-4 specific keywords for image search — be specific, e.g. 'Hagia Sophia interior Istanbul' or 'Chiang Mai night bazaar street food'. Include the city name.",
      "safety_note": "string or null",
      "is_flagged": false,
      "travel_time_minutes": null,
      "estimated_cost": 35000,
      "cost_currency": "IDR",
      "alternatives": [
        {
          "time": "09:00",
          "activity": "alternative activity name",
          "location": "alternative location",
          "description": "why you might prefer this instead",
          "image_query": "short keyword",
          "safety_note": null,
          "is_flagged": false,
          "travel_time_minutes": null,
          "estimated_cost": 30000,
          "cost_currency": "IDR"
        }
      ]
    }
  ],
  "night_transport": {
    "mode": "rideshare_app",
    "app_name": "Grab",
    "estimated_cost": "฿80–120",
    "safety_tip": "Book via app before leaving the venue so you have a confirmed driver. Share your ride status with a contact.",
    "avoid": "Unlicensed taxis approaching you outside the venue"
  }
}

For "night_transport":
- mode must be one of: "rideshare_app", "metro", "taxi", "walking", "tuk_tuk", "bus", "ferry", "tram"
- app_name: the specific local app (Grab, Bolt, Uber, Careem, Ola, etc.) or null if not applicable
- estimated_cost: realistic local currency range for the journey back to a central hotel, or "free" for metro/walking
- safety_tip: one concrete, specific piece of advice for this exact return journey at night in this city
- avoid: what to avoid specifically (unlicensed operators, certain routes, etc.) or null

For "alternatives":
- For cultural, museum, restaurant, food market, and gallery activities, include exactly ONE alternative in the `alternatives` array — a different place the traveler could visit instead at the same time slot
- The alternative should have the same "time" as the parent item
- For hotel check-in/out, transport, and the last return-to-hotel slot, set "alternatives" to null
- Each alternative follows the same item schema but never has its own "alternatives" field

For "estimated_cost" + "cost_currency":
- Estimate per-person cost for THIS activity (entrance fees + a typical food/drink during it). NOT travel between activities.
- Use the LOCAL currency ISO code (IDR, THB, JPY, EUR, USD, etc.) — same code for every item in the trip.
- Free activities (parks, beaches, hotel check-in): set estimated_cost to 0.
- Use realistic mid-range values; don't over-pad. Round to a sensible whole number in local currency.
- If you genuinely cannot estimate (e.g. unknown private experience), set estimated_cost to null.

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


def _salvage_json_array(raw: str) -> list | None:
    """Recover complete top-level day objects from a truncated JSON array.

    Forward-scans for balanced { } pairs at depth-0 (i.e. each day object),
    strips trailing commas inside each chunk, and returns whatever parsed
    successfully. Same approach used by the accommodation agent.
    """
    results = []
    depth = 0
    start = -1
    for i, ch in enumerate(raw):
        if ch == '{':
            if depth == 0:
                start = i
            depth += 1
        elif ch == '}':
            depth -= 1
            if depth == 0 and start >= 0:
                chunk = raw[start:i + 1]
                chunk = re.sub(r',\s*([}\]])', r'\1', chunk)
                try:
                    obj = json.loads(chunk)
                    if isinstance(obj, dict):
                        results.append(obj)
                except json.JSONDecodeError:
                    pass
                start = -1
    return results if results else None


async def run_schedule_agent(
    destination: str,
    trip_id: str,
    start_date: str,
    end_date: str,
    safety_report: SafetyReport,
    emergency_contact: Optional[str],
    preferences: Optional[dict] = None,
    refinement_prompt: Optional[str] = None,
    current_itinerary: Optional[list[dict]] = None,
) -> tuple[list[ItineraryDay], Optional[str]]:
    emitter = get_emitter()
    try:
        dates = _generate_date_range(start_date, end_date)
        curfew = _get_curfew_time(safety_report.threat_level)
        prefs = preferences or {}

        if emitter:
            emitter.emit("schedule", f"Building {len(dates)}-day itinerary for {destination}…")
            emitter.emit("schedule", f"Safety curfew: {curfew} (threat: {safety_report.threat_level.value})")

        pref_lines = []
        if prefs.get("prefer_walking_transit"):
            pref_lines.append("User strongly prefers walking and public transport. Avoid recommending taxis unless safety requires it.")
        if prefs.get("no_taxis"):
            pref_lines.append("Do NOT suggest taxis or rideshare apps in this itinerary.")
        if prefs.get("female_only_accommodations"):
            pref_lines.append("Prioritize female-only accommodation options and female-friendly venues.")
        if prefs.get("avoid_nightlife"):
            pref_lines.append("Avoid nightlife districts, bars, and clubs entirely.")

        pace = prefs.get("pace", "balanced")
        if pace == "slow":
            pref_lines.append("Trip pace: SLOW. Plan 2-3 activities per day maximum. Include plenty of free time, long meals, and relaxed exploration. Avoid back-to-back scheduling.")
        elif pace == "packed":
            pref_lines.append("Trip pace: PACKED. Plan 5-7 activities per day. Maximise sights and experiences. Minimise downtime between stops.")
        else:
            pref_lines.append("Trip pace: BALANCED. Plan 4-5 activities per day mixing major sights with local moments.")

        comfort = prefs.get("comfort_level", "mid_range")
        if comfort == "budget":
            pref_lines.append("Comfort level: BUDGET. Prefer free attractions, street food, local markets, hostels, and cheap eats. Avoid expensive restaurants and paid tours when free alternatives exist.")
        elif comfort == "luxury":
            pref_lines.append("Comfort level: LUXURY. Recommend premium experiences: fine dining, private tours, high-end spas, rooftop venues, and top-rated attractions with skip-the-line options.")
        else:
            pref_lines.append("Comfort level: MID-RANGE. Mix of paid attractions, good restaurants, and some splurge experiences.")

        interests = prefs.get("interests", [])
        if interests:
            interest_map = {
                "culture": "cultural heritage, historical sites, local traditions",
                "food_&_drink": "food markets, restaurants, local cuisine, cooking experiences",
                "nature": "parks, gardens, scenic viewpoints, outdoor spaces",
                "shopping": "local markets, boutiques, shopping streets",
                "art_&_museums": "galleries, museums, street art, exhibitions",
                "wellness": "spas, yoga, meditation, wellness centres",
                "adventure": "active experiences, hiking, watersports, cycling",
                "photography": "photogenic spots, golden hour locations, scenic overlooks",
            }
            interest_labels = [interest_map.get(i, i.replace("_", " ")) for i in interests if i in interest_map]
            if interest_labels:
                pref_lines.append(f"User interests: {', '.join(interest_labels)}. Skew the itinerary heavily towards these themes.")

        transport_note = "\n".join(pref_lines)

        base_context = (
            f"Destination: {destination}\n"
            f"Dates: {start_date} to {end_date} ({len(dates)} days)\n"
            f"Threat Level: {safety_report.threat_level.value}\n"
            f"Curfew Time: {curfew} (no outdoor solo activities after this time)\n"
            f"Safety Flags: {', '.join(safety_report.flags) if safety_report.flags else 'None'}\n"
            f"Night Safety: {'Yes' if safety_report.night_safety else 'No'}\n"
            f"Transportation Safe: {'Yes' if safety_report.transportation_safe else 'No'}\n"
            f"Local Laws: {safety_report.local_laws_notes}\n"
            + (f"User Preferences:\n{transport_note}\n" if pref_lines else "")
        )

        if refinement_prompt and current_itinerary:
            human_content = (
                base_context
                + f"\nCurrent itinerary to modify:\n{json.dumps(current_itinerary, indent=2)}\n\n"
                f"User refinement request: {refinement_prompt}\n\n"
                "Modify the itinerary according to the user's request. Keep everything that was not asked to change. "
                "Maintain all safety rules and curfew times. Return the complete modified itinerary."
            )
        else:
            human_content = (
                base_context
                + f"\nDays to plan: {json.dumps(dates)}\n\n"
                "Create a complete day-by-day itinerary following all safety rules. "
                "Include at least 4-6 activities per day with appropriate safety notes."
            )

        if emitter:
            if refinement_prompt:
                emitter.emit("schedule", f"Refining itinerary: {refinement_prompt[:60]}…")
            else:
                active_prefs = [k for k, v in prefs.items() if v]
                if active_prefs:
                    emitter.emit("schedule", f"Applying preferences: {', '.join(active_prefs)}")
            emitter.emit("schedule", "Generating itinerary with Gemini…")
        llm = ChatGoogleGenerativeAI(google_api_key=settings.GEMINI_API_KEY, model="gemini-3-flash-preview", temperature=0.3, max_output_tokens=32768)
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

        # Strip trailing comma at EOF (truncated response) or before ] / }
        raw = raw.rstrip()
        if raw.endswith(','):
            raw = raw[:-1]
        raw = re.sub(r',\s*([}\]])', r'\1', raw)

        try:
            days_data = json.loads(raw)
        except json.JSONDecodeError as je:
            logger.error(f"Schedule agent JSON parse failed: {je}\nRaw response (first 2000 chars):\n{raw[:2000]}\n...last 500 chars:\n{raw[-500:]}")
            # Brace-walker salvage: truncated JSON often ends mid-string/mid-object.
            # Walk backwards to find the last complete day object and close the array.
            salvaged = _salvage_json_array(raw)
            if salvaged:
                logger.warning(f"Salvaged {len(salvaged)} day(s) from truncated response")
                days_data = salvaged
            else:
                raise
        itinerary_days = []

        def _parse_item(item: dict, include_alternatives: bool = True) -> ItineraryItem:
            alts = None
            if include_alternatives:
                raw_alts = item.get("alternatives") or []
                if raw_alts:
                    alts = [_parse_item(a, include_alternatives=False) for a in raw_alts]
            ec = item.get("estimated_cost")
            try:
                ec_val = float(ec) if ec is not None else None
            except (TypeError, ValueError):
                ec_val = None
            return ItineraryItem(
                time=item.get("time", "09:00"),
                activity=item.get("activity", ""),
                location=item.get("location", destination),
                place_id=item.get("place_id"),
                description=item.get("description"),
                image_query=item.get("image_query"),
                safety_note=item.get("safety_note"),
                is_flagged=bool(item.get("is_flagged", False)),
                travel_time_minutes=item.get("travel_time_minutes"),
                estimated_cost=ec_val,
                cost_currency=item.get("cost_currency"),
                alternatives=alts,
            )

        for day_data in days_data:
            items = [_parse_item(item) for item in day_data.get("items", [])]
            nt_data = day_data.get("night_transport")
            night_transport = None
            if isinstance(nt_data, dict) and nt_data.get("mode"):
                night_transport = NightTransportPlan(
                    mode=nt_data.get("mode", "taxi"),
                    app_name=nt_data.get("app_name") or None,
                    estimated_cost=nt_data.get("estimated_cost") or None,
                    safety_tip=nt_data.get("safety_tip", "Use a reputable app-based service."),
                    avoid=nt_data.get("avoid") or None,
                )

            # Sum item costs into daily total
            day_costs = [it.estimated_cost for it in items if it.estimated_cost is not None]
            daily_total = round(sum(day_costs)) if day_costs else None

            itinerary_days.append(
                ItineraryDay(
                    date=day_data.get("date", ""),
                    day_number=int(day_data.get("day_number", 1)),
                    items=items,
                    safe_return_time=day_data.get("safe_return_time", curfew),
                    daily_safety_tip=day_data.get("daily_safety_tip", "Stay safe and aware."),
                    day_summary=day_data.get("day_summary") or None,
                    night_transport=night_transport,
                    daily_cost_estimate=daily_total,
                )
            )

        if emitter:
            total_items = sum(len(d.items) for d in itinerary_days)
            emitter.emit("schedule", f"Itinerary built · {len(itinerary_days)} days · {total_items} activities")
            for d in itinerary_days:
                emitter.emit("schedule", f"Day {d.day_number}: {len(d.items)} activities · return by {d.safe_return_time}")

        # Enrich travel info: mode + duration + cost hint between consecutive items
        try:
            if emitter:
                emitter.emit("schedule", "Picking transport mode for each leg via Google Maps…")
            loop = asyncio.get_event_loop()

            # Country-aware rideshare app suggestion (best-effort, infer from destination string)
            dest_lc = destination.lower()
            rideshare_app = None
            if any(c in dest_lc for c in ["indonesia", "bali", "jakarta", "yogyakarta", "vietnam", "thailand", "bangkok", "malaysia", "singapore", "philippines"]):
                rideshare_app = "Grab"
            elif any(c in dest_lc for c in ["india", "delhi", "mumbai"]):
                rideshare_app = "Uber/Ola"
            elif any(c in dest_lc for c in ["china", "beijing", "shanghai"]):
                rideshare_app = "DiDi"
            else:
                rideshare_app = "Uber"

            # Per-mode cost hints (very rough; keeps the UI useful even when we can't price by city)
            COST_HINTS = {
                "walking": "free",
                "transit": "~local fare",
                "driving": rideshare_app,
                "rideshare": rideshare_app,
            }
            SAFETY_HINTS = {
                "rideshare": f"Use {rideshare_app} app — verify driver name and plate before entering.",
                "driving": f"Use {rideshare_app} app rather than flagging street taxis.",
            }

            for day in itinerary_days:
                if len(day.items) < 2:
                    continue
                tasks = [
                    loop.run_in_executor(None, get_pairwise_transport, day.items[i].location, day.items[i + 1].location)
                    for i in range(len(day.items) - 1)
                ]
                results = await asyncio.gather(*tasks, return_exceptions=True)
                for i, res in enumerate(results):
                    if isinstance(res, dict) and res.get("duration_min") is not None:
                        mode = res["mode"]
                        opt = TransportOption(
                            mode=mode,
                            duration_min=res["duration_min"],
                            cost_estimate=COST_HINTS.get(mode),
                            app_name=rideshare_app if mode in ("rideshare", "driving") else None,
                            safety_note=SAFETY_HINTS.get(mode),
                        )
                        day.items[i] = day.items[i].model_copy(update={"transport_to_next": opt})
                        # Keep travel_time_minutes on destination item for backwards-compat rendering
                        day.items[i + 1] = day.items[i + 1].model_copy(update={"travel_time_minutes": res["duration_min"]})
            if emitter:
                emitter.emit("schedule", "Transport modes assigned ✓")
        except Exception as dm_err:
            logger.warning(f"Transport enrichment failed (non-fatal): {dm_err}")
            if emitter:
                emitter.emit("schedule", "Transport lookup unavailable · using estimates")

        # Enrich place_id for each activity (in parallel) so the UI can build Maps links
        try:
            loop = asyncio.get_event_loop()
            tasks: list[tuple[int, int, asyncio.Future]] = []
            for d_idx, day in enumerate(itinerary_days):
                for i_idx, item in enumerate(day.items):
                    if item.place_id:
                        continue
                    query = f"{item.activity} {item.location} {destination}".strip()
                    fut = loop.run_in_executor(None, geocode_place_id, query)
                    tasks.append((d_idx, i_idx, fut))
            if tasks:
                results = await asyncio.gather(*(t[2] for t in tasks), return_exceptions=True)
                hits = 0
                for (d_idx, i_idx, _), pid in zip(tasks, results):
                    if isinstance(pid, str) and pid:
                        day = itinerary_days[d_idx]
                        day.items[i_idx] = day.items[i_idx].model_copy(update={"place_id": pid})
                        hits += 1
                if emitter:
                    emitter.emit("schedule", f"Mapped {hits}/{len(tasks)} activities to Google Maps")
        except Exception as geo_err:
            logger.warning(f"place_id enrichment failed (non-fatal): {geo_err}")

        if emitter:
            emitter.agent_complete("schedule", f"{len(itinerary_days)} days · curfew {curfew}")

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
        logger.error(f"Schedule agent error for '{destination}': {e}", exc_info=True)
        if emitter:
            emitter.emit("schedule", f"⚠ Schedule agent error — using fallback: {type(e).__name__}: {e}")
        fallback = _fallback_itinerary(start_date, end_date, destination, safety_report.threat_level)
        return fallback, None
