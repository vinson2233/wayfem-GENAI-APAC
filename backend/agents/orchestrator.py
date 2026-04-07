import asyncio
import json
import logging
import traceback
import uuid
from datetime import datetime, timezone
from typing import TypedDict, Optional, Annotated, Any
import operator

import vertexai
from langgraph.graph import StateGraph, END

from config import settings
from models.safety import SafetyReport, ThreatLevel
from models.hotel import Hotel
from models.trip import TripPlanRequest, TripPlanResponse
from models.itinerary import ItineraryDay, ItineraryItem
from agents.safety_agent import run_safety_agent
from agents.accommodation_agent import run_accommodation_agent
from agents.schedule_agent import run_schedule_agent
from agents.community_agent import run_community_agent
from mcp_client import get_mcp_client
from database.firestore import save_trip, save_safety_report, save_hotel

logger = logging.getLogger(__name__)


def _mcp_to_text(result: Any) -> str:
    """Extract plain text from an MCP tool result.
    
    langchain-mcp-adapters may return:
    - a plain string
    - a list of content blocks: [{"type": "text", "text": "..."}, ...]
    - a single content block dict
    """
    if isinstance(result, str):
        return result
    if isinstance(result, list):
        parts = []
        for block in result:
            if isinstance(block, dict):
                parts.append(block.get("text") or block.get("content") or "")
            else:
                parts.append(str(block))
        return "".join(parts)
    if isinstance(result, dict):
        return result.get("text") or result.get("content") or json.dumps(result)
    return str(result)


def _mcp_to_json(result: Any) -> Any:
    """Parse an MCP tool result as JSON (dict or list)."""
    text = _mcp_to_text(result).strip()
    if not text:
        return {}
    return json.loads(text)


class TripPlanState(TypedDict):
    request: TripPlanRequest
    destination_geo: dict
    destination_id: str
    trip_id: str
    search_results_safety: list[dict]
    search_results_hotels: list[dict]
    hotels_raw: list[dict]
    area_safety: dict
    safety_report: Optional[SafetyReport]
    hotels: list[Hotel]
    community_tips: list[str]
    itinerary: list[ItineraryDay]
    calendar_id: Optional[str]
    errors: Annotated[list[str], operator.add]


def _make_destination_id(destination: str) -> str:
    return destination.lower().strip().replace(" ", "_").replace(",", "")


async def _node_parse_request(state: TripPlanState) -> dict:
    """Parse the trip request and geocode destination via Maps MCP server."""
    try:
        request = state["request"]
        destination = request.destination
        destination_id = _make_destination_id(destination)
        trip_id = str(uuid.uuid4())

        # Call Maps MCP server for geocoding
        async with get_mcp_client() as client:
            tools = await client.get_tools()
            geocode_tool = next((t for t in tools if t.name == "geocode"), None)
            if geocode_tool:
                result = await geocode_tool.ainvoke({"destination": destination})
                geo = _mcp_to_json(result)
            else:
                raise RuntimeError("geocode tool not available via MCP")

        return {
            "destination_geo": geo,
            "destination_id": destination_id,
            "trip_id": trip_id,
            "errors": [],
        }
    except Exception as e:
        logger.error(f"parse_request error: {e}\n{traceback.format_exc()}")
        return {
            "destination_geo": {"lat": 0.0, "lng": 0.0, "formatted_address": state["request"].destination, "country": "", "city": state["request"].destination},
            "destination_id": _make_destination_id(state["request"].destination),
            "trip_id": str(uuid.uuid4()),
            "errors": [f"Geocoding failed: {e}"],
        }


