from datetime import datetime, timezone, timedelta
from fastapi import APIRouter, HTTPException
from models.safety import SafetyReport
from database.firestore import get_safety_report, save_safety_report
from agents.safety_agent import run_safety_agent
from tools.maps_tool import geocode_destination
from tools.search_tool import search_travel_safety, search_travel_advisory
import asyncio

router = APIRouter()

CACHE_TTL_HOURS = 24


@router.get("/api/v1/safety/{destination}", response_model=SafetyReport)
async def get_safety_report_endpoint(destination: str):
    try:
        destination_id = destination.lower().strip().replace(" ", "_").replace(",", "")
        cached = await get_safety_report(destination_id)

        if cached and cached.last_updated:
            age = datetime.now(timezone.utc) - cached.last_updated.replace(tzinfo=timezone.utc) if cached.last_updated.tzinfo is None else datetime.now(timezone.utc) - cached.last_updated
            if age < timedelta(hours=CACHE_TTL_HOURS):
                return cached

        geo = geocode_destination(destination)
        safety_results, advisory_results = await asyncio.gather(
            search_travel_safety(destination),
            search_travel_advisory(destination),
        )
        search_results = safety_results + advisory_results

        report = await run_safety_agent(
            destination=destination,
            destination_id=destination_id,
            city=geo.get("city", destination),
            country=geo.get("country", ""),
            search_results=search_results,
        )

        await save_safety_report(report)
        return report

    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))
