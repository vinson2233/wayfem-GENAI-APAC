from fastapi import APIRouter, HTTPException
from models.trip import TripPlanRequest, TripPlanResponse
from agents.orchestrator import plan_trip as _plan_trip

router = APIRouter()


@router.post("/api/v1/plan", response_model=TripPlanResponse)
async def plan_trip_endpoint(request: TripPlanRequest):
    try:
        return await _plan_trip(request)
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))
