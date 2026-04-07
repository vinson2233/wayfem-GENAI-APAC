"""
SafeHer Search MCP Server

Exposes web search tools (travel safety, hotel reviews, travel advisories)
via the Model Context Protocol using FastMCP (Serper API).

Run standalone: python mcp_servers/search_server.py
"""

import sys
import os
import json

sys.path.insert(0, os.path.dirname(os.path.dirname(os.path.abspath(__file__))))

from mcp.server.fastmcp import FastMCP
from tools.search_tool import (
    search_travel_safety,
    search_hotel_reviews,
    search_travel_advisory,
)

mcp = FastMCP("SafeHer Search")


@mcp.tool()
async def search_safety(destination: str) -> str:
    """
    Search the web for solo female traveler safety information for a destination.
    Returns JSON array of search results with: title, snippet, link.
    Use this to find crime statistics, harassment reports, and general safety conditions.
    """
    results = await search_travel_safety(destination)
    return json.dumps(results)


@mcp.tool()
async def search_hotel_safety_reviews(hotel_name: str, destination: str) -> str:
    """
    Search for solo female traveler reviews of a specific hotel.
    Returns JSON array of search results with: title, snippet, link.
    Use this to find mentions of safety, harassment, security features, and female-friendly experiences.
    """
    results = await search_hotel_reviews(hotel_name, destination)
    return json.dumps(results)


@mcp.tool()
async def search_advisory(destination: str) -> str:
    """
    Search for official government travel advisories and women's safety warnings for a destination.
    Returns JSON array of search results with: title, snippet, link.
    Use this to find State Department / FCO advisories and active alerts.
    """
    results = await search_travel_advisory(destination)
    return json.dumps(results)


if __name__ == "__main__":
    mcp.run(transport="stdio")
