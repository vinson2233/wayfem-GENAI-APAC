"""
High-level helpers that execute MCP tools and return structured results.
Falls back to direct API calls if MCP servers are unavailable.
"""
import logging
from typing import Optional
from langchain_mcp_adapters.client import MultiServerMCPClient
from tools.mcp_client import get_mcp_client_config

logger = logging.getLogger(__name__)


async def mcp_search(query: str, num_results: int = 5) -> list[dict]:
    """Search the web via Serper Search MCP server."""
    config = get_mcp_client_config()
    if "search" not in config:
        return []
    try:
        async with MultiServerMCPClient({"search": config["search"]}) as client:
            tools = await client.get_tools()
            # search_server.py exposes: search_safety, search_hotel_safety_reviews, search_advisory
            # For generic queries, use search_safety as the general-purpose tool
            search_tool = next((t for t in tools if t.name == "search_safety"), None)
            if not search_tool:
                return []
            result = await search_tool.ainvoke({"destination": query})
            if isinstance(result, str):
                import json as _json
                try:
                    parsed = _json.loads(result)
                    return parsed if isinstance(parsed, list) else [{"title": "", "snippet": result, "link": ""}]
                except Exception:
                    return [{"title": "", "snippet": result, "link": ""}]
            return result if isinstance(result, list) else []
    except Exception as e:
        logger.error(f"MCP search error for '{query}': {e}")
        return []


async def mcp_geocode(address: str) -> dict:
    """Geocode an address via Google Maps MCP server."""
    config = get_mcp_client_config()
    if "google-maps" not in config:
        return {}
    try:
        async with MultiServerMCPClient({"google-maps": config["google-maps"]}) as client:
            tools = await client.get_tools()
            geocode_tool = next((t for t in tools if "geocode" in t.name and "reverse" not in t.name), None)
            if not geocode_tool:
                return {}
            result = await geocode_tool.ainvoke({"address": address})
            return {"raw": result} if isinstance(result, str) else result
    except Exception as e:
        logger.error(f"MCP geocode error for '{address}': {e}")
        return {}


async def mcp_search_places(query: str, location: Optional[dict] = None) -> list[dict]:
    """Search for places via Google Maps MCP server."""
    config = get_mcp_client_config()
    if "google-maps" not in config:
        return []
    try:
        async with MultiServerMCPClient({"google-maps": config["google-maps"]}) as client:
            tools = await client.get_tools()
            places_tool = next((t for t in tools if "search_places" in t.name), None)
            if not places_tool:
                return []
            args = {"query": query}
            if location:
                args["location"] = location
            result = await places_tool.ainvoke(args)
            return result if isinstance(result, list) else [{"raw": str(result)}]
    except Exception as e:
        logger.error(f"MCP search_places error for '{query}': {e}")
        return []


async def mcp_create_trip_calendar(
    trip_id: str,
    destination: str,
    itinerary_days: list,
    emergency_contact: str,
) -> Optional[str]:
    """Create a trip calendar via Calendar MCP server."""
    config = get_mcp_client_config()
    if "calendar" not in config:
        return None
    try:
        async with MultiServerMCPClient({"calendar": config["calendar"]}) as client:
            tools = await client.get_tools()
            tool_map = {t.name: t for t in tools}

            # Create the calendar
            create_tool = tool_map.get("create_calendar")
            if not create_tool:
                return None
            calendar_id = await create_tool.ainvoke({
                "name": f"SafeHer: {destination} ({trip_id[:8]})",
                "description": f"Safety-first travel itinerary for {destination}",
            })

            # Add check-in reminders for each day
            checkin_tool = tool_map.get("add_checkin_reminder")
            if checkin_tool:
                for day in itinerary_days:
                    try:
                        await checkin_tool.ainvoke({
                            "calendar_id": calendar_id,
                            "date": day.date,
                            "hotel_name": destination,
                            "emergency_contact": emergency_contact or "Not set",
                            "checkin_time": day.safe_return_time or "21:00",
                        })
                    except Exception as day_err:
                        logger.warning(f"Could not add check-in for day {day.day_number}: {day_err}")

            return str(calendar_id)
    except Exception as e:
        logger.error(f"MCP calendar creation error: {e}")
        return None
