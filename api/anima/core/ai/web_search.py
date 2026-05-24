"""
Web search utility for knowledge enrichment during ingestion.

Provider priority:
  1. Brave Search  — if BRAVE_API_KEY is set (2 000 free queries/month,
                       https://brave.com/search/api/)
  2. ddgs          — DuckDuckGo unofficial client, no key required
  3. Empty list    — graceful degradation; ingestion continues without web context

Usage:
    snippets = await search_web("addin pricing SAP", max_results=3)
    # [{"title": "...", "body": "...", "href": "..."}, ...]
"""
from __future__ import annotations

import asyncio
import logging

from anima.config import settings

logger = logging.getLogger(__name__)


async def search_web(query: str, max_results: int = 3) -> list[dict]:
    """Search the web and return a list of result snippets.

    Returns an empty list (never raises) so callers can always proceed.
    """
    if not settings.web_search_enabled:
        return []

    try:
        if settings.brave_api_key:
            return await _brave(query, max_results)
        return await _ddgs(query, max_results)
    except Exception as exc:
        logger.warning("Web search failed (query=%r): %s", query, exc)
        return []


# ── Brave Search ──────────────────────────────────────────────────────────────

async def _brave(query: str, max_results: int) -> list[dict]:
    import httpx

    url = "https://api.search.brave.com/res/v1/web/search"
    headers = {
        "Accept": "application/json",
        "Accept-Encoding": "gzip",
        "X-Subscription-Token": settings.brave_api_key,
    }
    params = {"q": query, "count": max_results, "text_decorations": False}

    async with httpx.AsyncClient(timeout=10) as client:
        resp = await client.get(url, headers=headers, params=params)
        resp.raise_for_status()
        data = resp.json()

    results = []
    for item in data.get("web", {}).get("results", []):
        title = item.get("title", "").strip()
        body  = item.get("description", "").strip()
        href  = item.get("url", "").strip()
        if title or body:
            results.append({"title": title, "body": body, "href": href})
    return results[:max_results]


# ── DuckDuckGo (ddgs) ─────────────────────────────────────────────────────────

async def _ddgs(query: str, max_results: int) -> list[dict]:
    def _sync() -> list[dict]:
        from ddgs import DDGS
        with DDGS() as ddgs:
            return [
                {"title": r.get("title", ""), "body": r.get("body", ""), "href": r.get("href", "")}
                for r in ddgs.text(query, max_results=max_results)
            ]

    return await asyncio.wait_for(asyncio.to_thread(_sync), timeout=10.0)