async def _node_fetch_search_data(state: TripPlanState) -> dict:
    """Fetch safety search data and hotel data via Search and Maps MCP servers."""
    destination = state["request"].destination
    geo = state["destination_geo"]

    try:
        logger.info(f"[fetch_search_data] Starting MCP client for '{destination}'")
        async with get_mcp_client() as client:
            tools = await client.get_tools()
            tools_by_name = {t.name: t for t in tools}
            logger.info(f"[fetch_search_data] MCP tools available: {list(tools_by_name.keys())}")

            # Run safety search + hotel search in parallel via MCP
            async def call_search_safety():
                t = tools_by_name.get("search_safety")
                if not t:
                    logger.warning("[fetch_search_data] search_safety tool not found in MCP")
                    return []
                logger.info(f"[fetch_search_data] Calling search_safety for '{destination}'")
                raw = await t.ainvoke({"destination": destination})
                result = _mcp_to_json(raw)
                return result if isinstance(result, list) else []

            async def call_search_advisory():
                t = tools_by_name.get("search_advisory")
                if not t:
                    logger.warning("[fetch_search_data] search_advisory tool not found in MCP")
                    return []
                logger.info(f"[fetch_search_data] Calling search_advisory for '{destination}'")
                raw = await t.ainvoke({"destination": destination})
                result = _mcp_to_json(raw)
                return result if isinstance(result, list) else []

            async def call_search_hotels():
                t = tools_by_name.get("search_hotels")
                if not t:
                    logger.warning("[fetch_search_data] search_hotels tool not found in MCP")
                    return []
                logger.info(f"[fetch_search_data] Calling search_hotels for '{destination}'")
                raw = await t.ainvoke({"destination": destination, "max_results": 10})
                result = _mcp_to_json(raw)
                return result if isinstance(result, list) else []

            async def call_area_safety():
                t = tools_by_name.get("area_safety")
                if not t:
                    logger.warning("[fetch_search_data] area_safety tool not found in MCP")
                    return {"area_safety_score": 5.0}
                logger.info(f"[fetch_search_data] Calling area_safety at ({geo.get('lat')},{geo.get('lng')})")
                raw = await t.ainvoke({"lat": geo.get("lat", 0.0), "lng": geo.get("lng", 0.0)})
                result = _mcp_to_json(raw)
                return result if isinstance(result, dict) else {"area_safety_score": 5.0}

            gather_results = await asyncio.gather(
                call_search_safety(),
                call_search_advisory(),
                call_search_hotels(),
                call_area_safety(),
                return_exceptions=True,
            )

            safety_results, advisory_results, hotels_raw, area_safety = [
                r if not isinstance(r, Exception) else (logger.error(f"[fetch_search_data] sub-task failed: {r}\n{traceback.format_tb(r.__traceback__)}") or ([] if i < 3 else {"area_safety_score": 5.0}))
                for i, r in enumerate(gather_results)
            ]

            combined_safety = (safety_results or []) + (advisory_results or [])

            # Enrich hotels with place details via Maps MCP
            place_details_tool = tools_by_name.get("place_details")
            enriched_hotels = []
            for hotel in (hotels_raw or []):
                if not isinstance(hotel, dict):
                    continue
                place_id = hotel.get("place_id", "")
                if place_id and place_details_tool:
                    try:
                        details_raw = await place_details_tool.ainvoke({"place_id": place_id})
                        hotel["details"] = _mcp_to_json(details_raw)
                    except Exception as detail_err:
                        logger.warning(f"Could not fetch details for {place_id}: {detail_err}")
                        hotel["details"] = {}
                else:
                    hotel["details"] = {}
                enriched_hotels.append(hotel)

            # Search hotel reviews via Search MCP
            hotel_review_tool = tools_by_name.get("search_hotel_safety_reviews")
            hotel_review_results = []
            if hotel_review_tool:
                review_tasks = [
                    hotel_review_tool.ainvoke({"hotel_name": h.get("name", ""), "destination": destination})
                    for h in enriched_hotels[:5]
                ]
                review_responses = await asyncio.gather(*review_tasks, return_exceptions=True)
                for resp in review_responses:
                    if isinstance(resp, Exception):
                        continue
                    parsed = _mcp_to_json(resp)
                    if isinstance(parsed, list):
                        hotel_review_results.extend(parsed)

        return {
            "search_results_safety": combined_safety,
            "search_results_hotels": hotel_review_results,
            "hotels_raw": enriched_hotels,
            "area_safety": area_safety,
            "errors": [],
        }
    except Exception as e:
        logger.error(f"fetch_search_data error: {e}\n{traceback.format_exc()}")
        return {
            "search_results_safety": [],
            "search_results_hotels": [],
            "hotels_raw": [],
            "area_safety": {"area_safety_score": 5.0},
            "errors": [f"Data fetch failed: {e}"],
        }


