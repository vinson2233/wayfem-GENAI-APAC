import json
import logging
from datetime import datetime, timezone

from langchain_google_genai import ChatGoogleGenerativeAI
from langchain_core.messages import HumanMessage, SystemMessage

from config import settings
from models.community import CommunityTip, TipCategory
from database.firestore import get_community_tips, save_community_tip
from events import get_emitter
from tools.reddit_tool import fetch_reddit_tips_for_destination, reddit_url

logger = logging.getLogger(__name__)

SYSTEM_PROMPT = """You are the SafeHer Community Agent. Your job is to surface
practical, specific travel tips for solo female travelers visiting a destination.

You may receive a CONTEXT block containing Reddit posts from r/solofemaletravellers
and r/femaletravels. When a useful tip can be DISTILLED from a Reddit post,
prefer that — set source="reddit" and copy the post_index so we can attach the
real Reddit URL and original author. Otherwise, draw on general knowledge and
set source="ai".

Generate up to 8 tips covering a range of categories:
- transport: Getting around safely
- accommodation: Staying safe at hotels/hostels
- food: Dining safely as a solo woman
- nightlife: Evening safety (if applicable)
- emergency: Emergency preparedness
- general: General solo female travel wisdom for this destination

Return a JSON array of tip objects, each with:
{
  "author_alias": "TravelerAlias",   // for source="reddit" use "u/<reddit_author>"; for source="ai" pick a creative name like "Sarah_Adventurer"
  "tip": "string",                   // 1-2 sentences, paraphrase Reddit content (don't copy verbatim)
  "category": "transport|accommodation|food|nightlife|emergency|general",
  "location": "string or null",      // specific district/landmark if relevant, else null
  "source": "reddit" | "ai",
  "post_index": null | <integer>,    // 0-based index into the Reddit CONTEXT array (required when source=reddit)
  "upvotes": <integer>               // for source=reddit copy the post score; for source=ai use 0
}

Rules:
- Prefer Reddit-sourced tips when CONTEXT contains useful information (aim for ~5 of 8).
- Never invent a "post_index" that doesn't exist in CONTEXT.
- Paraphrase — never quote a Reddit post longer than 15 words verbatim.
- Tips must be specific and actionable. Discard vague platitudes.

Return ONLY valid JSON array."""



