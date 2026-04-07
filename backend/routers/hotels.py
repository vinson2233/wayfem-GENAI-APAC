from typing import Optional
from fastapi import APIRouter, HTTPException
from models.hotel import Hotel
from database.firestore import get_hotels, save_hotel
from agents.accommodation_agent import run_accommodation_agent
from tools.maps_tool import geocode_destination, search_hotels_nearby, get_place_details, get_area_safety_info
from tools.search_tool import search_hotel_reviews
import asyncio

router = APIRouter()


@router.get("/api/v1/hotels/{destination}", response_model=list[Hotel])
async def get_hotels_endpoint(
    destination: str,
    min_score: float = 0.0,
    max_price: Optional[float] = None,
    features: Optional[str] = None,
):
    try:
        destination_id = destination.lower().strip().replace(" ", "_").replace(",", "")

        cached = await get_hotels(destination_id)
        if cached:
            hotels = cached
        else:
            geo = geocode_destination(destination)

            hotels_raw = await asyncio.get_event_loop().run_in_executor(
                None, search_hotels_nearby, destination, 10
            )
            area_safety = await asyncio.get_event_loop().run_in_executor(
                None, get_area_safety_info, geo.get("lat", 0.0), geo.get("lng", 0.0)
            )

            for hotel in hotels_raw:
                place_id = hotel.get("place_id", "")
                if place_id:
                    try:
                        details = await asyncio.get_event_loop().run_in_executor(
                            None, get_place_details, place_id
                        )
                        hotel["details"] = details
                    except Exception:
                        hotel["details"] = {}

            review_tasks = [
                search_hotel_reviews(h.get("name", ""), destination)
                for h in hotels_raw[:5]
            ]
            review_nested = await asyncio.gather(*review_tasks, return_exceptions=True)
            review_results = []
            for result in review_nested:
                if isinstance(result, list):
                    review_results.extend(result)

            hotels = await run_accommodation_agent(
                destination=destination,
                destination_id=destination_id,
                hotels_raw=hotels_raw,
                review_results=review_results,
                area_safety=area_safety,
            )

            for hotel in hotels:
                try:
                    await save_hotel(hotel)
                except Exception:
                    pass

        filtered = [h for h in hotels if h.female_friendliness_score >= min_score]

        if max_price is not None:
            filtered = [h for h in filtered if h.price_per_night is None or h.price_per_night <= max_price]

        if features:
            requested_features = [f.strip().lower() for f in features.split(",")]
            filtered = [
                h for h in filtered
                if any(
                    feat in " ".join(h.security_features).lower()
                    for feat in requested_features
                )
            ]

        filtered.sort(key=lambda h: h.female_friendliness_score, reverse=True)
        return filtered

    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))
