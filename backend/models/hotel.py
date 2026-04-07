from pydantic import BaseModel
from typing import Optional


class Hotel(BaseModel):
    place_id: str
    name: str
    destination_id: str
    female_friendliness_score: float  # 0-10
    solo_female_reviews_count: int
    positive_mentions: list[str]
    negative_mentions: list[str]
    owner_female: Optional[bool] = None
    area_safety_score: float
    security_features: list[str]
    price_per_night: Optional[float] = None
    currency: str = "USD"
    address: str
    rating: float
    image_url: Optional[str] = None
    booking_url: Optional[str] = None


class HotelSearchResult(BaseModel):
    destination_id: str
    hotels: list[Hotel]
    total_count: int
    filters_applied: dict = {}
