from datetime import datetime, timezone
from fastapi import APIRouter, HTTPException
from database.firestore import update_trip_checkin, get_trip

router = APIRouter()


@router.post("/api/v1/checkin/{trip_id}")
async def checkin(trip_id: str):
    try:
        trip = await get_trip(trip_id)
        if trip is None:
            raise HTTPException(status_code=404, detail=f"Trip '{trip_id}' not found.")

        await update_trip_checkin(trip_id)

        return {
            "status": "ok",
            "trip_id": trip_id,
            "checked_in_at": datetime.now(timezone.utc).isoformat(),
            "message": "Check-in recorded successfully. Stay safe! 💚",
        }
    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))
