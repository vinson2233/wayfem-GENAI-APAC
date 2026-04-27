import httpx
import logging
from fastapi import APIRouter, Query, HTTPException
from config import settings

router = APIRouter()
logger = logging.getLogger(__name__)

# Simple in-memory cache — avoids re-hitting Serper for the same query within a session
_cache: dict[str, str] = {}

_VALID_EXTS = (".jpg", ".jpeg", ".png", ".webp")


def _pick_best(images: list[dict]) -> str | None:
    # Prefer images whose URLs end in a known image extension
    for img in images:
        url = img.get("imageUrl", "")
        if url and any(url.lower().split("?")[0].endswith(ext) for ext in _VALID_EXTS):
            return url
    # Fall back to any imageUrl, then thumbnailUrl
    for img in images:
        url = img.get("imageUrl") or img.get("thumbnailUrl")
        if url:
            return url
    return None


@router.get("/api/v1/place-photo")
async def get_place_photo(q: str = Query(..., description="Place name + city, e.g. 'Senso-ji Temple Tokyo'")):
    if q in _cache:
        return {"url": _cache[q]}

    if not settings.SERPER_API_KEY:
        raise HTTPException(503, "Image search not configured")

    try:
        async with httpx.AsyncClient(timeout=8.0) as client:
            resp = await client.post(
                "https://google.serper.dev/images",
                headers={"X-API-KEY": settings.SERPER_API_KEY, "Content-Type": "application/json"},
                json={"q": q, "num": 8},
            )
        if resp.status_code != 200:
            logger.warning(f"Serper images returned {resp.status_code} for query: {q}")
            raise HTTPException(502, "Image search failed")

        images = resp.json().get("images", [])
        url = _pick_best(images)
        if not url:
            raise HTTPException(404, "No image found")

        _cache[q] = url
        return {"url": url}

    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"place-photo error for '{q}': {e}")
        raise HTTPException(500, str(e))
