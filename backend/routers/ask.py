"""
Ask Wayfem — destination-grounded chat for first-time solo female travelers.

The frontend sends a question + a compact `trip_context` blob (safety report,
briefing, top community tips, current itinerary). The endpoint adds a focused
system prompt, calls Gemini, and returns a short, practical answer.

Stateless on the server — conversation history is sent in the request and
stored in the user's localStorage.
"""

import logging
from typing import Optional, Literal

from fastapi import APIRouter, HTTPException
from pydantic import BaseModel, Field
from langchain_google_genai import ChatGoogleGenerativeAI
from langchain_core.messages import HumanMessage, SystemMessage, AIMessage

from config import settings

logger = logging.getLogger(__name__)
router = APIRouter()


class AskMessage(BaseModel):
    role: Literal["user", "assistant"]
    content: str


class AskRequest(BaseModel):
    question: str = Field(min_length=1, max_length=500)
    destination: str
    # Compact context built by the frontend — see _format_context for fields used.
    trip_context: dict = Field(default_factory=dict)
    history: list[AskMessage] = Field(default_factory=list, max_length=12)


class AskResponse(BaseModel):
    answer: str


_ASK_SYSTEM = """You are Wayfem — a warm, practical travel companion for solo female travelers.
The user is a first-time solo traveler asking a question about THEIR trip.

You are given a CONTEXT block summarising what they're planning: destination, threat level,
safety flags, briefing facts (currency, dress code, do's & don'ts), community tips, and
itinerary stops. Ground your answer in that context — don't invent things outside it.

Tone:
- Warm but direct. Talk like a friend who's been there, not a brochure.
- 2–4 short sentences. Never lecture. Never list more than 3 items.
- If the user is anxious, acknowledge briefly then give concrete advice.
- If a community tip or briefing line directly answers the question, paraphrase it
  (don't quote verbatim) and mention it came from "your community tips" or "the briefing"
  — this builds trust in the data.

When you cannot answer well from the context:
- Say so plainly. Don't fabricate hotel names, prices, or street directions.
- Suggest one concrete next step (e.g. "Ask your hotel reception" / "Check the Reddit thread
  linked in your community tab").

NEVER:
- Promise safety. Never say "you'll be fine."
- Discuss self-harm, weapons, or anything outside travel.
- Give medical or legal advice — refer to professionals."""


def _format_context(trip_context: dict) -> str:
    """Build a compact, single-page context block from the frontend's tripData summary."""
    lines: list[str] = []

    sr = trip_context.get("safety_report") or {}
    if sr:
        lines.append(
            f"DESTINATION: {sr.get('city', '')}, {sr.get('country', '')} — "
            f"threat level {sr.get('threat_level', 'UNKNOWN')} "
            f"(score {sr.get('overall_score', 'n/a')}/10)"
        )
        if sr.get("summary"):
            lines.append(f"SAFETY SUMMARY: {sr['summary']}")
        flags = sr.get("flags") or []
        if flags:
            lines.append("SAFETY FLAGS: " + " | ".join(flags[:6]))
        emergency = sr.get("emergency_number")
        if emergency:
            lines.append(f"EMERGENCY: {emergency}")
        if sr.get("local_laws_notes"):
            lines.append(f"LOCAL LAWS: {sr['local_laws_notes']}")
        if sr.get("women_health_notes"):
            lines.append(f"WOMEN'S HEALTH: {sr['women_health_notes']}")
        cn = sr.get("cultural_notes") or []
        if cn:
            lines.append("CULTURAL NOTES: " + " · ".join(cn[:4]))
        recent = sr.get("recent_incidents") or []
        if recent:
            preview = " | ".join(
                f"[{i.get('severity','info').upper()}] {i.get('date','recent')}: {i.get('summary','')}"
                for i in recent[:4]
            )
            lines.append(f"RECENT INCIDENTS: {preview}")

    briefing = trip_context.get("briefing") or {}
    if briefing:
        if briefing.get("currency"):
            lines.append(
                f"CURRENCY: {briefing['currency']} — "
                f"{briefing.get('cashless_friendly', '')}; {briefing.get('payment_notes', '')}"
            )
        if briefing.get("climate_summary"):
            lines.append(f"CLIMATE: {briefing['climate_summary']}")
        if briefing.get("dress_code"):
            lines.append(f"DRESS CODE: {briefing['dress_code']}")
        dos = briefing.get("dos") or []
        donts = briefing.get("donts") or []
        if dos:
            lines.append("DO: " + " · ".join(dos[:5]))
        if donts:
            lines.append("DON'T: " + " · ".join(donts[:5]))

    tips = trip_context.get("community_tips") or []
    if tips:
        # Top 5 by upvotes already; just take first 5
        for t in tips[:5]:
            src = "Reddit" if t.get("source") == "reddit" else "Community"
            lines.append(
                f"TIP ({src}, {t.get('category', 'general')}): "
                f"{t.get('tip', '')} — {t.get('author_alias', '')}"
            )

    itinerary = trip_context.get("itinerary") or []
    if itinerary:
        first_day = itinerary[0]
        items = first_day.get("items") or []
        if items:
            preview = " → ".join(f"{it.get('time','')} {it.get('activity','')}" for it in items[:5])
            lines.append(
                f"DAY 1 ITINERARY ({first_day.get('date', '')}): {preview}"
            )

    return "\n".join(lines) or "(no trip context provided)"


@router.post("/api/v1/ask", response_model=AskResponse)
async def ask_wayfem(req: AskRequest):
    try:
        if not settings.GEMINI_API_KEY:
            raise HTTPException(status_code=503, detail="LLM not configured")

        context_block = _format_context(req.trip_context)
        human_prompt = (
            f"CONTEXT (the user's planned trip):\n{context_block}\n\n"
            f"QUESTION: {req.question.strip()}"
        )

        messages: list = [SystemMessage(content=_ASK_SYSTEM)]
        # Replay short conversation history so the model stays coherent
        for m in req.history[-10:]:
            if m.role == "user":
                messages.append(HumanMessage(content=m.content))
            else:
                messages.append(AIMessage(content=m.content))
        messages.append(HumanMessage(content=human_prompt))

        llm = ChatGoogleGenerativeAI(
            google_api_key=settings.GEMINI_API_KEY,
            model="gemini-3-flash-preview",
            temperature=0.4,
            max_tokens=1024,
        )
        response = await llm.ainvoke(messages)

        # Robust content extraction across str / list[dict] / list[block]
        content = response.content
        if isinstance(content, str):
            text = content
        elif isinstance(content, list):
            parts: list[str] = []
            for item in content:
                if isinstance(item, dict):
                    parts.append(item.get("text", ""))
                elif hasattr(item, "text"):
                    parts.append(getattr(item, "text", ""))
            text = "".join(parts)
        else:
            text = str(content)

        return AskResponse(answer=text.strip() or "I couldn't generate an answer just now. Try again in a moment.")

    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"ask_wayfem error: {e}")
        raise HTTPException(status_code=500, detail=str(e))
