from __future__ import annotations

from datetime import datetime

from pydantic import BaseModel, Field


class AlertRule(BaseModel):
    name: str
    description: str | None = None
    condition: dict


class AlertCreate(BaseModel):
    project_id: int
    channel: str = Field(..., max_length=32)
    rule: AlertRule
    is_active: bool = True


class AlertOut(BaseModel):
    id: int
    project_id: int
    channel: str
    rule_json: dict
    is_active: bool
    created_at: datetime

    model_config = {"from_attributes": True}

