import logging
import math
from typing import Optional
import googlemaps
from config import settings
from tools.mcp_tool_executor import mcp_geocode, mcp_search_places

logger = logging.getLogger(__name__)

_gmaps_client: Optional[googlemaps.Client] = None


def get_gmaps() -> googlemaps.Client:
    global _gmaps_client
    if _gmaps_client is None:
        _gmaps_client = googlemaps.Client(key=settings.GOOGLE_MAPS_API_KEY)
    return _gmaps_client


def geocode_destination(destination: str) -> dict:
    """Geocode via googlemaps SDK (sync, used in orchestrator setup)."""
    try:
        gmaps = get_gmaps()
        results = gmaps.geocode(destination)
        if not results:
            return {"lat": 0.0, "lng": 0.0, "formatted_address": destination, "country": "", "city": destination}
        result = results[0]
        location = result["geometry"]["location"]
        country, city = "", ""
        for component in result.get("address_components", []):
            types = component.get("types", [])
            if "country" in types:
                country = component["long_name"]
            if ("locality" in types or "administrative_area_level_1" in types) and not city:
                city = component["long_name"]
        return {
            "lat": location["lat"],
            "lng": location["lng"],
            "formatted_address": result.get("formatted_address", destination),
            "country": country,
            "city": city,
        }
    except Exception as e:
        logger.error(f"Geocode error for '{destination}': {e}")
        return {"lat": 0.0, "lng": 0.0, "formatted_address": destination, "country": "", "city": destination}


async def search_hotels_nearby_mcp(destination: str, max_results: int = 10) -> list[dict]:
    """Search hotels via Google Maps MCP server."""
    results = await mcp_search_places(f"hotels in {destination}")
    if results:
        return results[:max_results]
    # Fallback to SDK
    return search_hotels_nearby(destination, max_results)


def search_hotels_nearby(destination: str, max_results: int = 10) -> list[dict]:
    """Search hotels via googlemaps SDK (sync fallback)."""
    try:
        gmaps = get_gmaps()
        geo = geocode_destination(destination)
        location = (geo["lat"], geo["lng"])
        results = gmaps.places_nearby(location=location, radius=5000, type="lodging")
        hotels = []
        for place in results.get("results", [])[:max_results]:
            photo_ref = None
            if place.get("photos"):
                photo_ref = place["photos"][0].get("photo_reference")
            hotels.append({
                "place_id": place.get("place_id", ""),
                "name": place.get("name", ""),
                "rating": place.get("rating", 0.0),
                "address": place.get("vicinity", ""),
                "photo_reference": photo_ref,
                "user_ratings_total": place.get("user_ratings_total", 0),
                "geometry": place.get("geometry", {}),
            })
        return hotels
    except Exception as e:
        logger.error(f"Hotel search error for '{destination}': {e}")
        return []


def get_place_details(place_id: str) -> dict:
    try:
        gmaps = get_gmaps()
        fields = ["name", "place_id", "formatted_address", "rating", "review", "photo", "price_level", "website", "international_phone_number", "type", "geometry"]
        result = gmaps.place(place_id=place_id, fields=fields)
        return result.get("result", {})
    except Exception as e:
        logger.error(f"Place details error for '{place_id}': {e}")
        return {}


def _haversine_m(lat1, lng1, lat2, lng2) -> float:
    R = 6_371_000
    phi1, phi2 = math.radians(lat1), math.radians(lat2)
    dphi, dlam = math.radians(lat2 - lat1), math.radians(lng2 - lng1)
    a = math.sin(dphi / 2) ** 2 + math.cos(phi1) * math.cos(phi2) * math.sin(dlam / 2) ** 2
    return R * 2 * math.atan2(math.sqrt(a), math.sqrt(1 - a))


def get_area_safety_info(lat: float, lng: float) -> dict:
    try:
        gmaps = get_gmaps()
        location = (lat, lng)
        hospitals = gmaps.places_nearby(location=location, radius=3000, type="hospital").get("results", [])
        police = gmaps.places_nearby(location=location, radius=3000, type="police").get("results", [])

        def nearest_distance(places):
            if not places:
                return None
            loc = places[0].get("geometry", {}).get("location", {})
            return _haversine_m(lat, lng, loc["lat"], loc["lng"]) if loc else None

        hospital_distance = nearest_distance(hospitals)
        police_distance = nearest_distance(police)
        safety_score = 5.0
        for dist in [hospital_distance, police_distance]:
            if dist is not None:
                safety_score += 1.5 if dist < 1000 else 1.0 if dist < 2000 else 0.5 if dist < 3000 else 0

        return {
            "hospitals_count": len(hospitals),
            "police_stations_count": len(police),
            "nearest_hospital_m": round(hospital_distance) if hospital_distance else None,
            "nearest_police_m": round(police_distance) if police_distance else None,
            "area_safety_score": round(min(safety_score, 10.0), 1),
        }
    except Exception as e:
        logger.error(f"Area safety info error at ({lat},{lng}): {e}")
        return {"hospitals_count": 0, "police_stations_count": 0, "nearest_hospital_m": None, "nearest_police_m": None, "area_safety_score": 5.0}
