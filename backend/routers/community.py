from typing import Optional
from fastapi import APIRouter, HTTPException
from models.community import CommunityTip, TipCategory
from database.firestore import get_community_tips, get_all_community_tips

router = APIRouter()


@router.get("/api/v1/community-tips", response_model=list[CommunityTip])
async def get_all_tips_endpoint(category: Optional[str] = None):
    try:
        tips = await get_all_community_tips()
        if category:
            try:
                cat_enum = TipCategory(category.lower())
                tips = [t for t in tips if t.category == cat_enum]
            except ValueError:
                raise HTTPException(
                    status_code=400,
                    detail=f"Invalid category '{category}'. Valid options: {[c.value for c in TipCategory]}",
                )
        return tips
    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


@router.get("/api/v1/community-tips/{destination}", response_model=list[CommunityTip])
async def get_community_tips_endpoint(destination: str, category: Optional[str] = None):
    try:
        destination_id = destination.lower().strip().replace(" ", "_").replace(",", "")
        tips = await get_community_tips(destination_id)

        if category:
            try:
                cat_enum = TipCategory(category.lower())
                tips = [t for t in tips if t.category == cat_enum]
            except ValueError:
                raise HTTPException(
                    status_code=400,
                    detail=f"Invalid category '{category}'. Valid options: {[c.value for c in TipCategory]}",
                )

        tips.sort(key=lambda t: t.upvotes, reverse=True)
        return tips

    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))
