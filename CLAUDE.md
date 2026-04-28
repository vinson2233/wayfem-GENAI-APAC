# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Overview

**Wayfem** is a women's safety-first travel planning app built as a hackathon project. It uses a multi-agent AI system (LangGraph + Gemini) with a FastAPI backend and React frontend deployed as a single Docker image on Cloud Run.

## Commands

### Frontend (in `frontend/`)
```bash
npm run dev       # Dev server on :5173
npm run build     # TypeScript check + Vite build to dist/
npm run lint      # ESLint
npm run preview   # Preview production build
```

### Backend (in `backend/`)
```bash
pip install -r requirements.txt          # Install dependencies
uvicorn main:app --reload                # Dev server on :8000
./start.sh                               # Production (starts Calendar MCP + uvicorn)
```

### Docker (local full-stack)
```bash
docker-compose up                        # Runs all 3 services
docker-compose up --build               # Rebuild first
```

### Deploy to Cloud Run
```bash
./deploy.sh                              # Builds, pushes, and deploys
```

## Required Environment Variables

```
GOOGLE_CLOUD_PROJECT         # GCP project ID
GEMINI_API_KEY               # Vertex AI / Gemini
GOOGLE_MAPS_API_KEY          # Google Maps Platform
SERPER_API_KEY               # Serper.dev web search
GOOGLE_APPLICATION_CREDENTIALS  # Optional: path to service account JSON
GOOGLE_CALENDAR_CREDENTIALS_JSON  # Optional: Calendar OAuth JSON
```

## Architecture

### LangGraph Orchestrator (`backend/agents/orchestrator.py`)

The core workflow is a parallel fan-out/fan-in state graph:

1. `parse_request()` — Geocodes destination via Maps MCP
2. **Parallel**: `run_safety_agent()`, `run_accommodation_agent()`, `run_community_agent()`
3. `merge_results()` — Combines agent outputs
4. `run_schedule_agent()` — Builds itinerary with safety curfews
5. `final_rank()` — Applies guardrails (blocks CRITICAL, flags HIGH)
6. `store_db()` — Persists to Firestore

State flows as `TripPlanState` (TypedDict) through the graph.

### Four Specialized Agents

- **Safety Agent** (`safety_agent.py`): Analyzes web search results → `SafetyReport` with threat level (LOW/MEDIUM/HIGH/CRITICAL) and sourced flags
- **Accommodation Agent** (`accommodation_agent.py`): Scores hotels via Female Friendliness Index (FFI) using Maps data + Gemini analysis
- **Community Agent** (`community_agent.py`): Reads/writes Firestore tips; generates new ones if < 5 exist
- **Schedule Agent** (`schedule_agent.py`): Builds itinerary with curfews (CRITICAL/HIGH → 21:00, MEDIUM → 22:00, LOW → 23:00); creates Google Calendar events

### Three MCP Servers (stdio-based, except Calendar)

- **Maps MCP** (`mcp_servers/maps_server.py`): `geocode`, `search_hotels`, `place_details`, `area_safety` — wraps Google Maps Places API
- **Search MCP** (`mcp_servers/search_server.py`): `search_safety`, `search_hotel_safety_reviews`, `search_advisory` — wraps Serper.dev
- **Calendar MCP** (`mcp_servers/calendar_server.py`): HTTP server on `:8003`; creates Google Calendar events; starts as a background subprocess via `start.sh`

MCP connections are managed by `backend/mcp_client.py` using `langchain-mcp-adapters.MultiServerMCPClient`.

### Backend API (`backend/routers/`)

Six FastAPI endpoints under `/api/v1/`:
- `POST /plan` — Full orchestration (main endpoint)
- `GET /safety/{destination}` — Safety report only
- `GET /hotels/{destination}` — Hotels with FFI scores
- `GET /community-tips/{destination}` — Community wisdom
- `POST /checkin/{trip_id}` — Safety check-in
- `POST /feedback` — Submit community tips

`backend/main.py` also serves the React SPA: mounts `/assets` from `frontend/dist/` and returns `index.html` for all unmatched routes.

### Frontend (`frontend/src/`)

- **Routing** (`App.tsx`): 6 routes (`/`, `/trip/:tripId`, `/safety`, `/hotels`, `/community`, `/checkin/:tripId`)
- **API layer** (`api/client.ts`): Axios instance; uses `VITE_API_BASE_URL` (empty = relative paths in production)
- **Key hook** (`hooks/useTripPlan.ts`): Manages orchestration state and 4-step progress display
- **Styling**: Tailwind CSS with custom `safeher-*` color palette

### Deployment

The `Dockerfile` is a 2-stage build: Node 20 builds the frontend → Python 3.11 image includes the built `dist/` and serves it through FastAPI. `start.sh` spawns the Calendar MCP subprocess before starting uvicorn on `$PORT` (default 8080).

### Firestore Collections

`safety_reports` (keyed by destination_id), `hotels` (keyed by place_id), `community_tips`, `trips`
