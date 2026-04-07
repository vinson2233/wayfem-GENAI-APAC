import logging
from typing import Optional
from tools.mcp_tool_executor import mcp_create_trip_calendar

logger = logging.getLogger(__name__)


def create_trip_calendar(trip_id: str, itinerary_days: list, emergency_contact: str) -> Optional[str]:
    """Create trip calendar — called from sync context, wraps async MCP call."""
    import asyncio
    try:
        loop = asyncio.get_event_loop()
        if loop.is_running():
            import concurrent.futures
            with concurrent.futures.ThreadPoolExecutor() as pool:
                future = pool.submit(asyncio.run, mcp_create_trip_calendar(trip_id, "Trip", itinerary_days, emergency_contact))
                return future.result(timeout=30)
        else:
            return loop.run_until_complete(mcp_create_trip_calendar(trip_id, "Trip", itinerary_days, emergency_contact))
    except Exception as e:
        logger.warning(f"Calendar MCP error: {e}")
        return None
