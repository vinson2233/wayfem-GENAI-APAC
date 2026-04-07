import json
import logging
from datetime import datetime, timezone

from langchain_google_genai import ChatGoogleGenerativeAI
from langchain_core.messages import HumanMessage, SystemMessage

from config import settings
from models.community import CommunityTip, TipCategory
from database.firestore import get_community_tips, save_community_tip

logger = logging.getLogger(__name__)

SYSTEM_PROMPT = """You are the SafeHer Community Agent. Your task is to generate helpful, 
realistic travel tips for solo female travelers visiting a specific destination.

Generate exactly 8 practical, specific tips covering a range of categories:
- transport: Getting around safely
- accommodation: Staying safe at hotels/hostels
- food: Dining safely as a solo woman
- nightlife: Evening safety (if applicable)
- emergency: Emergency preparedness
- general: General solo female travel wisdom for this destination

Return a JSON array of tip objects, each with:
{
  "author_alias": "TravelerAlias",  (use creative names like "Sarah_Adventurer", "NomadNadia", etc.)
  "tip": "string",
  "category": "transport|accommodation|food|nightlife|emergency|general"
}

Return ONLY valid JSON array. Tips should be specific to the destination, practical, and actionable."""



async def run_community_agent(destination_id: str, destination: str) -> list[str]:
    try:
        existing_tips = await get_community_tips(destination_id)

        if len(existing_tips) >= 5:
            sorted_tips = sorted(existing_tips, key=lambda t: t.upvotes, reverse=True)
            return [t.tip for t in sorted_tips[:8]]

        human_content = (
            f"Destination: {destination}\n\n"
            "Generate 8 practical safety tips for solo female travelers visiting this destination. "
            "Make them specific, actionable, and based on realistic knowledge of this location."
        )

        llm = ChatGoogleGenerativeAI(google_api_key=settings.GEMINI_API_KEY, model="gemini-3.1-flash-lite-preview", temperature=0.4, max_tokens=2048)
        messages = [
            SystemMessage(content=SYSTEM_PROMPT),
            HumanMessage(content=human_content),
        ]

        response = await llm.ainvoke(messages)
        raw = (response.content if isinstance(response.content, str) else response.content[0].get("text", "") if isinstance(response.content, list) else str(response.content)).strip()

        if raw.startswith("```"):
            raw = raw.split("```")[1]
            if raw.startswith("json"):
                raw = raw[4:]
            raw = raw.strip()

        tips_data = json.loads(raw)
        tip_strings = []

        for tip_obj in tips_data:
            if not isinstance(tip_obj, dict):
                continue

            category_str = tip_obj.get("category", "general")
            try:
                category = TipCategory(category_str)
            except ValueError:
                category = TipCategory.GENERAL

            tip = CommunityTip(
                destination_id=destination_id,
                author_alias=tip_obj.get("author_alias", "SafeHer Community"),
                tip=tip_obj.get("tip", ""),
                category=category,
                upvotes=0,
                created_at=datetime.now(timezone.utc),
            )

            try:
                await save_community_tip(tip)
            except Exception as save_err:
                logger.warning(f"Could not save community tip: {save_err}")

            tip_strings.append(tip.tip)

        return tip_strings[:8]

    except Exception as e:
        logger.error(f"Community agent error for '{destination}': {e}")
        return [
            f"Research {destination}'s local customs and dress codes before arrival.",
            "Share your itinerary with a trusted contact back home.",
            "Keep emergency numbers saved offline in your phone.",
            "Use reputable transportation apps rather than hailing cabs on the street.",
            "Stay in well-reviewed, centrally-located accommodations.",
            "Trust your instincts — if something feels wrong, leave the situation.",
            "Connect with other female travelers through online forums before your trip.",
            "Keep a photocopy of your passport and travel documents in a secure location.",
        ]
