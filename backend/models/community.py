from enum import Enum
from pydantic import BaseModel
from typing import Optional
from datetime import datetime


class TipCategory(str, Enum):
    TRANSPORT = "transport"
    ACCOMMODATION = "accommodation"
    FOOD = "food"
    NIGHTLIFE = "nightlife"
    EMERGENCY = "emergency"
    GENERAL = "general"


class CommunityTip(BaseModel):
    tip_id: Optional[str] = None
    destination_id: str
    author_alias: str
    tip: str
    category: TipCategory
    upvotes: int = 0
    created_at: Optional[datetime] = None
