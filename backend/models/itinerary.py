from pydantic import BaseModel
from typing import Optional


class ItineraryItem(BaseModel):
    time: str  # "09:00"
    activity: str
    location: str
    description: Optional[str] = None   # 1-2 sentence explanation of the activity
    image_query: Optional[str] = None   # short search keyword for Unsplash (e.g. "thai temple")
    safety_note: Optional[str] = None
    is_flagged: bool = False


class ItineraryDay(BaseModel):
    date: str
    day_number: int
    items: list[ItineraryItem]
    safe_return_time: str  # latest safe time to return to hotel
    daily_safety_tip: str
