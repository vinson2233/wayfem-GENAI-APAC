from typing import Optional
from datetime import datetime, timezone
from fastapi import APIRouter, HTTPException
from pydantic import BaseModel
from models.community import CommunityTip, TipCategory
from database.firestore import save_community_tip, get_trip, save_trip

router = APIRouter()


class FeedbackRequest(BaseModel):
    trip_id: str
    tips: list[str]
    hotel_rating: Optional[float] = None
    overall_rating: Optional[float] = None
    destination: Optional[str] = None


@router.post("/api/v1/feedback")
async def submit_feedback(feedback: FeedbackRequest):
    try:
        trip = await get_trip(feedback.trip_id)
        destination = feedback.destination or (trip.get("destination", "unknown") if trip else "unknown")
        destination_id = destination.lower().strip().replace(" ", "_").replace(",", "")

        saved_tips = []
        for tip_text in feedback.tips:
            if tip_text.strip():
                tip = CommunityTip(
                    destination_id=destination_id,
                    author_alias="SafeHer Traveler",
                    tip=tip_text.strip(),
                    category=TipCategory.GENERAL,
                    upvotes=0,
                    created_at=datetime.now(timezone.utc),
                )
                try:
                    await save_community_tip(tip)
                    saved_tips.append(tip_text)
                except Exception:
                    pass

        if trip is not None:
            update_data = dict(trip)
            update_data["status"] = "completed"
            update_data["completed_at"] = datetime.now(timezone.utc).isoformat()
            if feedback.hotel_rating is not None:
                update_data["hotel_rating"] = feedback.hotel_rating
            if feedback.overall_rating is not None:
                update_data["overall_rating"] = feedback.overall_rating
            await save_trip(feedback.trip_id, update_data)

        return {
            "status": "ok",
            "trip_id": feedback.trip_id,
            "tips_saved": len(saved_tips),
            "message": "Thank you for your feedback! Your tips help keep other travelers safe. 💚",
        }
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))
