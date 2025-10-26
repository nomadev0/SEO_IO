from __future__ import annotations

from datetime import datetime

from fastapi import APIRouter, Depends, Query
from fastapi.responses import StreamingResponse
from sqlalchemy.ext.asyncio import AsyncSession

from backlinks.api import deps
from backlinks.schemas.backlink import BacklinkFilterParams
from backlinks.schemas.export import ExportFilters
from backlinks.services.exports import backlinks_csv_stream, disavow_stream

router = APIRouter(tags=["exports"])


def _build_filters(
    project_id: int,
    domain: str | None,
    status: str | None,
    rel: str | None,
    min_auth: float | None,
    tox_max: float | None,
    q: str | None,
    page: int,
    page_size: int,
    follow: bool | None,
    language: str | None,
    country: str | None,
    status_code: int | None,
    anchor_regex: str | None,
    since: datetime | None,
    until: datetime | None,
) -> BacklinkFilterParams:
    return BacklinkFilterParams(
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


@router.get("/export/backlinks.csv")
async def export_backlinks_csv(
    project_id: int = Query(..., gt=0),
    domain: str | None = Query(default=None),
    status: str | None = Query(default=None),
    rel: str | None = Query(default=None),
    min_auth: float | None = Query(default=None),
    tox_max: float | None = Query(default=None),
    q: str | None = Query(default=None),
    follow: bool | None = Query(default=None),
    language: str | None = Query(default=None),
    country: str | None = Query(default=None),
    status_code: int | None = Query(default=None),
    anchor_regex: str | None = Query(default=None),
    since: datetime | None = Query(default=None),
    until: datetime | None = Query(default=None),
    _: None = Depends(deps.authorize),
    session: AsyncSession = Depends(deps.get_session),
) -> StreamingResponse:
    filters = _build_filters(
        project_id,
        domain,
        status,
        rel,
        min_auth,
        tox_max,
        q,
        page=1,
        page_size=500,
        follow=follow,
        language=language,
        country=country,
        status_code=status_code,
        anchor_regex=anchor_regex,
        since=since,
        until=until,
    )
    generator = backlinks_csv_stream(session, filters)
    headers = {"Content-Disposition": "attachment; filename=backlinks.csv"}
    return StreamingResponse(generator, media_type="text/csv", headers=headers)


@router.post("/disavow/export")
async def export_disavow(
    payload: ExportFilters,
    _: None = Depends(deps.authorize),
    session: AsyncSession = Depends(deps.get_session),
) -> StreamingResponse:
    filters = payload.filters or BacklinkFilterParams(project_id=payload.project_id)
    generator = disavow_stream(session, filters)
    headers = {"Content-Disposition": "attachment; filename=disavow.txt"}
    return StreamingResponse(generator, media_type="text/plain", headers=headers)
