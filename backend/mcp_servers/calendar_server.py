"""
SafeHer Calendar MCP Server
Run with: python mcp_servers/calendar_server.py
Transport: streamable-http on port 8003
"""
from mcp.server.fastmcp import FastMCP
from google.oauth2 import service_account
from googleapiclient.discovery import build
from datetime import datetime, timezone
import os, logging

logger = logging.getLogger(__name__)
mcp = FastMCP("safeher-calendar", host="0.0.0.0", port=8003)

SCOPES = ["https://www.googleapis.com/auth/calendar"]

def get_calendar_service():
    creds_path = os.getenv("GOOGLE_CALENDAR_CREDENTIALS_JSON", "")
    if not creds_path or not os.path.exists(creds_path):
        raise ValueError(f"Calendar credentials not found at: {creds_path}")
    creds = service_account.Credentials.from_service_account_file(creds_path, scopes=SCOPES)
    return build("calendar", "v3", credentials=creds)

@mcp.tool()
def create_calendar(name: str, description: str = "") -> str:
    """Create a new Google Calendar. Returns the calendar ID."""
    service = get_calendar_service()
    calendar_body = {"summary": name, "description": description, "timeZone": "UTC"}
    result = service.calendars().insert(body=calendar_body).execute()
    return result["id"]

@mcp.tool()
def add_event(
    calendar_id: str,
    title: str,
    date: str,
    start_time: str,
    end_time: str,
    description: str = "",
    location: str = "",
) -> str:
    """Add an event to a Google Calendar. date format: YYYY-MM-DD, time format: HH:MM. Returns event ID."""
    service = get_calendar_service()
    event = {
        "summary": title,
        "location": location,
        "description": description,
        "start": {"dateTime": f"{date}T{start_time}:00Z", "timeZone": "UTC"},
        "end": {"dateTime": f"{date}T{end_time}:00Z", "timeZone": "UTC"},
    }
    result = service.events().insert(calendarId=calendar_id, body=event).execute()
    return result["id"]

@mcp.tool()
def add_checkin_reminder(
    calendar_id: str,
    date: str,
    hotel_name: str,
    emergency_contact: str,
    checkin_time: str = "21:00",
) -> str:
    """Add a daily safety check-in reminder event. Returns event ID."""
    service = get_calendar_service()
    event = {
        "summary": "🛡 SafeHer Check-in",
        "description": f"Daily safety check-in reminder.\nHotel: {hotel_name}\nEmergency contact: {emergency_contact}\n\nIf you miss this check-in, your emergency contact will be notified.",
        "start": {"dateTime": f"{date}T{checkin_time}:00Z", "timeZone": "UTC"},
        "end": {"dateTime": f"{date}T{checkin_time}:30Z", "timeZone": "UTC"},
        "reminders": {"useDefault": False, "overrides": [{"method": "popup", "minutes": 30}]},
    }
    result = service.events().insert(calendarId=calendar_id, body=event).execute()
    return result["id"]

if __name__ == "__main__":
    import uvicorn
    # Use CALENDAR_MCP_PORT for internal use (not Cloud Run's reserved PORT)
    port = int(os.environ.get("CALENDAR_MCP_PORT", os.environ.get("PORT", 8003)))
    app = mcp.streamable_http_app()
    uvicorn.run(
        app,
        host="0.0.0.0",
        port=port,
        log_level="info",
        forwarded_allow_ips="*",
        proxy_headers=True,
    )
