"""
SafeHer Maps MCP Server

Exposes Google Maps tools (geocoding, hotel search, place details, area safety)
via the Model Context Protocol using FastMCP.

Run standalone: python mcp_servers/maps_server.py
"""

import sys
import os
import json

# Allow imports from the backend root
sys.path.insert(0, os.path.dirname(os.path.dirname(os.path.abspath(__file__))))

from mcp.server.fastmcp import FastMCP
from tools.maps_tool import (
    geocode_destination,
    search_hotels_nearby,
    get_place_details,
    get_area_safety_info,
)

mcp = FastMCP("SafeHer Maps")


@mcp.tool()
def geocode(destination: str) -> str:
    """
    Geocode a destination string to get coordinates, city, country and formatted address.
    Returns JSON with: lat, lng, formatted_address, country, city.
    """
    result = geocode_destination(destination)
    return json.dumps(result)


@mcp.tool()
def search_hotels(destination: str, max_results: int = 10) -> str:
    """
    Search for hotels/lodging near a destination using Google Maps Places API.
    Returns JSON array of hotels with: place_id, name, rating, address, photo_reference.
    """
    results = search_hotels_nearby(destination, max_results)
    return json.dumps(results)


@mcp.tool()
def place_details(place_id: str) -> str:
    """
    Get detailed information about a specific place using its Google Maps place_id.
    Returns JSON with: name, formatted_address, rating, reviews, photos, website, price_level.
    """
    result = get_place_details(place_id)
    return json.dumps(result)


@mcp.tool()
def area_safety(lat: float, lng: float) -> str:
    """
    Get area safety information for a location (lat/lng).
    Returns JSON with: hospitals_count, police_stations_count, nearest distances, area_safety_score (0-10).
    """
    result = get_area_safety_info(lat, lng)
    return json.dumps(result)


if __name__ == "__main__":
    mcp.run(transport="stdio")
