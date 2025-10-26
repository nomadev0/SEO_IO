from __future__ import annotations

from pydantic import BaseModel

from .backlink import BacklinkFilterParams


class ExportFilters(BaseModel):
    project_id: int
    filters: BacklinkFilterParams | None = None

