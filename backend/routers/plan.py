import asyncio
import logging
from typing import Optional, Literal
from fastapi import APIRouter
from fastapi.responses import StreamingResponse
from pydantic import BaseModel, Field
from langchain_google_genai import ChatGoogleGenerativeAI
from langchain_core.messages import SystemMessage, HumanMessage
from models.trip import TripPlanRequest
from models.safety import SafetyReport
from agents.orchestrator import plan_trip as _plan_trip
from agents.schedule_agent import run_schedule_agent
from events import EventEmitter, set_emitter
from config import settings

router = APIRouter()
logger = logging.getLogger(__name__)


# ── Structured output schema ──────────────────────────────────────────────────

class ExtractedPreferences(BaseModel):
    pace: Optional[Literal["slow", "balanced", "packed"]] = None
    comfort_level: Optional[Literal["budget", "mid_range", "luxury"]] = None
    interests: list[str] = Field(default_factory=list)


class ClarifyQuestion(BaseModel):
    id: str = Field(description="Unique snake_case key, e.g. 'area_focus'")
    label: str = Field(description="Warm, specific question text")
    type: Literal["choice", "text"] = Field(
        description="'choice' for pill options, 'text' for freeform input"
    )
    multiple: bool = Field(
        default=False,
        description="True if the user may select more than one option (e.g. interests). False for single-select (pace, budget).",
    )
    options: list[str] = Field(
        default_factory=list,
        description="For type=choice: 3–5 short options. Empty for type=text.",
    )
    placeholder: Optional[str] = Field(
        default=None,
        description="For type=text: example answer, e.g. 'e.g. cooking class, avoid tourist traps'",
    )


class ClarifyResult(BaseModel):
    feasibility_issue: Optional[str] = Field(
        default=None,
        description="Non-null ONLY when the trip is clearly impossible (e.g. 10 cities in 2 days). One plain sentence explaining why.",
    )
    feasibility_suggestion: Optional[str] = Field(
        default=None,
        description="When feasibility_issue is set: one actionable fix, e.g. 'Try 2–3 cities for 7 days.'",
    )
    destination_refined: str = Field(
        default="",
        description="Short city + country ONLY, e.g. 'Bali, Indonesia'. Never the user's sentence.",
    )
    destination_was_vague: bool = Field(
        default=False,
        description="True if user gave a country/region rather than a specific city",
    )
    city_options: list[str] = Field(
        default_factory=list,
        description="4–6 cities if destination_was_vague, else empty",
    )
    cities: list[str] = Field(
        default_factory=list,
        description="All city stops the traveler mentioned, e.g. ['Tokyo', 'Kyoto']",
    )
    understood_summary: str = Field(
        default="",
        description="One warm sentence confirming what you understood from the description",
    )
    extracted_preferences: ExtractedPreferences = Field(default_factory=ExtractedPreferences)
    trip_questions: list[ClarifyQuestion] = Field(
        default_factory=list,
        description="2–4 personalisation questions for things NOT already stated",
    )


_CLARIFY_SYSTEM = """You are a warm, perceptive travel concierge for solo female travelers.

A user described their trip. Respond with a structured JSON object.

STEP 0 — Feasibility check (do this FIRST):
Count the trip days and destinations/cities the user wants.
If the plan is clearly physically impossible or absurd (NOT just ambitious), set:
  feasibility_issue: one plain sentence, e.g. "10 cities in 3 days leaves under 7 hours per city including travel — that's not a trip, it's a sprint."
  feasibility_suggestion: one concrete fix, e.g. "Pick 2–3 cities for 3 days, or extend to 10+ days for a fuller route."
Examples that ARE feasible (leave feasibility_issue null): 2 cities in 5 days, 3 cities in 10 days, 1 city in 2 days.
Examples that are NOT feasible: 8+ cities in 3 days, visiting cities on opposite sides of the world in 1 day, 20+ activities in 2 days.
When feasibility_issue is set, still fill the other fields as best you can — the user may refine.

STEP 1 — Parse destination:
- destination_refined: SHORT "City, Country" ONLY (e.g. "Bali, Indonesia"). NEVER the user's full sentence.
- If destination is a country/region (not a specific city) → destination_was_vague: true, city_options: 4–6 specific cities.
- cities: all city stops the user mentioned explicitly.

STEP 2 — understood_summary: one warm sentence confirming what you understood.

STEP 3 — ALWAYS generate EXACTLY 3–4 trip_questions. You MUST generate questions even if the user gave minimal info.

REQUIRED question categories (skip any the user ALREADY clearly stated):
A. Travel pace — skip only if user said slow/fast/relaxed/packed
   id: "pace", type: "choice", multiple: false, label: "What pace suits you best?"
   options: ["Slow & unhurried", "Balanced mix", "Fast-paced & packed"]

B. Accommodation style — skip only if user said budget/luxury/hostel/resort
   id: "accommodation_style", type: "choice", multiple: false, label: "Where do you picture yourself sleeping?"
   options: ["Budget-friendly guesthouse", "Mid-range boutique hotel", "Luxury resort or villa"]

C. Main interests — ALWAYS INCLUDE, DESTINATION-SPECIFIC, multiple: true (user picks all that apply)
   id: "main_focus", type: "choice", multiple: true, label: "What draws you there? Pick all that apply."
   options: 5–6 destination-specific interest options (e.g. for Bali: "Temples & spirituality", "Beach & surfing", "Wellness & yoga", "Jungle & nature", "Nightlife & social scene", "Food & local markets")

D. Freeform wishes — ALWAYS INCLUDE
   id: "special_wishes", type: "text", label: "Any experiences you'd love to include — or anything to avoid?"
   placeholder: destination-specific placeholder (e.g. "e.g. cooking class, skip crowded temples, no spicy food")

CRITICAL RULES:
- ALWAYS output exactly 3–4 questions in trip_questions. Never an empty list.
- choice questions MUST have 3–6 options. Never leave options empty.
- Keep option text SHORT (2–5 words each).
- multiple: true means the user can select several options simultaneously.
- Do NOT ask about things the user already clearly stated."""


