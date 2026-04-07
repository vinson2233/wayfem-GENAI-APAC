from routers.plan import router as plan_router
from routers.safety import router as safety_router
from routers.hotels import router as hotels_router
from routers.checkin import router as checkin_router
from routers.feedback import router as feedback_router
from routers.community import router as community_router

__all__ = [
    "plan_router",
    "safety_router",
    "hotels_router",
    "checkin_router",
    "feedback_router",
    "community_router",
]
