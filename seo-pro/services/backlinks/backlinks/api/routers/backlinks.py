from __future__ import annotations

from datetime import datetime

from fastapi import APIRouter, Depends, Query
from sqlalchemy.ext.asyncio import AsyncSession

from backlinks.api import deps
from backlinks.schemas.backlink import BacklinkFilterParams, PaginatedBacklinks
from backlinks.schemas.event import LinkEventOut
from backlinks.services.backlinks import backlinks_kpis, list_backlinks, list_events, series_new_vs_lost

router = APIRouter(tags=["backlinks"])


@router.get("/backlinks", response_model=PaginatedBacklinks, summary="List backlinks with filters")
async def get_backlinks(
    project_id: int = Query(..., gt=0),
    domain: str | None = Query(default=None),
    status: str | None = Query(default=None),
    rel: str | None = Query(default=None),
    min_auth: float | None = Query(default=None, ge=0, le=100),
    tox_max: float | None = Query(default=None, ge=0, le=100),
    q: str | None = Query(default=None),
    page: int = Query(default=1, ge=1),
    page_size: int = Query(default=50, ge=10, le=200),
    follow: bool | None = Query(default=None),
    language: str | None = Query(default=None),
    country: str | None = Query(default=None),
    status_code: int | None = Query(default=None),
    anchor_regex: str | None = Query(default=None),
    since: datetime | None = Query(default=None),
    until: datetime | None = Query(default=None),
    _: None = Depends(deps.authorize),
    session: AsyncSession = Depends(deps.get_session),
) -> PaginatedBacklinks:
    filters = BacklinkFilterParams(
        project_id=project_id,
        domain=domain,
        status=status,
        rel=rel,
        min_auth=min_auth,
        tox_max=tox_max,
        q=q,
        page=page,
        page_size=page_size,
        follow=follow,
        language=language,
        country=country,
        status_code=status_code,
        anchor_regex=anchor_regex,
        since=since,
        until=until,
    )
    return await list_backlinks(session, filters)


@router.get("/backlinks/events", response_model=list[LinkEventOut], summary="List backlink events")
async def get_backlink_events(
    project_id: int = Query(..., gt=0),
    since: datetime | None = Query(default=None),
    _: None = Depends(deps.authorize),
    session: AsyncSession = Depends(deps.get_session),
) -> list[LinkEventOut]:
    return await list_events(session, project_id=project_id, since=since)


@router.get("/backlinks/kpis", summary="Aggregate KPI metrics")
async def get_backlink_kpis(
    project_id: int = Query(..., gt=0),
    _: None = Depends(deps.authorize),
    session: AsyncSession = Depends(deps.get_session),
) -> dict[str, float | int]:
    return await backlinks_kpis(session, project_id=project_id)


@router.get("/backlinks/series", summary="Time series new vs lost backlinks")
async def get_backlink_series(
    project_id: int = Query(..., gt=0),
    start: datetime = Query(...),
    end: datetime = Query(...),
    _: None = Depends(deps.authorize),
    session: AsyncSession = Depends(deps.get_session),
) -> list[dict[str, object]]:
    return await series_new_vs_lost(session, project_id=project_id, start=start, end=end)
