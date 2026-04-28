"""
Reddit tool — fetches solo-female-travel posts about a destination from
r/femaletravels and r/solofemaletravellers via the Reddit MCP server.

The Reddit MCP returns results as MARKDOWN TEXT (not JSON), so we parse the
predictable "### N. <title>" block format. Falls back gracefully (returns [])
if anything goes wrong — the community agent treats Reddit data as a hint,
not a requirement.
"""

import logging
import re
from typing import Optional

from langchain_mcp_adapters.client import MultiServerMCPClient
from mcp_client import _reddit_config

logger = logging.getLogger(__name__)

TARGET_SUBREDDITS = ["solofemaletravellers", "femaletravels"]


def _extract_text_from_mcp_response(raw) -> str:
    """The MCP adapter wraps results as a list of content blocks like
    [{'type': 'text', 'text': '...markdown...'}]. Concatenate all text blocks."""
    if isinstance(raw, str):
        return raw
    if isinstance(raw, list):
        parts: list[str] = []
        for item in raw:
            if isinstance(item, dict) and item.get("type") == "text":
                parts.append(item.get("text", ""))
            elif hasattr(item, "text"):
                parts.append(getattr(item, "text", ""))
        return "\n".join(p for p in parts if p)
    return ""


# Regex: "### N. <title>" header
_POST_HEADER = re.compile(r"^### \d+\.\s*(.+?)\s*$", re.MULTILINE)


def _parse_markdown_posts(md: str) -> list[dict]:
    """Parse the Reddit MCP markdown output into a list of post dicts.

    Expected per-post block:
        ### 1. <title>
        - Subreddit: r/<sub>
        - Author: u/<user>
        - Score: <int> (...)
        - Comments: <int>
        - Posted: <datetime>
        - Link: <url>
    """
    if not md:
        return []

    posts: list[dict] = []
    # Split the document on each post header — keep the header as the first line of each chunk
    chunks = _POST_HEADER.split(md)
    # split() returns [pre, title1, body1, title2, body2, ...]
    for i in range(1, len(chunks), 2):
        title = chunks[i].strip()
        body = chunks[i + 1] if i + 1 < len(chunks) else ""

        def _find(label: str) -> Optional[str]:
            m = re.search(rf"^- {label}:\s*(.+?)\s*$", body, re.MULTILINE)
            return m.group(1).strip() if m else None

        score_str = _find("Score") or "0"
        score_num = re.match(r"-?\d+", score_str)
        score = int(score_num.group(0)) if score_num else 0

        comments_str = _find("Comments") or "0"
        cm_num = re.match(r"\d+", comments_str)
        num_comments = int(cm_num.group(0)) if cm_num else 0

        sub = _find("Subreddit") or ""
        if sub.startswith("r/"):
            sub = sub[2:]

        author = _find("Author") or "anonymous"
        if author.startswith("u/"):
            author = author[2:]

        link = _find("Link") or ""

        # Some result formats include a brief "Excerpt:" or body line — capture if present
        excerpt = _find("Excerpt") or _find("Body") or ""

        posts.append({
            "title": title,
            "body": excerpt,
            "author": author,
            "score": score,
            "subreddit": sub,
            "url": link,
            "num_comments": num_comments,
        })
    return posts


async def fetch_reddit_tips_for_destination(
    destination: str, max_per_sub: int = 6
) -> list[dict]:
    """Search r/solofemaletravellers and r/femaletravels for posts mentioning
    `destination` and return a flat list of post-dicts.

    Spawns the Reddit MCP subprocess ONCE per call and shares the search tool
    across both subreddits. Returns [] on any failure.
    """
    if not destination:
        return []

    try:
        client = MultiServerMCPClient(_reddit_config())
        tools = await client.get_tools()
    except Exception as e:
        logger.warning(f"Reddit MCP unreachable (npx reddit-mcp-server failed?): {e}")
        return []

    tools_by_name = {t.name: t for t in tools}
    search_tool = tools_by_name.get("search_reddit")
    if not search_tool:
        logger.warning(f"Reddit MCP missing search_reddit tool — got: {list(tools_by_name.keys())}")
        return []

    all_posts: list[dict] = []
    for sub in TARGET_SUBREDDITS:
        try:
            raw = await search_tool.ainvoke({
                "query": destination,
                "subreddit": sub,
                "limit": max_per_sub,
                "sort": "relevance",
            })
        except Exception as e:
            logger.warning(f"Reddit search_reddit failed for r/{sub}: {e}")
            continue

        text = _extract_text_from_mcp_response(raw)
        posts = _parse_markdown_posts(text)
        for p in posts[:max_per_sub]:
            if not p.get("subreddit"):
                p["subreddit"] = sub
            all_posts.append(p)

    all_posts.sort(key=lambda p: p.get("score", 0), reverse=True)
    return all_posts


def reddit_url(post: dict) -> Optional[str]:
    """Best-effort URL for a parsed Reddit post."""
    url = (post.get("url") or "").strip()
    if url.startswith("http"):
        return url
    return None