class ClarifyRequest(BaseModel):
    description: str
    start_date: str
    end_date: str


_EMPTY_CLARIFY = {
    "feasibility_issue": None,
    "feasibility_suggestion": None,
    "destination_refined": "",
    "destination_was_vague": False,
    "city_options": [],
    "cities": [],
    "understood_summary": "",
    "extracted_preferences": {},
    "trip_questions": [],
}


@router.post("/api/v1/plan/clarify")
async def clarify_trip_endpoint(request: ClarifyRequest):
    try:
        llm = ChatGoogleGenerativeAI(
            google_api_key=settings.GEMINI_API_KEY,
            model="gemini-3-flash-preview",
            temperature=0.5,
            max_output_tokens=2048,
        )
        structured_llm = llm.with_structured_output(ClarifyResult)
        human = (
            f"Trip description: {request.description}\n"
            f"Travel dates: {request.start_date} to {request.end_date}\n"
            "Parse and generate the personalisation questions."
        )
        result: ClarifyResult = await structured_llm.ainvoke(
            [SystemMessage(content=_CLARIFY_SYSTEM), HumanMessage(content=human)]
        )
        data = result.model_dump()
        # Ensure cities has at least the primary destination
        if not data["cities"] and data["destination_refined"]:
            primary = data["destination_refined"].split(",")[0].strip()
            data["cities"] = [primary]
        return data
    except Exception as e:
        logger.error(f"clarify error: {e}")
        return _EMPTY_CLARIFY


@router.post("/api/v1/plan")
async def plan_trip_endpoint(request: TripPlanRequest):
    emitter = EventEmitter()

    async def run() -> None:
        set_emitter(emitter)
        try:
            result = await _plan_trip(request)
            emitter.complete(result.model_dump(mode="json"))
        except Exception as e:
            logger.error(f"plan_trip error: {e}")
            emitter.error(str(e))

    asyncio.create_task(run())

    return StreamingResponse(
        emitter.stream(),
        media_type="text/event-stream",
        headers={
            "Cache-Control": "no-cache",
            "X-Accel-Buffering": "no",
            "Connection": "keep-alive",
        },
    )


class RefineRequest(BaseModel):
    prompt: str
    destination: str
    start_date: str
    end_date: str
    safety_report: dict
    current_itinerary: list[dict]
    preferences: Optional[dict] = {}


@router.post("/api/v1/plan/refine")
async def refine_itinerary_endpoint(request: RefineRequest):
    emitter = EventEmitter()

    async def run() -> None:
        set_emitter(emitter)
        try:
            emitter.agent_start("schedule")
            safety_report = SafetyReport(**request.safety_report)
            days, _ = await run_schedule_agent(
                destination=request.destination,
                trip_id="refine",
                start_date=request.start_date,
                end_date=request.end_date,
                safety_report=safety_report,
                emergency_contact=None,
                preferences=request.preferences or {},
                refinement_prompt=request.prompt,
                current_itinerary=request.current_itinerary,
            )
            emitter.complete({"itinerary": [d.model_dump(mode="json") for d in days]})
        except Exception as e:
            logger.error(f"refine_itinerary error: {e}")
            emitter.error(str(e))

    asyncio.create_task(run())

    return StreamingResponse(
        emitter.stream(),
        media_type="text/event-stream",
        headers={
            "Cache-Control": "no-cache",
            "X-Accel-Buffering": "no",
            "Connection": "keep-alive",
        },
    )