async def _node_safety_check(state: TripPlanState) -> dict:
    try:
        report = await run_safety_agent(
            destination=state["request"].destination,
            destination_id=state["destination_id"],
            city=state["destination_geo"].get("city", state["request"].destination),
            country=state["destination_geo"].get("country", ""),
            search_results=state["search_results_safety"],
        )
        return {"safety_report": report, "errors": []}
    except Exception as e:
        logger.error(f"safety_check error: {e}\n{traceback.format_exc()}")
        return {
            "safety_report": SafetyReport(
                destination_id=state["destination_id"],
                country=state["destination_geo"].get("country", ""),
                city=state["destination_geo"].get("city", state["request"].destination),
                threat_level=ThreatLevel.MEDIUM,
                flags=["Safety data unavailable"],
                night_safety=False,
                transportation_safe=True,
                local_laws_notes="Research local laws before traveling.",
                emergency_number="112",
                overall_score=5.0,
                summary="Safety data could not be retrieved. Exercise standard caution.",
            ),
            "errors": [f"Safety check failed: {e}"],
        }


async def _node_hotel_search(state: TripPlanState) -> dict:
    try:
        hotels = await run_accommodation_agent(
            destination=state["request"].destination,
            destination_id=state["destination_id"],
            hotels_raw=state["hotels_raw"],
            review_results=state["search_results_hotels"],
            area_safety=state["area_safety"],
        )
        return {"hotels": hotels, "errors": []}
    except Exception as e:
        logger.error(f"hotel_search error: {e}\n{traceback.format_exc()}")
        return {"hotels": [], "errors": [f"Hotel search failed: {e}"]}


async def _node_community_lookup(state: TripPlanState) -> dict:
    try:
        tips = await run_community_agent(
            destination_id=state["destination_id"],
            destination=state["request"].destination,
        )
        return {"community_tips": tips, "errors": []}
    except Exception as e:
        logger.error(f"community_lookup error: {e}\n{traceback.format_exc()}")
        return {"community_tips": [], "errors": [f"Community lookup failed: {e}"]}


async def _node_merge_results(state: TripPlanState) -> dict:
    return {"errors": []}


async def _node_build_schedule(state: TripPlanState) -> dict:
    try:
        safety_report = state["safety_report"]
        if safety_report and safety_report.threat_level == ThreatLevel.CRITICAL:
            blocked_day = ItineraryDay(
                date=state["request"].start_date,
                day_number=1,
                items=[
                    ItineraryItem(
                        time="00:00",
                        activity="DESTINATION BLOCKED — Travel not recommended",
                        location=state["request"].destination,
                        safety_note="This destination has been flagged as CRITICAL risk. SafeHer strongly advises against travel.",
                        is_flagged=True,
                    )
                ],
                safe_return_time="18:00",
                daily_safety_tip="Do not travel to this destination until the safety situation improves.",
            )
            return {"itinerary": [blocked_day], "calendar_id": None, "errors": []}

        itinerary, calendar_id = await run_schedule_agent(
            destination=state["request"].destination,
            trip_id=state["trip_id"],
            start_date=state["request"].start_date,
            end_date=state["request"].end_date,
            safety_report=safety_report,
            emergency_contact=state["request"].emergency_contact,
        )
        return {"itinerary": itinerary, "calendar_id": calendar_id, "errors": []}
    except Exception as e:
        logger.error(f"build_schedule error: {e}\n{traceback.format_exc()}")
        return {"itinerary": [], "calendar_id": None, "errors": [f"Schedule build failed: {e}"]}


async def _node_final_rank(state: TripPlanState) -> dict:
    safety_report = state.get("safety_report")
    hotels = list(state.get("hotels", []))
    itinerary = list(state.get("itinerary", []))

    errors: list[str] = []

    if safety_report:
        if safety_report.threat_level == ThreatLevel.CRITICAL:
            return {
                "hotels": [],
                "itinerary": itinerary,
                "errors": ["CRITICAL: This destination is not recommended for travel."],
            }

        if safety_report.threat_level == ThreatLevel.HIGH:
            risk_prefix = "⚠️ HIGH RISK DESTINATION: "
            for flag in safety_report.flags:
                errors.append(f"{risk_prefix}{flag}")

    passing_hotels = [h for h in hotels if h.female_friendliness_score >= 4.0]
    final_hotels = passing_hotels if passing_hotels else hotels
    final_hotels.sort(key=lambda h: h.female_friendliness_score, reverse=True)

    for day in itinerary:
        if not day.safe_return_time:
            day.safe_return_time = "21:00"

    return {"hotels": final_hotels, "itinerary": itinerary, "errors": errors}


