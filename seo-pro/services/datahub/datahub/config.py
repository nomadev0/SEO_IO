"""Shared configuration helpers for the datahub connectors."""

from __future__ import annotations

import json
import os
from dataclasses import dataclass
from pathlib import Path
from typing import Optional
import json


def get_env(name: str, default: Optional[str] = None) -> Optional[str]:
    value = os.getenv(name, default)
    if value:
        value = value.strip()
    return value or default


def load_json_file(path: str | Path | None) -> Optional[dict]:
    if not path:
        return None
    try:
        return json.loads(Path(path).read_text(encoding="utf-8"))
    except Exception:
        return None


@dataclass
class SerpConfig:
    api_key: Optional[str] = get_env("SERP_API_KEY")
    engine: str = get_env("SERP_ENGINE", "google")


@dataclass
class BacklinkConfig:
    provider: Optional[str] = get_env("BACKLINK_PROVIDER")  # e.g. "ahrefs"
    api_key: Optional[str] = get_env("BACKLINK_API_KEY")
    base_url: Optional[str] = get_env("BACKLINK_API_BASE")


@dataclass
class GscConfig:
    property_url: Optional[str] = None
    service_account_file: Optional[str] = get_env("GSC_SERVICE_ACCOUNT_FILE")
    service_account_json: Optional[dict] = None

    @classmethod
    def from_env(cls, property_url: Optional[str] = None) -> "GscConfig":
        data = load_json_file(get_env("GSC_SERVICE_ACCOUNT_JSON"))
        return cls(
            property_url=property_url,
            service_account_file=get_env("GSC_SERVICE_ACCOUNT_FILE"),
            service_account_json=data,
        )