async def run_community_agent(destination_id: str, destination: str) -> list[CommunityTip]:
    emitter = get_emitter()
    try:
        if emitter:
            emitter.emit("community", f"Checking database for {destination} tips…")
        existing_tips = await get_community_tips(destination_id)

        if len(existing_tips) >= 5:
            sorted_tips = sorted(existing_tips, key=lambda t: t.upvotes, reverse=True)
            result = sorted_tips[:8]
            if emitter:
                emitter.emit("community", f"Found {len(existing_tips)} existing tips · surfacing top {len(result)}")
                emitter.agent_complete("community", f"{len(result)} community tips ready")
            return result

        # ── Pull live posts from r/femaletravels + r/solofemaletravellers ──
        if emitter:
            emitter.emit("community", "Searching r/solofemaletravellers + r/femaletravels…")
        reddit_posts: list[dict] = []
        try:
            reddit_posts = await fetch_reddit_tips_for_destination(destination, max_per_sub=6)
        except Exception as reddit_err:
            logger.warning(f"Reddit fetch failed (non-fatal): {reddit_err}")

        if emitter:
            if reddit_posts:
                emitter.emit("community", f"Found {len(reddit_posts)} Reddit posts · distilling tips with Gemini…")
            else:
                emitter.emit("community", "No Reddit results · generating with Gemini knowledge only…")

        # Build CONTEXT block for the LLM
        if reddit_posts:
            context_lines = []
            for i, p in enumerate(reddit_posts):
                # Truncate body to keep tokens manageable
                body = (p.get("body") or "")[:600]
                context_lines.append(
                    f"[{i}] r/{p.get('subreddit','')} · u/{p.get('author','anonymous')} · score {p.get('score',0)}\n"
                    f"Title: {p.get('title','')}\n"
                    f"Body: {body}"
                )
            context_block = "\n\n".join(context_lines)
            human_content = (
                f"Destination: {destination}\n\n"
                f"CONTEXT — Reddit posts from r/solofemaletravellers and r/femaletravels:\n{context_block}\n\n"
                "Distill up to 8 actionable tips. Prefer Reddit-sourced tips (set source=reddit "
                "and post_index to the bracketed index above) for things directly mentioned in the posts. "
                "Use source=ai only to fill gaps with established knowledge."
            )
        else:
            human_content = (
                f"Destination: {destination}\n\n"
                "No Reddit context available. Generate up to 8 practical solo-female-travel tips "
                "based on established knowledge of this destination. All tips set source=ai, post_index=null."
            )

        llm = ChatGoogleGenerativeAI(
            google_api_key=settings.GEMINI_API_KEY,
            model="gemini-3-flash-preview",
            temperature=0.4,
            max_tokens=4096,
        )
        messages = [
            SystemMessage(content=SYSTEM_PROMPT),
            HumanMessage(content=human_content),
        ]

        response = await llm.ainvoke(messages)
        # Robust extraction across str / list[dict] / list[block] formats
        content = response.content
        if isinstance(content, str):
            raw = content
        elif isinstance(content, list):
            parts: list[str] = []
            for item in content:
                if isinstance(item, dict):
                    parts.append(item.get("text", ""))
                elif hasattr(item, "text"):
                    parts.append(getattr(item, "text", ""))
            raw = "".join(parts)
        else:
            raw = str(content)
        raw = raw.strip()

        if raw.startswith("```"):
            raw = raw.split("```")[1]
            if raw.startswith("json"):
                raw = raw[4:]
            raw = raw.strip()

        tips_data = json.loads(raw)
        if emitter:
            emitter.emit("community", f"Writing {len(tips_data)} tips · saving to database…")
        tip_objects: list[CommunityTip] = []

        for tip_obj in tips_data:
            if not isinstance(tip_obj, dict):
                continue

            category_str = tip_obj.get("category", "general")
            try:
                category = TipCategory(category_str)
            except ValueError:
                category = TipCategory.GENERAL

            # Resolve Reddit source linkage
            source = tip_obj.get("source") or "ai"
            post_index = tip_obj.get("post_index")
            source_url = None
            source_subreddit = None
            upvotes = int(tip_obj.get("upvotes") or 0)
            author_alias = tip_obj.get("author_alias") or "SafeHer Community"

            if source == "reddit" and isinstance(post_index, int) and 0 <= post_index < len(reddit_posts):
                post = reddit_posts[post_index]
                source_url = reddit_url(post)
                source_subreddit = post.get("subreddit") or None
                # Override with the real post score and author so we never display a fabricated alias
                upvotes = int(post.get("score") or upvotes)
                if not author_alias.startswith("u/"):
                    author_alias = f"u/{post.get('author', 'redditor')}"
            else:
                source = "ai"

            tip = CommunityTip(
                destination_id=destination_id,
                author_alias=author_alias,
                tip=tip_obj.get("tip", ""),
                category=category,
                upvotes=upvotes,
                created_at=datetime.now(timezone.utc),
                location=tip_obj.get("location") or None,
                source=source,
                source_url=source_url,
                source_subreddit=source_subreddit,
            )

            try:
                await save_community_tip(tip)
            except Exception as save_err:
                logger.warning(f"Could not save community tip: {save_err}")

            tip_objects.append(tip)

        final = tip_objects[:8]
        reddit_count = sum(1 for t in final if t.source == "reddit")
        if emitter:
            emitter.emit("community", f"{len(final)} tips ready · {reddit_count} from Reddit")
            emitter.agent_complete("community", f"{len(final)} tips · {reddit_count} from Reddit")
        return final

    except Exception as e:
        logger.error(f"Community agent error for '{destination}': {e}")
        if emitter:
            emitter.agent_complete("community", "Fallback tips used")
        return [
            CommunityTip(destination_id=destination_id, author_alias="SafeHer Community",
                tip=f"Research {destination}'s local customs and dress codes before arrival.",
                category=TipCategory.GENERAL, upvotes=0),
            CommunityTip(destination_id=destination_id, author_alias="SafeHer Community",
                tip="Share your itinerary with a trusted contact back home.",
                category=TipCategory.GENERAL, upvotes=0),
            CommunityTip(destination_id=destination_id, author_alias="SafeHer Community",
                tip="Keep emergency numbers saved offline in your phone.",
                category=TipCategory.EMERGENCY, upvotes=0),
            CommunityTip(destination_id=destination_id, author_alias="SafeHer Community",
                tip="Use reputable transportation apps rather than hailing cabs on the street.",
                category=TipCategory.TRANSPORT, upvotes=0),
            CommunityTip(destination_id=destination_id, author_alias="SafeHer Community",
                tip="Stay in well-reviewed, centrally-located accommodations.",
                category=TipCategory.ACCOMMODATION, upvotes=0),
            CommunityTip(destination_id=destination_id, author_alias="SafeHer Community",
                tip="Trust your instincts — if something feels wrong, leave the situation.",
                category=TipCategory.GENERAL, upvotes=0),
            CommunityTip(destination_id=destination_id, author_alias="SafeHer Community",
                tip="Connect with other female travelers through online forums before your trip.",
                category=TipCategory.GENERAL, upvotes=0),
            CommunityTip(destination_id=destination_id, author_alias="SafeHer Community",
                tip="Keep a photocopy of your passport and travel documents in a secure location.",
                category=TipCategory.EMERGENCY, upvotes=0),
        ]
