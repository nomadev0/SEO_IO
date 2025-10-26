from __future__ import annotations

from datetime import datetime

from pydantic import BaseModel, Field


class DomainCreate(BaseModel):
    root_domain: str = Field(..., max_length=255)
    tld: str | None = Field(default=None, max_length=32)
    asn: str | None = Field(default=None, max_length=64)
    ip: str | None = Field(default=None, max_length=64)
    whois_country: str | None = Field(default=None, max_length=64)
    authority_score: float = Field(default=0.0, ge=0, le=100)
    toxicity_score: float = Field(default=0.0, ge=0, le=100)
    first_seen: datetime | None = None
    last_seen: datetime | None = None


class DomainOut(BaseModel):
    id: int
    project_id: int
    root_domain: str
    tld: str | None
    authority_score: float
    toxicity_score: float
    first_seen: datetime | None
    last_seen: datetime | None

    model_config = {"from_attributes": True}


class TopDomainOut(BaseModel):
    id: int
    root_domain: str
    referring_pages: int
    authority_score: float
    toxicity_score: float

