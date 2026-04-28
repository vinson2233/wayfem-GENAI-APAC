from enum import Enum
from pydantic import BaseModel
from typing import Optional
from datetime import datetime


class ThreatLevel(str, Enum):
    LOW = "LOW"
    MEDIUM = "MEDIUM"
    HIGH = "HIGH"
    CRITICAL = "CRITICAL"


class NearbyPlace(BaseModel):
    name: str
    address: str
    place_id: Optional[str] = None
    distance_meters: Optional[int] = None
    phone: Optional[str] = None


class RecentIncident(BaseModel):
    """A timestamped, sourced safety event near the destination — surfaced
    differently from evergreen flags so users see live context, not history."""
    date: str                      # human-readable e.g. "3 days ago" or "2026-04-12"
    summary: str                   # 1 sentence
    source_url: str                # full URL of the article/post
    severity: str                  # "info" | "caution" | "alert"


class CrisisContact(BaseModel):
    """Specific hotlines and resources for emergencies — extends the generic
    emergency_number with women-focused and travel-focused contacts."""
    label: str                     # e.g. "Women's crisis line", "Tourist police"
    kind: str                      # "women_crisis" | "sexual_assault" | "tourist_police" | "embassy" | "other"
    phone: Optional[str] = None
    website: Optional[str] = None
    notes: Optional[str] = None    # hours, language, eligibility


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
    cultural_notes: list[str] = []
    local_safe_phrases: dict[str, str] = {}  # phrase (local language) → translation + context
    women_health_notes: str = ""
    nearest_police: Optional[NearbyPlace] = None
    nearest_hospital: Optional[NearbyPlace] = None
    recent_incidents: list[RecentIncident] = []
    crisis_contacts: list[CrisisContact] = []
