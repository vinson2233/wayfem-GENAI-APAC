import logging
from typing import Optional
from datetime import datetime, timezone

from google.cloud import firestore
from google.oauth2 import service_account

from config import settings
from models.safety import SafetyReport
from models.hotel import Hotel
from models.community import CommunityTip

logger = logging.getLogger(__name__)

_client: Optional[firestore.AsyncClient] = None


def get_client() -> firestore.AsyncClient:
    global _client
    if _client is None:
        kwargs = {"project": settings.GOOGLE_CLOUD_PROJECT}
        if settings.GOOGLE_APPLICATION_CREDENTIALS:
            try:
                creds = service_account.Credentials.from_service_account_file(
                    settings.GOOGLE_APPLICATION_CREDENTIALS,
                    scopes=["https://www.googleapis.com/auth/cloud-platform"],
                )
                kwargs["credentials"] = creds
                logger.info(f"Firestore using service account: {settings.GOOGLE_APPLICATION_CREDENTIALS}")
            except Exception as e:
                logger.error(f"FAILED to load service account credentials from '{settings.GOOGLE_APPLICATION_CREDENTIALS}': {e}")
        else:
            logger.warning("GOOGLE_APPLICATION_CREDENTIALS not set — using default credentials")
        logger.info(f"Connecting to Firestore project: {settings.GOOGLE_CLOUD_PROJECT}")
        _client = firestore.AsyncClient(**kwargs)
    return _client


def _col(name: str) -> str:
    prefix = settings.FIRESTORE_COLLECTION_PREFIX
    return f"{prefix}{name}" if prefix else name


async def get_safety_report(destination_id: str) -> Optional[SafetyReport]:
    try:
        client = get_client()
        doc_ref = client.collection(_col("safety_reports")).document(destination_id)
        doc = await doc_ref.get()
        if doc.exists:
            return SafetyReport(**doc.to_dict())
        return None
    except Exception as e:
        logger.error(f"Error fetching safety report for {destination_id}: {e}")
        return None


async def save_safety_report(report: SafetyReport) -> None:
    try:
        client = get_client()
        doc_ref = client.collection(_col("safety_reports")).document(report.destination_id)
        data = report.model_dump()
        data["last_updated"] = datetime.now(timezone.utc)
        await doc_ref.set(data)
    except Exception as e:
        logger.error(f"Error saving safety report: {e}")


async def get_hotels(destination_id: str) -> list[Hotel]:
    try:
        client = get_client()
        col_ref = client.collection(_col("hotels"))
        query = col_ref.where(filter=firestore.FieldFilter("destination_id", "==", destination_id))
        docs = await query.get()
        return [Hotel(**doc.to_dict()) for doc in docs]
    except Exception as e:
        logger.error(f"Error fetching hotels for {destination_id}: {e}")
        return []


async def save_hotel(hotel: Hotel) -> None:
    try:
        client = get_client()
        doc_ref = client.collection(_col("hotels")).document(hotel.place_id)
        await doc_ref.set(hotel.model_dump())
    except Exception as e:
        logger.error(f"Error saving hotel {hotel.place_id}: {e}")


async def get_community_tips(destination_id: str) -> list[CommunityTip]:
    try:
        client = get_client()
        col_ref = client.collection(_col("community_tips"))
        query = col_ref.where(filter=firestore.FieldFilter("destination_id", "==", destination_id))
        docs = await query.get()
        tips = []
        for doc in docs:
            data = doc.to_dict()
            data["tip_id"] = doc.id
            tips.append(CommunityTip(**data))
        return tips
    except Exception as e:
        logger.error(f"Error fetching community tips for {destination_id}: {e}")
        return []


async def save_community_tip(tip: CommunityTip) -> None:
    try:
        client = get_client()
        col_ref = client.collection(_col("community_tips"))
        data = tip.model_dump(exclude={"tip_id"})
        if tip.created_at is None:
            data["created_at"] = datetime.now(timezone.utc)
        if tip.tip_id:
            await col_ref.document(tip.tip_id).set(data)
        else:
            await col_ref.add(data)
    except Exception as e:
        logger.error(f"Error saving community tip: {e}")


async def save_trip(trip_id: str, trip_data: dict) -> None:
    try:
        client = get_client()
        doc_ref = client.collection(_col("trips")).document(trip_id)
        trip_data["created_at"] = datetime.now(timezone.utc)
        await doc_ref.set(trip_data)
    except Exception as e:
        logger.error(f"Error saving trip {trip_id}: {e}")


async def get_trip(trip_id: str) -> Optional[dict]:
    try:
        client = get_client()
        doc_ref = client.collection(_col("trips")).document(trip_id)
        doc = await doc_ref.get()
        if doc.exists:
            return doc.to_dict()
        return None
    except Exception as e:
        logger.error(f"Error fetching trip {trip_id}: {e}")
        return None


async def update_trip_checkin(trip_id: str) -> None:
    try:
        client = get_client()
        doc_ref = client.collection(_col("trips")).document(trip_id)
        await doc_ref.update({"last_checkin": datetime.now(timezone.utc)})
    except Exception as e:
        logger.error(f"Error updating checkin for trip {trip_id}: {e}")
