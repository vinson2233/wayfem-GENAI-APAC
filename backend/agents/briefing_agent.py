"""
Briefing Agent — generates a top-of-trip cheat sheet:
currency, cashless friendliness, climate, dress code, indoor/outdoor mix, do's & don'ts.

Runs in parallel with safety/accommodation/community agents during fan-out.
Uses structured output (Pydantic) on Gemini for reliable parsing.
"""

import logging
from typing import Optional

from langchain_google_genai import ChatGoogleGenerativeAI
from langchain_core.messages import HumanMessage, SystemMessage

from config import settings
from models.trip import TripBriefing
from events import get_emitter

logger = logging.getLogger(__name__)


_BRIEFING_SYSTEM = """You are a practical travel concierge writing a one-screen briefing for a FIRST-TIME solo female traveler.

Given a destination, dates, and a few search snippets, return a JSON object with:
- currency: e.g. "IDR — Indonesian Rupiah"
- cashless_friendly: "yes" | "mixed" | "cash_preferred"
- payment_notes: 1-2 short sentences. Mention specific apps/cards if relevant (e.g. "GoPay, OVO widely accepted in Bali; bring small cash for warungs and rural areas").
- climate_summary: temperature range + weather pattern for the trip dates, e.g. "Tropical, 26-32°C; expect afternoon thunderstorms in June".
- dress_code: practical packing/dressing advice. Mention modesty needs at religious sites, sun protection, layers if cool nights.
- indoor_outdoor_mix: "mostly_outdoor" | "balanced" | "mostly_indoor" — guess based on what tourists usually do at this destination at this time of year.
- dos: 3-5 imperative DO statements, specific to this destination & solo female travel (e.g. "Use Grab for late-night transit instead of street taxis").
- donts: 3-5 imperative DON'T statements, specific (e.g. "Don't enter temples in shorts or sleeveless tops — sarongs are required").
- scenarios: 3-5 "what if" role-plays — likely uncomfortable situations a first-time solo female traveler may face HERE specifically, with a concrete suggested response. Each:
  { "situation": "<one-line setup, e.g. 'A taxi driver says the meter is broken.'>",
    "response": "<2 short sentences of plain-English advice — what to say AND what to do>",
    "local_phrase": "<a useful local-language phrase or null>",
    "local_phrase_translation": "<English meaning + when to use, or null>" }
  Pick situations that are SPECIFIC to this destination — touts at this airport, scams in this neighbourhood, pressure at this temple. Avoid generic "trust your gut" platitudes.

Keep each line under 120 characters. Be CONCRETE — never vague platitudes.
Return ONLY valid JSON matching the schema."""


async def run_briefing_agent(
    destination: str,
    country: str,
    start_date: str,
    end_date: str,
    safety_search_snippets: list[dict],
) -> Optional[TripBriefing]:
    emitter = get_emitter()
    try:
        if emitter:
            emitter.agent_start("briefing")
            emitter.emit("briefing", f"Drafting trip briefing for {destination}…")

        # Compress snippets so we stay within the token budget
        snippets_text = "\n".join(
            f"- {r.get('title','')}: {r.get('snippet','')}"
            for r in safety_search_snippets[:10]
        )

        human = (
            f"Destination: {destination} ({country})\n"
            f"Dates: {start_date} → {end_date}\n\n"
            f"Search snippets:\n{snippets_text}\n\n"
            "Generate the JSON briefing."
        )

        llm = ChatGoogleGenerativeAI(
            google_api_key=settings.GEMINI_API_KEY,
            model="gemini-3-flash-preview",
            temperature=0.3,
            max_output_tokens=8192,
        )
        structured = llm.with_structured_output(TripBriefing)
        result: TripBriefing = await structured.ainvoke([
            SystemMessage(content=_BRIEFING_SYSTEM),
            HumanMessage(content=human),
        ])

        if emitter:
            emitter.emit("briefing", f"Briefing ready · {result.currency} · {len(result.dos)} dos, {len(result.donts)} don'ts")
            emitter.agent_complete("briefing", f"Briefing for {destination}")
        return result
    except Exception as e:
        logger.warning(f"Briefing agent failed for {destination}: {e}")
        if emitter:
            emitter.emit("briefing", f"Briefing unavailable: {e}")
            emitter.agent_complete("briefing", "Briefing skipped")
        return None
