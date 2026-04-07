from enum import Enum
from pydantic import BaseModel
from typing import Optional
from datetime import datetime


class ThreatLevel(str, Enum):
    LOW = "LOW"
    MEDIUM = "MEDIUM"
    HIGH = "HIGH"
    CRITICAL = "CRITICAL"


class SafetyReport(BaseModel):
    destination_id: str
    country: str
    city: str
    threat_level: ThreatLevel
    last_updated: Optional[datetime] = None
    flags: list[str] = []
    flag_sources: list[str] = []  # source URLs/names paired with flags
    night_safety: bool
    transportation_safe: bool
    local_laws_notes: str
    emergency_number: str
    overall_score: float  # 0-10
    summary: str
