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


def _reset_gmaps() -> googlemaps.Client:
    """Force-create a fresh client (call after SSL/connection errors)."""
    global _gmaps_client
    _gmaps_client = googlemaps.Client(key=settings.GOOGLE_MAPS_API_KEY)
    return _gmaps_client


def _gmaps_call(fn, *args, **kwargs):
    """Call a googlemaps SDK method; on SSL/connection error reset the client and retry once."""
    import ssl
    from requests.exceptions import SSLError as RequestsSSLError, ConnectionError as RequestsConnError
    try:
        return fn(*args, **kwargs)
    except (ssl.SSLError, RequestsSSLError, RequestsConnError) as e:
        logger.warning(f"Maps SSL/connection error, resetting client and retrying: {e}")
        _reset_gmaps()
        try:
            return fn(*args, **kwargs)
        except Exception as e2:
            logger.error(f"Maps retry also failed: {e2}")
            raise


def geocode_place_id(query: str) -> Optional[str]:
    """Return the Google place_id for a free-form query, or None if not found."""
    try:
        gmaps = get_gmaps()
        results = gmaps.geocode(query)
        if results:
            return results[0].get("place_id")
        # Fallback to text search via places API
        try:
            ts = gmaps.find_place(input=query, input_type="textquery", fields=["place_id"])
            cands = ts.get("candidates", [])
            if cands:
                return cands[0].get("place_id")
        except Exception:
            pass
    except Exception as e:
        logger.warning(f"geocode_place_id failed for '{query}': {e}")
    return None


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


def get_distance_matrix(origins: list[str], destinations: list[str], mode: str = "transit") -> list[int | None]:
    """Return travel time in minutes for each (origin, destination) pair.

    Returns a flat list of Optional[int] — one value per pair, in order.
    None means the route could not be calculated.
    mode: 'transit' | 'driving' | 'walking'
    """
    try:
        gmaps = get_gmaps()
        result = gmaps.distance_matrix(origins, destinations, mode=mode)
        times: list[int | None] = []
        for row in result.get("rows", []):
            for element in row.get("elements", []):
                if element.get("status") == "OK":
                    duration_sec = element["duration"]["value"]
                    times.append(max(1, round(duration_sec / 60)))
                else:
                    times.append(None)
        return times
    except Exception as e:
        logger.error(f"Distance matrix error: {e}")
        return [None] * (len(origins))


def get_pairwise_transport(
    origin: str, destination: str
) -> Optional[dict]:
    """Pick the best transport mode between two locations.

    Returns dict with: mode, duration_min, distance_m. Or None on failure.
    Heuristic:
      - distance ≤ 1.2 km → walking
      - distance ≤ 8 km   → transit (fall back to driving if no transit route)
      - distance > 8 km   → driving (treat as rideshare in UI)
    """
    try:
        gmaps = get_gmaps()
        # Driving query gives us reliable distance + duration in one call
        drv = _gmaps_call(gmaps.distance_matrix, [origin], [destination], mode="driving").get("rows", [])
        elt = drv[0]["elements"][0] if drv and drv[0].get("elements") else {}
        if elt.get("status") != "OK":
            return None
        distance_m = int(elt["distance"]["value"])
        driving_min = max(1, round(elt["duration"]["value"] / 60))

        # Walking under ~1.2 km
        if distance_m <= 1200:
            walk = _gmaps_call(gmaps.distance_matrix, [origin], [destination], mode="walking").get("rows", [])
            walk_elt = walk[0]["elements"][0] if walk and walk[0].get("elements") else {}
            if walk_elt.get("status") == "OK":
                return {
                    "mode": "walking",
                    "duration_min": max(1, round(walk_elt["duration"]["value"] / 60)),
                    "distance_m": distance_m,
                }

        # Transit if reasonable distance
        if distance_m <= 8000:
            tr = _gmaps_call(gmaps.distance_matrix, [origin], [destination], mode="transit").get("rows", [])
            tr_elt = tr[0]["elements"][0] if tr and tr[0].get("elements") else {}
            if tr_elt.get("status") == "OK":
                return {
                    "mode": "transit",
                    "duration_min": max(1, round(tr_elt["duration"]["value"] / 60)),
                    "distance_m": distance_m,
                }

        # Otherwise driving / rideshare
        return {
            "mode": "rideshare" if distance_m > 1500 else "driving",
            "duration_min": driving_min,
            "distance_m": distance_m,
        }
    except Exception as e:
        logger.warning(f"get_pairwise_transport failed for '{origin}' → '{destination}': {e}")
        return None


def get_area_safety_info(lat: float, lng: float) -> dict:
    try:
        gmaps = get_gmaps()
        location = (lat, lng)
        hospitals = gmaps.places_nearby(location=location, radius=3000, type="hospital").get("results", [])
        police = gmaps.places_nearby(location=location, radius=3000, type="police").get("results", [])

        def _nearest_with_distance(places: list[dict]):
            """Sort by distance from (lat, lng) and return (place_dict, distance_m) of closest."""
            if not places:
                return None, None
            scored = []
            for p in places:
                loc = p.get("geometry", {}).get("location", {})
                if "lat" in loc and "lng" in loc:
                    d = _haversine_m(lat, lng, loc["lat"], loc["lng"])
                    scored.append((p, d))
            if not scored:
                return None, None
            scored.sort(key=lambda x: x[1])
            return scored[0]

        nearest_hospital, hospital_distance = _nearest_with_distance(hospitals)
        nearest_police, police_distance = _nearest_with_distance(police)

        def _to_place(place: Optional[dict], distance: Optional[float]) -> Optional[dict]:
            if not place:
                return None
            return {
                "name": place.get("name", ""),
                "address": place.get("vicinity") or place.get("formatted_address", ""),
                "place_id": place.get("place_id"),
                "distance_meters": round(distance) if distance is not None else None,
            }

        safety_score = 5.0
        for dist in [hospital_distance, police_distance]:
            if dist is not None:
                safety_score += 1.5 if dist < 1000 else 1.0 if dist < 2000 else 0.5 if dist < 3000 else 0

        return {
            "hospitals_count": len(hospitals),
            "police_stations_count": len(police),
            "nearest_hospital_m": round(hospital_distance) if hospital_distance else None,
            "nearest_police_m": round(police_distance) if police_distance else None,
            "nearest_hospital_place": _to_place(nearest_hospital, hospital_distance),
            "nearest_police_place": _to_place(nearest_police, police_distance),
            "area_safety_score": round(min(safety_score, 10.0), 1),
        }
    except Exception as e:
        logger.error(f"Area safety info error at ({lat},{lng}): {e}")
        return {
            "hospitals_count": 0,
            "police_stations_count": 0,
            "nearest_hospital_m": None,
            "nearest_police_m": None,
            "nearest_hospital_place": None,
            "nearest_police_place": None,
            "area_safety_score": 5.0,
        }
