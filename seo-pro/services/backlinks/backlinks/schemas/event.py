from __future__ import annotations

from datetime import datetime

from pydantic import BaseModel


class LinkEventOut(BaseModel):
    id: int
    backlink_id: int
    event_type: str
    event_at: datetime
    diff: dict | None = None

    model_config = {"from_attributes": True}

