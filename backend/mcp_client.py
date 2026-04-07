"""
SafeHer MCP Client

Provides MultiServerMCPClient connections to MCP servers:
- safeher-maps  (Google Maps tools, stdio)
- safeher-search (Serper web search tools, stdio)
- safeher-calendar (Google Calendar tools, streamable-http — optional)

Maps and Search are spawned as stdio subprocesses.
Calendar is a separate HTTP service and is OPTIONAL — failures are graceful.
"""

import os
import logging
from contextlib import asynccontextmanager
from typing import AsyncIterator

from langchain_mcp_adapters.client import MultiServerMCPClient

logger = logging.getLogger(__name__)

_SERVERS_DIR = os.path.join(os.path.dirname(os.path.abspath(__file__)), "mcp_servers")


def _maps_search_config() -> dict:
    """Config for Maps + Search MCP servers (stdio, always available)."""
    return {
        "safeher-maps": {
            "command": "python",
            "args": [os.path.join(_SERVERS_DIR, "maps_server.py")],
            "transport": "stdio",
            "env": {**os.environ},
        },
        "safeher-search": {
            "command": "python",
            "args": [os.path.join(_SERVERS_DIR, "search_server.py")],
            "transport": "stdio",
            "env": {**os.environ},
        },
    }


def _calendar_config() -> dict:
    """Config for Calendar MCP server (streamable-http, optional)."""
    return {
        "safeher-calendar": {
            "url": os.getenv("CALENDAR_MCP_URL", "http://calendar-mcp:8003/mcp"),
            "transport": "streamable_http",
        }
    }


@asynccontextmanager
async def get_mcp_client() -> AsyncIterator[MultiServerMCPClient]:
    """
    Async context manager for Maps + Search MCP tools.
    Does NOT include calendar (use get_calendar_mcp_client for that).

    Example:
        async with get_mcp_client() as client:
            tools = await client.get_tools()
    """
    client = MultiServerMCPClient(_maps_search_config())
    try:
        yield client
    finally:
        pass


@asynccontextmanager
async def get_calendar_mcp_client() -> AsyncIterator[MultiServerMCPClient]:
    """
    Async context manager for Calendar MCP tools.
    Raises if the calendar-mcp service is not reachable.
    """
    client = MultiServerMCPClient(_calendar_config())
    try:
        yield client
    finally:
        pass


async def get_maps_tools():
    client = MultiServerMCPClient({"safeher-maps": _maps_search_config()["safeher-maps"]})
    return await client.get_tools()


async def get_search_tools():
    client = MultiServerMCPClient({"safeher-search": _maps_search_config()["safeher-search"]})
    return await client.get_tools()


async def get_calendar_tools():
    try:
        client = MultiServerMCPClient(_calendar_config())
        return await client.get_tools()
    except Exception as e:
        logger.warning(f"Calendar MCP unavailable: {e}")
        return []
