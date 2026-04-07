#!/bin/sh
# Wayfem combined startup script
# Starts calendar MCP server (background) + FastAPI (foreground)

set -e

# Calendar MCP runs internally on port 8003 (not Cloud Run's $PORT)
export CALENDAR_MCP_PORT=8003
export CALENDAR_MCP_URL="http://localhost:${CALENDAR_MCP_PORT}/mcp"

echo "[start.sh] Starting Calendar MCP on port ${CALENDAR_MCP_PORT}..."
python mcp_servers/calendar_server.py &
CALENDAR_PID=$!

# Wait briefly for calendar MCP to be ready
sleep 2

echo "[start.sh] Starting FastAPI on port ${PORT:-8080}..."
exec uvicorn main:app --host 0.0.0.0 --port "${PORT:-8080}"
