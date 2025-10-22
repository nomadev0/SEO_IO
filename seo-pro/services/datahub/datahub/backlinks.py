"""Backlink data connector."""

from __future__ import annotations

from typing import Optional

import httpx

from .config import BacklinkConfig


async def fetch_backlink_overview(domain: str) -> dict:
    """Fetch backlink summary from the configured provider (Ahrefs by default)."""

    config = BacklinkConfig()
    if not config.provider or not config.api_key:
        return {
            "available": False,
            "reason": "Configura BACKLINK_PROVIDER y BACKLINK_API_KEY para obtener datos reales.",
        }

    provider = config.provider.lower()
    if provider == "ahrefs":
        return await _fetch_ahrefs(domain, config)

    return {
        "available": False,
        "reason": f"Proveedor {config.provider} no soportado.",
    }


async def _fetch_ahrefs(domain: str, config: BacklinkConfig) -> dict:
    base_url = config.base_url or "https://apiv2.ahrefs.com"
    params = {
        "token": config.api_key,
        "from": "domain_rating",
        "target": domain,
        "mode": "domain",
        "output": "json",
    }

    async with httpx.AsyncClient(timeout=40.0) as client:
        try:
            response = await client.get(base_url, params=params)
            response.raise_for_status()
            payload = response.json()
        except Exception as exc:  # pragma: no cover - external dependency
            return {
                "available": False,
                "reason": f"Error consultando Ahrefs: {exc}",
            }

    metrics = payload.get("metrics", {}) if isinstance(payload, dict) else {}
    return {
        "available": True,
        "domain_rating": metrics.get("domain_rating"),
        "backlinks": metrics.get("backlinks"),
        "ref_domains": metrics.get("refdomains"),
        "dofollow": metrics.get("dofollow"),
        "nofollow": metrics.get("nofollow"),
    }
