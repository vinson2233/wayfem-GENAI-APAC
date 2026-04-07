import logging
from config import settings
import httpx

logger = logging.getLogger(__name__)


async def _search_via_serper(query: str, num: int = 5) -> list[dict]:
    """Search via Serper API (direct HTTP, used as fallback if MCP server is unavailable)."""
    if not settings.SERPER_API_KEY:
        return []
    try:
        async with httpx.AsyncClient(timeout=15.0) as client:
            response = await client.post(
                "https://google.serper.dev/search",
                headers={"X-API-KEY": settings.SERPER_API_KEY, "Content-Type": "application/json"},
                json={"q": query, "num": min(num, 10)},
            )
            response.raise_for_status()
            return [
                {"title": r.get("title", ""), "snippet": r.get("snippet", ""), "link": r.get("link", "")}
                for r in response.json().get("organic", [])
            ]
    except Exception as e:
        logger.error(f"Serper search error for '{query}': {e}")
        return []


async def _search(query: str, num: int = 5) -> list[dict]:
    if not settings.ENABLE_WEB_SEARCH:
        return []
    return await _search_via_serper(query, num)


async def search_travel_safety(destination: str) -> list[dict]:
    return await _search(f"{destination} solo female traveler safety 2024")


async def search_hotel_reviews(hotel_name: str, destination: str) -> list[dict]:
    return await _search(f"{hotel_name} {destination} solo female traveler review")


async def search_travel_advisory(destination: str) -> list[dict]:
    return await _search(f"{destination} travel advisory women safety")
