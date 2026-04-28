from pydantic import BaseModel
from typing import Optional, Literal
from datetime import datetime

from models.hotel import Hotel
from models.safety import SafetyReport
from models.itinerary import ItineraryDay
from models.community import CommunityTip


class WhatIfScenario(BaseModel):
    """Pre-trip rehearsal for first-time solo travelers — a likely-uncomfortable
    situation paired with a concrete suggested response and a useful local phrase."""
    situation: str                  # "A taxi driver says the meter is broken."
    response: str                   # 1-2 sentences of plain-English advice
    local_phrase: Optional[str] = None
    local_phrase_translation: Optional[str] = None


class TripBriefing(BaseModel):
    currency: str                   # "IDR — Indonesian Rupiah"
    cashless_friendly: Literal["yes", "mixed", "cash_preferred"]
    payment_notes: str              # "GoPay/OVO widely used; carry small cash for warungs"
    climate_summary: str            # "Tropical, 26-32°C, frequent afternoon showers in June"
    dress_code: str                 # "Light layers; modest cover for temples"
    indoor_outdoor_mix: Literal["mostly_outdoor", "balanced", "mostly_indoor"]
    dos: list[str]                  # 3-5 short imperative tips
    donts: list[str]                # 3-5 short imperative tips
    scenarios: list[WhatIfScenario] = []  # 3-5 destination-specific role-plays


class TripPlanRequest(BaseModel):
    destination: str
    start_date: str  # ISO date "2024-11-10"
    end_date: str
    preferences: Optional[dict] = {}
    emergency_contact: Optional[str] = None
    user_id: Optional[str] = None
    cities: Optional[list[str]] = None  # explicit city list for multi-city trips


class TripPlanResponse(BaseModel):
    trip_id: str
    destination: str
    overall_safety_score: float
    risk_flags: list[str]
    hotels: list[Hotel]
    itinerary: list[ItineraryDay]
    emergency_contacts: dict
    community_tips: list[CommunityTip]
    safety_report: SafetyReport
    briefing: Optional[TripBriefing] = None
    total_cost_estimate: Optional[float] = None  # sum of itinerary daily totals (per person)
    cost_currency: Optional[str] = None          # ISO code matching itinerary item currencies
    created_at: datetime
