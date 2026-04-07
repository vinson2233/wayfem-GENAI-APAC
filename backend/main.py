from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from fastapi.staticfiles import StaticFiles
from fastapi.responses import FileResponse
import os

from config import settings
from routers.plan import router as plan_router
from routers.safety import router as safety_router
from routers.hotels import router as hotels_router
from routers.checkin import router as checkin_router
from routers.feedback import router as feedback_router
from routers.community import router as community_router

app = FastAPI(
    title="Wayfem Travel Planner API",
    description="Multi-agent AI system for women's safety-first travel planning",
    version="1.0.0",
)

app.add_middleware(
    CORSMiddleware,
    allow_origins=settings.CORS_ORIGINS,
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

app.include_router(plan_router)
app.include_router(safety_router)
app.include_router(hotels_router)
app.include_router(checkin_router)
app.include_router(feedback_router)
app.include_router(community_router)


@app.get("/health")
def health():
    return {"status": "ok", "service": "Wayfem API"}


# Serve frontend static files if the dist directory exists (production build)
_FRONTEND_DIST = os.path.join(os.path.dirname(__file__), "frontend_dist")
if os.path.isdir(_FRONTEND_DIST):
    app.mount("/assets", StaticFiles(directory=os.path.join(_FRONTEND_DIST, "assets")), name="assets")

    @app.get("/{full_path:path}", include_in_schema=False)
    def serve_spa(full_path: str):
        # Serve index.html for all non-API routes (SPA client-side routing)
        return FileResponse(os.path.join(_FRONTEND_DIST, "index.html"))
