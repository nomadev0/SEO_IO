"""Google Search Console connector."""

from __future__ import annotations

import datetime as dt
import os
from typing import Optional

try:
    from google.oauth2.service_account import Credentials
    from googleapiclient.discovery import build
except ImportError:  # pragma: no cover - optional dependency
    Credentials = None  # type: ignore
    build = None  # type: ignore

from .config import GscConfig

DEFAULT_SCOPES = ["https://www.googleapis.com/auth/webmasters.readonly"]


def fetch_search_console_summary(
    property_url: str,
    start_date: Optional[dt.date] = None,
    end_date: Optional[dt.date] = None,
) -> dict:
    """Return Search Console metrics (clicks, impressions, ctr, position) if credentials are configured."""

    start_date = start_date or (dt.date.today() - dt.timedelta(days=28))
    end_date = end_date or (dt.date.today() - dt.timedelta(days=1))

    config = GscConfig.from_env(property_url)
    if Credentials is None or build is None:
        return {
            "available": False,
            "reason": "google-api-python-client no está instalado. Ejecuta `pip install -e services/datahub[summaries]`.",
        }

    creds = _load_credentials(config)
    if creds is None:
        return {
            "available": False,
            "reason": "Configura GSC_SERVICE_ACCOUNT_FILE o GSC_SERVICE_ACCOUNT_JSON.",
        }

    try:
        service = build("searchconsole", "v1", credentials=creds, cache_discovery=False)
        response = (
            service.searchanalytics()
            .query(
                siteUrl=property_url,
                body={
                    "startDate": start_date.isoformat(),
                    "endDate": end_date.isoformat(),
                    "dimensions": ["query"],
                    "rowLimit": 25,
                },
            )
            .execute()
        )

        rows = response.get("rows", []) if isinstance(response, dict) else []
        clicks = sum(row.get("clicks", 0) for row in rows)
        impressions = sum(row.get("impressions", 0) for row in rows)
        ctr = clicks / impressions if impressions else 0
        avg_position = (
            sum(row.get("position", 0) for row in rows) / len(rows) if rows else None
        )

        return {
            "available": True,
            "clicks": round(clicks),
            "impressions": round(impressions),
            "ctr": round(ctr, 4),
            "avg_position": round(avg_position, 2) if avg_position is not None else None,
            "top_queries": [
                {
                    "query": " ".join(row.get("keys", [])),
                    "clicks": row.get("clicks", 0),
                    "impressions": row.get("impressions", 0),
                    "ctr": row.get("ctr", 0),
                    "position": row.get("position", 0),
                }
                for row in rows[:10]
            ],
            "start_date": start_date.isoformat(),
            "end_date": end_date.isoformat(),
        }
    except Exception as exc:  # pragma: no cover - external API
        return {
            "available": False,
            "reason": f"Error consultando GSC: {exc}",
        }


def _load_credentials(config: GscConfig):
    if config.service_account_file and os.path.exists(config.service_account_file):
        return Credentials.from_service_account_file(
            config.service_account_file, scopes=DEFAULT_SCOPES
        )
    if config.service_account_json:
        return Credentials.from_service_account_info(
            config.service_account_json, scopes=DEFAULT_SCOPES
        )
    return None
