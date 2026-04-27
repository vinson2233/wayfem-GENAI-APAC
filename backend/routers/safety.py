from datetime import datetime, timezone, timedelta
from fastapi import APIRouter, HTTPException
from models.safety import SafetyReport
from database.firestore import get_safety_report, save_safety_report
from agents.safety_agent import run_safety_agent
from tools.maps_tool import geocode_destination, get_area_safety_info
from tools.search_tool import (
    search_travel_safety,
    search_travel_advisory,
    search_emergency_numbers,
    search_recent_incidents,
    search_crisis_directory,
)
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
        country = geo.get("country", "")
        city = geo.get("city", destination)
        lat = geo.get("lat", 0.0)
        lng = geo.get("lng", 0.0)
        # Run searches + area-safety lookup in parallel
        (
            safety_results,
            advisory_results,
            emergency_results,
            recent_incidents_raw,
            crisis_directory_raw,
            area_safety,
        ) = await asyncio.gather(
            search_travel_safety(destination),
            search_travel_advisory(destination),
            search_emergency_numbers(country, city),
            search_recent_incidents(destination),
            search_crisis_directory(country, city),
            asyncio.get_event_loop().run_in_executor(None, get_area_safety_info, lat, lng),
        )
        for r in (emergency_results or []):
            r["_emergency_source"] = True
        for r in (recent_incidents_raw or []):
            r["_recent_incidents"] = True
        for r in (crisis_directory_raw or []):
            r["_crisis_directory"] = True
        search_results = (
            safety_results
            + advisory_results
            + (emergency_results or [])
            + (recent_incidents_raw or [])
            + (crisis_directory_raw or [])
        )

        report = await run_safety_agent(
            destination=destination,
            destination_id=destination_id,
            city=city,
            country=country,
            search_results=search_results,
            area_safety=area_safety,
        )

        await save_safety_report(report)
        return report

    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))
