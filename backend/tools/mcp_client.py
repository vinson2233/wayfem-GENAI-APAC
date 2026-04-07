"""
MCP Client — connects to all MCP servers and provides tools for agents.

Uses:
- Official @modelcontextprotocol/server-google-maps (npx, stdio)
- Custom mcp_servers/search_server.py — Serper-backed web search (stdio)
- Custom mcp_servers/calendar_server.py (streamable-http, port 8003)
"""
import logging
import os
import sys
from langchain_mcp_adapters.client import MultiServerMCPClient

logger = logging.getLogger(__name__)

# Absolute path to our custom MCP server scripts
_BACKEND_DIR = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
_SEARCH_SERVER = os.path.join(_BACKEND_DIR, "mcp_servers", "search_server.py")
_CALENDAR_SERVER = os.path.join(_BACKEND_DIR, "mcp_servers", "calendar_server.py")


def get_mcp_client_config() -> dict:
    """Build MCP server config from environment."""
    config = {}

    # Google Maps MCP (official server via npx)
    maps_key = os.getenv("GOOGLE_MAPS_API_KEY", "")
    if maps_key:
        config["google-maps"] = {
            "command": "npx",
            "args": ["-y", "@modelcontextprotocol/server-google-maps"],
            "env": {"GOOGLE_MAPS_API_KEY": maps_key},
            "transport": "stdio",
        }

    # Search MCP (custom FastMCP server wrapping Serper API)
    serper_key = os.getenv("SERPER_API_KEY", "")
    if serper_key:
        config["search"] = {
            "command": sys.executable,
            "args": [_SEARCH_SERVER],
            "env": {
                "SERPER_API_KEY": serper_key,
                "ENABLE_WEB_SEARCH": "true",
                "GEMINI_API_KEY": os.getenv("GEMINI_API_KEY", ""),
                "GOOGLE_MAPS_API_KEY": maps_key,
                "GOOGLE_CLOUD_PROJECT": os.getenv("GOOGLE_CLOUD_PROJECT", "safeher"),
            },
            "transport": "stdio",
        }

    # Calendar MCP (our custom FastMCP server via streamable-http)
    calendar_url = os.getenv("CALENDAR_MCP_URL", "http://localhost:8003/mcp")
    config["calendar"] = {
        "url": calendar_url,
        "transport": "streamable_http",
    }

    return config


async def get_maps_tools():
    """Get Google Maps MCP tools."""
    config = get_mcp_client_config()
    if "google-maps" not in config:
        logger.warning("Google Maps MCP not configured")
        return []
    client = MultiServerMCPClient({"google-maps": config["google-maps"]})
    return await client.get_tools()


async def get_search_tools():
    """Get Serper Search MCP tools."""
    config = get_mcp_client_config()
    if "search" not in config:
        logger.warning("Search MCP not configured (SERPER_API_KEY missing)")
        return []
    client = MultiServerMCPClient({"search": config["search"]})
    return await client.get_tools()


async def get_calendar_tools():
    """Get Calendar MCP tools."""
    config = get_mcp_client_config()
    if "calendar" not in config:
        return []
    try:
        client = MultiServerMCPClient({"calendar": config["calendar"]})
        return await client.get_tools()
    except Exception as e:
        logger.warning(f"Calendar MCP unavailable: {e}")
        return []


async def get_all_tools():
    """Get all MCP tools from all servers."""
    import asyncio
    maps, search, calendar = await asyncio.gather(
        get_maps_tools(),
        get_search_tools(),
        get_calendar_tools(),
        return_exceptions=True,
    )
    tools = []
    for t in [maps, search, calendar]:
        if isinstance(t, list):
            tools.extend(t)
    return tools
