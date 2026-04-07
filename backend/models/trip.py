from pydantic import BaseModel
from typing import Optional
from datetime import datetime

from models.hotel import Hotel
from models.safety import SafetyReport
from models.itinerary import ItineraryDay


class TripPlanRequest(BaseModel):
    destination: str
    start_date: str  # ISO date "2024-11-10"
    end_date: str
    preferences: Optional[dict] = {}
    emergency_contact: Optional[str] = None
    user_id: Optional[str] = None


class TripPlanResponse(BaseModel):
    trip_id: str
    destination: str
    overall_safety_score: float
    risk_flags: list[str]
    hotels: list[Hotel]
    itinerary: list[ItineraryDay]
    emergency_contacts: dict
    community_tips: list[str]
    safety_report: SafetyReport
    created_at: datetime
