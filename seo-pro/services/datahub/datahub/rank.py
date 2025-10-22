"""Rank tracking helpers."""

from __future__ import annotations

import datetime as dt
from typing import Optional

import httpx

from .config import SerpConfig, get_env


async def fetch_rank_positions(
    keyword: str,
    domain: str,
    location: Optional[str] = None,
    device: str = "desktop",
) -> dict:
    """Fetch SERP data using SerpAPI (or return stub if not configured)."""

    config = SerpConfig(api_key=get_env("SERP_API_KEY"))
    if not config.api_key:
        return {
            "available": False,
            "reason": "Configura SERP_API_KEY para obtener rankings reales.",
        }

    params = {
        "api_key": config.api_key,
        "engine": config.engine,
        "q": keyword,
        "device": device,
        "location": location or get_env("SERP_LOCATION", "Spain"),
        "num": "20",
    }

    async with httpx.AsyncClient(timeout=40.0) as client:
        try:
            response = await client.get("https://serpapi.com/search.json", params=params)
            response.raise_for_status()
            data = response.json()
        except Exception as exc:  # pragma: no cover - external dependency
            return {
                "available": False,
                "reason": f"Error consultando SERP API: {exc}",
            }

    organic_results = data.get("organic_results", []) if isinstance(data, dict) else []
    position = next(
        (
            result.get("position")
            for result in organic_results
            if domain.lower() in (result.get("link") or "").lower()
        ),
        None,
    )

    return {
        "available": True,
        "keyword": keyword,
        "domain": domain,
        "position": position,
        "fetched_at": dt.datetime.utcnow().isoformat() + "Z",
        "serp_sample": organic_results[:5],
    }
