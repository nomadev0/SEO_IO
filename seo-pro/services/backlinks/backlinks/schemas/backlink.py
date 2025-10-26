from __future__ import annotations

from datetime import datetime

from pydantic import BaseModel, Field

from backlinks.db.models.backlink import BacklinkStatus, LinkRel


class BacklinkFilterParams(BaseModel):
    project_id: int
    domain: str | None = None
    status: BacklinkStatus | None = None
    rel: LinkRel | None = None
    min_auth: float | None = Field(default=None, ge=0, le=100)
    tox_max: float | None = Field(default=None, ge=0, le=100)
    q: str | None = None
    page: int = Field(default=1, ge=1)
    page_size: int = Field(default=50, ge=10, le=200)
    follow: bool | None = None
    language: str | None = None
    country: str | None = None
    status_code: int | None = None
    anchor_regex: str | None = None
    since: datetime | None = None
    until: datetime | None = None


class BacklinkEventSummary(BaseModel):
    id: int
    event_type: str
    event_at: datetime


class BacklinkOut(BaseModel):
    id: int
    source_page_id: int
    source_url: str
    source_title: str | None
    source_lang: str | None
    source_country: str | None
    target_url: str
    rel: LinkRel
    anchor: str | None
    context_snippet: str | None
    status: BacklinkStatus
    status_code: int | None
    authority: float
    toxicity: float
    first_seen: datetime
    last_seen: datetime
    latest_event: BacklinkEventSummary | None = None

    model_config = {"from_attributes": True}


class PaginatedBacklinks(BaseModel):
    items: list[BacklinkOut]
    total: int
    page: int
    page_size: int

