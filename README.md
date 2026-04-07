# SafeHer Travel Planner 🛡️

Cloud run URL (online for hackaton duration) : 
https://wayfem-app-3oetgfjgkq-uc.a.run.app

> **Multi-Agent AI System for Women's Safety-First Travel Planning**
> Hackathon submission — Google-native AI stack

---

## Overview

SafeHer uses four specialized AI agents (powered by Vertex AI Gemini) to analyze safety conditions, find female-friendly accommodations, build safe itineraries, and surface community wisdom — all orchestrated via a LangGraph parallel workflow.

```
User Request (REST API)
        ↓
Orchestrator [Gemini 1.5 Pro + LangGraph]
 ├── Safety Intelligence Agent  → travel advisories, crime reports
 ├── Accommodation Agent        → hotels scored by Female Friendliness Index
 ├── Community Agent            → tips from women who've traveled there
 └── Schedule Agent             → safe-hours itinerary + Google Calendar
        ↓
Firestore DB → SafeHer Itinerary Response
```

---

## Project Structure

```
safeher-frontend/          ← monorepo root
├── backend/               ← FastAPI + LangGraph + Vertex AI
│   ├── agents/            ← 4 sub-agents + orchestrator
│   ├── tools/             ← Google Maps, Search, Calendar wrappers
│   ├── routers/           ← FastAPI route handlers
│   ├── models/            ← Pydantic schemas
│   ├── database/          ← Firestore CRUD
│   ├── main.py
│   ├── config.py
│   ├── requirements.txt
│   ├── Dockerfile
│   └── .env.example
├── frontend/              ← React + TypeScript + Vite + Tailwind
│   ├── src/
│   │   ├── api/           ← Axios client + TypeScript types
│   │   ├── components/    ← SafetyBadge, HotelCard, ItineraryCard, ...
│   │   ├── pages/         ← HomePage, TripResults, Safety, Hotels, Community, CheckIn
│   │   └── hooks/         ← useTripPlan
│   ├── Dockerfile
│   └── nginx.conf
└── docker-compose.yml
```

---

## Quick Start

### 1. Configure Environment

```bash
cp backend/.env.example backend/.env
# Edit backend/.env with your API keys
```

Required environment variables:
| Variable | Description |
|---|---|
| `GOOGLE_CLOUD_PROJECT` | GCP project ID |
| `GOOGLE_APPLICATION_CREDENTIALS` | Path to service account JSON |
| `GOOGLE_MAPS_API_KEY` | Google Maps Platform API key |
| `GOOGLE_SEARCH_API_KEY` | Google Custom Search API key |
| `GOOGLE_SEARCH_CX` | Custom Search Engine ID |
| `GOOGLE_CALENDAR_CREDENTIALS_JSON` | Path to Calendar service account JSON |

Create frontend env:
```bash
echo "VITE_API_BASE_URL=http://localhost:8000" > frontend/.env
```

### 2. Run with Docker Compose

```bash
docker-compose up --build
```

- Frontend: http://localhost:5173
- Backend API: http://localhost:8000
- API Docs: http://localhost:8000/docs

### 3. Run Locally (Development)

**Backend:**
```bash
cd backend
python -m venv venv && source venv/bin/activate
pip install -r requirements.txt
uvicorn main:app --reload --port 8000
```

**Frontend:**
```bash
cd frontend
npm install
npm run dev
```

---

## API Endpoints

| Method | Endpoint | Description |
|---|---|---|
| `POST` | `/api/v1/plan` | Full trip plan via multi-agent orchestrator |
| `GET` | `/api/v1/safety/{destination}` | Safety report for a destination |
| `GET` | `/api/v1/hotels/{destination}` | Female-friendly hotels ranked by FFI |
| `POST` | `/api/v1/checkin/{trip_id}` | Safety check-in |
| `POST` | `/api/v1/feedback` | Submit community tips |
| `GET` | `/api/v1/community-tips/{destination}` | Community wisdom |

### Example: Plan a Trip

```bash
curl -X POST http://localhost:8000/api/v1/plan \
  -H "Content-Type: application/json" \
  -d '{
    "destination": "Bangkok, Thailand",
    "start_date": "2024-11-10",
    "end_date": "2024-11-17",
    "emergency_contact": "+1-555-0100"
  }'
```

---

## Agent Architecture

### Orchestrator (Gemini 1.5 Pro)
LangGraph `StateGraph` with parallel fan-out:
1. **parse_request** — geocode destination, generate trip ID
2. **[PARALLEL]** safety_check + hotel_search + community_lookup
3. **merge_results** — fan-in, combine all agent outputs
4. **build_schedule** — day-by-day safe itinerary
5. **final_rank** — apply safety guardrails
6. **store_db** — persist to Firestore

### Safety Guardrails
- `CRITICAL` threat → destination blocked, alternatives suggested
- `HIGH` threat → prominent warning, user acknowledgment required
- Hotels below FFI 4.0 filtered unless no alternatives
- Every itinerary day includes safe return time
- Emergency contacts always included

### Female Friendliness Index (FFI)
| Factor | Weight |
|---|---|
| Solo female positive reviews | 35% |
| Area safety score | 25% |
| Security features | 20% |
| Female staff / ownership | 10% |
| Emergency proximity | 10% |

---

## Tech Stack

- **AI**: Vertex AI Gemini 1.5 Pro (orchestrator) + Flash (sub-agents)
- **Workflow**: LangGraph StateGraph
- **Backend**: FastAPI + Python 3.11
- **Database**: Google Cloud Firestore
- **Tools**: Google Maps Platform, Google Custom Search, Google Calendar
- **Frontend**: React 18 + TypeScript + Vite + Tailwind CSS
- **Deployment**: Docker / Google Cloud Run

---

## Deployment (Google Cloud Run)

```bash
# Backend
gcloud run deploy safeher-api \
  --source ./backend \
  --region us-central1 \
  --set-env-vars GOOGLE_CLOUD_PROJECT=your-project

# Frontend (build + deploy to Firebase Hosting or Cloud Run)
cd frontend && npm run build
```

---

## Hackathon Demo Flow

1. User POSTs: `"Plan a solo trip to Bangkok, Nov 10-17"`
2. Orchestrator dispatches 3 agents **in parallel**
3. Safety agent → `MEDIUM` threat, night safety + transport flags
4. Accommodation agent → 5 ranked hotels, top-scored is female-owned guesthouse
5. Community agent → 8 tips from women who've traveled Bangkok
6. Schedule agent → safe-hours itinerary, avoids solo walking after 9pm, Calendar events
7. Final output: safety score **6.8/10**, risk flags, hotel list, check-in schedule
8. Stored to Firestore for community data loop

---

*SafeHer — Travel Safer, Travel Freer* 🛡️