async def _node_store_db(state: TripPlanState) -> dict:
    try:
        safety_report = state.get("safety_report")
        if safety_report:
            await save_safety_report(safety_report)

        for hotel in state.get("hotels", []):
            try:
                await save_hotel(hotel)
            except Exception as hotel_err:
                logger.warning(f"Could not save hotel {hotel.place_id}: {hotel_err}")

        trip_data = {
            "destination": state["request"].destination,
            "start_date": state["request"].start_date,
            "end_date": state["request"].end_date,
            "user_id": state["request"].user_id,
            "emergency_contact": state["request"].emergency_contact,
            "trip_id": state["trip_id"],
            "calendar_id": state.get("calendar_id"),
            "safety_score": safety_report.overall_score if safety_report else 5.0,
            "status": "active",
        }
        await save_trip(state["trip_id"], trip_data)

    except Exception as e:
        logger.error(f"store_db error: {e}\n{traceback.format_exc()}")

    return {"errors": []}


def _build_graph():
    workflow = StateGraph(TripPlanState)

    workflow.add_node("parse_request", _node_parse_request)
    workflow.add_node("fetch_search_data", _node_fetch_search_data)
    workflow.add_node("safety_check", _node_safety_check)
    workflow.add_node("hotel_search", _node_hotel_search)
    workflow.add_node("community_lookup", _node_community_lookup)
    workflow.add_node("merge_results", _node_merge_results)
    workflow.add_node("build_schedule", _node_build_schedule)
    workflow.add_node("final_rank", _node_final_rank)
    workflow.add_node("store_db", _node_store_db)

    workflow.set_entry_point("parse_request")
    workflow.add_edge("parse_request", "fetch_search_data")
    workflow.add_edge("fetch_search_data", "safety_check")
    workflow.add_edge("fetch_search_data", "hotel_search")
    workflow.add_edge("fetch_search_data", "community_lookup")
    workflow.add_edge("safety_check", "merge_results")
    workflow.add_edge("hotel_search", "merge_results")
    workflow.add_edge("community_lookup", "merge_results")
    workflow.add_edge("merge_results", "build_schedule")
    workflow.add_edge("build_schedule", "final_rank")
    workflow.add_edge("final_rank", "store_db")
    workflow.add_edge("store_db", END)

    return workflow.compile()


_graph = None


def get_graph():
    global _graph
    if _graph is None:
        _graph = _build_graph()
    return _graph


async def plan_trip(request: TripPlanRequest) -> TripPlanResponse:
    vertexai.init(
        project=settings.GOOGLE_CLOUD_PROJECT,
        location=settings.GOOGLE_CLOUD_LOCATION,
    )

    initial_state: TripPlanState = {
        "request": request,
        "destination_geo": {},
        "destination_id": "",
        "trip_id": "",
        "search_results_safety": [],
        "search_results_hotels": [],
        "hotels_raw": [],
        "area_safety": {},
        "safety_report": None,
        "hotels": [],
        "community_tips": [],
        "itinerary": [],
        "calendar_id": None,
        "errors": [],
    }

    graph = get_graph()
    final_state = await graph.ainvoke(initial_state)

    safety_report = final_state.get("safety_report")
    if safety_report is None:
        safety_report = SafetyReport(
            destination_id=final_state.get("destination_id", "unknown"),
            country="",
            city=request.destination,
            threat_level=ThreatLevel.MEDIUM,
            flags=[],
            night_safety=False,
            transportation_safe=True,
            local_laws_notes="No information available.",
            emergency_number="112",
            overall_score=5.0,
            summary="Safety data unavailable.",
        )

    risk_flags = list(safety_report.flags) + final_state.get("errors", [])

    emergency_contacts = {
        "local_emergency": safety_report.emergency_number,
        "destination": request.destination,
    }
    if request.emergency_contact:
        emergency_contacts["personal_contact"] = request.emergency_contact

    return TripPlanResponse(
        trip_id=final_state["trip_id"],
        destination=request.destination,
        overall_safety_score=safety_report.overall_score,
        risk_flags=risk_flags,
        hotels=final_state.get("hotels", []),
        itinerary=final_state.get("itinerary", []),
        emergency_contacts=emergency_contacts,
        community_tips=final_state.get("community_tips", []),
        safety_report=safety_report,
        created_at=datetime.now(timezone.utc),
    )
