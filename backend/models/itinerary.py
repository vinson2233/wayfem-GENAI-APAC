from __future__ import annotations
from pydantic import BaseModel
from typing import Optional, Literal


class TransportOption(BaseModel):
    """How to get to this activity from the previous one."""
    mode: Literal["walking", "transit", "driving", "rideshare"]
    duration_min: int
    cost_estimate: Optional[str] = None      # "~Rp 25,000" or "~$3-5"
    app_name: Optional[str] = None           # "Grab", "Gojek", "Uber"
    safety_note: Optional[str] = None        # "Use the in-app verified driver only"


class ItineraryItem(BaseModel):
    time: str  # "09:00"
    activity: str
    location: str
    place_id: Optional[str] = None  # Google Maps place_id for directions link
    description: Optional[str] = None
    image_query: Optional[str] = None
    safety_note: Optional[str] = None
    is_flagged: bool = False
    travel_time_minutes: Optional[int] = None  # travel time from previous activity to reach this one
    transport_to_next: Optional[TransportOption] = None  # transport from this item to the next
    estimated_cost: Optional[float] = None    # per-person, in local currency
    cost_currency: Optional[str] = None       # ISO code, e.g. "IDR", "USD"
    alternatives: Optional[list[ItineraryItem]] = None  # swap options for cultural/food stops


ItineraryItem.model_rebuild()


class NightTransportPlan(BaseModel):
    mode: str                          # e.g. "rideshare_app", "metro", "taxi", "walking", "tuk_tuk"
    app_name: Optional[str] = None     # specific app e.g. "Grab", "Bolt", "Uber"
    estimated_cost: Optional[str] = None  # e.g. "฿80–120", "€5–8", "free"
    safety_tip: str                    # actionable advice for this specific return journey
    avoid: Optional[str] = None        # what to avoid e.g. "unlicensed taxis near the venue"


class ItineraryDay(BaseModel):
    date: str
    day_number: int
    items: list[ItineraryItem]
    safe_return_time: str  # latest safe time to return to hotel
    daily_safety_tip: str
    day_summary: Optional[str] = None  # AI narrative overview of the day's theme and vibe
    night_transport: Optional[NightTransportPlan] = None
    daily_cost_estimate: Optional[float] = None  # sum of items' costs for this day (local currency)
