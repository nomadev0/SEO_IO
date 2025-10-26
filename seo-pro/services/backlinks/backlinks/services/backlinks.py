from __future__ import annotations

import re
from datetime import datetime, timedelta

from sqlalchemy import func, select
from sqlalchemy.ext.asyncio import AsyncSession

from backlinks.db.models import (
    Backlink,
    BacklinkStatus,
    Domain,
    LinkEvent,
    LinkEventType,
    LinkRel,
    Page,
)
from backlinks.schemas.backlink import BacklinkEventSummary, BacklinkFilterParams, BacklinkOut, PaginatedBacklinks
from backlinks.schemas.event import LinkEventOut


def _apply_filters(query, filters: BacklinkFilterParams):
    if filters.domain:
        ilike_pattern = f"%{filters.domain.lower()}%"
        query = query.where(func.lower(Page.url).like(ilike_pattern))
    if filters.status:
        query = query.where(Backlink.status == filters.status)
    if filters.rel:
        query = query.where(Backlink.rel == filters.rel)
    if filters.min_auth is not None:
        query = query.where(Backlink.authority >= filters.min_auth)
    if filters.tox_max is not None:
        query = query.where(Backlink.toxicity <= filters.tox_max)
    if filters.q:
        q = f"%{filters.q.lower()}%"
        query = query.where(
            func.lower(func.coalesce(Backlink.anchor, "")).like(q)
            | func.lower(Backlink.target_url).like(q)
            | func.lower(func.coalesce(Page.title, "")).like(q)
        )
    if filters.follow is not None:
        if filters.follow:
            query = query.where(Backlink.rel == LinkRel.dofollow)
        else:
            query = query.where(Backlink.rel != LinkRel.dofollow)
    if filters.language:
        query = query.where(Page.lang == filters.language)
    if filters.country:
        query = query.where(Page.country_guess == filters.country)
    if filters.status_code:
        query = query.where(Backlink.status_code == filters.status_code)
    if filters.anchor_regex:
        try:
            _ = re.compile(filters.anchor_regex)
        except re.error:
            pass
        else:
            query = query.where(
                func.lower(func.coalesce(Backlink.anchor, "")).op("~")(filters.anchor_regex.lower())
            )
    if filters.since:
        query = query.where(Backlink.last_seen >= filters.since)
    if filters.until:
        query = query.where(Backlink.last_seen <= filters.until)
    return query


def _build_query(filters: BacklinkFilterParams, include_page: bool = False):
    columns = (Backlink, Page) if include_page else (Backlink.id,)
    query = (
        select(*columns)
        .join(Page, Backlink.source_page_id == Page.id)
        .join(Domain, Page.domain_id == Domain.id)
        .where(Domain.project_id == filters.project_id, Backlink.is_deleted.is_(False))
    )
    return _apply_filters(query, filters)


async def list_backlinks(session: AsyncSession, filters: BacklinkFilterParams) -> PaginatedBacklinks:
    count_query = _build_query(filters, include_page=False)
    total = await session.scalar(select(func.count()).select_from(count_query.subquery()))
    total = int(total or 0)

    data_query = (
        _build_query(filters, include_page=True)
        .order_by(Backlink.last_seen.desc())
        .limit(filters.page_size)
        .offset((filters.page - 1) * filters.page_size)
    )
    records = (await session.execute(data_query)).all()

    backlink_ids = [row[0].id for row in records]
    latest_events: dict[int, BacklinkEventSummary] = {}

    if backlink_ids:
        event_stmt = (
            select(LinkEvent)
            .where(LinkEvent.backlink_id.in_(backlink_ids))
            .order_by(LinkEvent.backlink_id, LinkEvent.event_at.desc())
        )
        for event in (await session.execute(event_stmt)).scalars():
            if event.backlink_id not in latest_events:
                latest_events[event.backlink_id] = BacklinkEventSummary(
                    id=event.id,
                    event_type=event.event_type.value,
                    event_at=event.event_at,
                )

    items = []
    for backlink, page in records:
        items.append(
            BacklinkOut(
                id=backlink.id,
                source_page_id=page.id,
                source_url=page.url,
                source_title=page.title,
                source_lang=page.lang,
                source_country=page.country_guess,
                target_url=backlink.target_url,
                rel=backlink.rel,
                anchor=backlink.anchor,
                context_snippet=backlink.context_snippet,
                status=backlink.status,
                status_code=backlink.status_code,
                authority=backlink.authority,
                toxicity=backlink.toxicity,
                first_seen=backlink.first_seen,
                last_seen=backlink.last_seen,
                latest_event=latest_events.get(backlink.id),
            )
        )

    return PaginatedBacklinks(
        items=items,
        total=total,
        page=filters.page,
        page_size=filters.page_size,
    )


async def list_events(
    session: AsyncSession,
    project_id: int,
    since: datetime | None = None,
    limit: int = 200,
) -> list[LinkEventOut]:
    stmt = (
        select(LinkEvent)
        .join(Backlink, Backlink.id == LinkEvent.backlink_id)
        .join(Page, Page.id == Backlink.source_page_id)
        .join(Domain, Domain.id == Page.domain_id)
        .where(Domain.project_id == project_id)
        .order_by(LinkEvent.event_at.desc())
        .limit(limit)
    )
    if since:
        stmt = stmt.where(LinkEvent.event_at >= since)

    events = (await session.execute(stmt)).scalars().all()
    return [
        LinkEventOut(
            id=event.id,
            backlink_id=event.backlink_id,
            event_type=event.event_type.value,
            event_at=event.event_at,
            diff=event.diff,
        )
        for event in events
    ]


async def backlinks_kpis(session: AsyncSession, project_id: int) -> dict[str, float | int]:
    total_stmt = select(func.count()).select_from(
        select(Backlink.id)
        .join(Page, Page.id == Backlink.source_page_id)
        .join(Domain, Domain.id == Page.domain_id)
        .where(Domain.project_id == project_id, Backlink.is_deleted.is_(False))
        .subquery()
    )

    total = await session.scalar(total_stmt) or 0

    referring_domains_stmt = select(func.count(func.distinct(Page.domain_id))).join(
        Backlink, Backlink.source_page_id == Page.id
    )
    referring_domains_stmt = referring_domains_stmt.join(Domain, Domain.id == Page.domain_id).where(
        Domain.project_id == project_id
    )
    referring_domains = await session.scalar(referring_domains_stmt) or 0

    now = datetime.utcnow()
    last7 = now - timedelta(days=7)
    last30 = now - timedelta(days=30)

    new_7_stmt = select(func.count()).select_from(
        select(Backlink.id)
        .join(Page, Page.id == Backlink.source_page_id)
        .join(Domain, Domain.id == Page.domain_id)
        .where(
            Domain.project_id == project_id,
            Backlink.first_seen >= last7,
            Backlink.status == BacklinkStatus.active,
        )
        .subquery()
    )
    new_30_stmt = select(func.count()).select_from(
        select(Backlink.id)
        .join(Page, Page.id == Backlink.source_page_id)
        .join(Domain, Domain.id == Page.domain_id)
        .where(
            Domain.project_id == project_id,
            Backlink.first_seen >= last30,
            Backlink.status == BacklinkStatus.active,
        )
        .subquery()
    )

    lost_7_stmt = select(func.count()).select_from(
        select(LinkEvent.id)
        .join(Backlink, Backlink.id == LinkEvent.backlink_id)
        .join(Page, Page.id == Backlink.source_page_id)
        .join(Domain, Domain.id == Page.domain_id)
        .where(Domain.project_id == project_id, LinkEvent.event_type == LinkEventType.lost, LinkEvent.event_at >= last7)
        .subquery()
    )
    lost_30_stmt = select(func.count()).select_from(
        select(LinkEvent.id)
        .join(Backlink, Backlink.id == LinkEvent.backlink_id)
        .join(Page, Page.id == Backlink.source_page_id)
        .join(Domain, Domain.id == Page.domain_id)
        .where(
            Domain.project_id == project_id,
            LinkEvent.event_type == LinkEventType.lost,
            LinkEvent.event_at >= last30,
        )
        .subquery()
    )

    follow_ratio_stmt = (
        select(
            func.count().filter(Backlink.rel == LinkRel.dofollow),
            func.count(Backlink.id),
        )
        .join(Page, Page.id == Backlink.source_page_id)
        .join(Domain, Domain.id == Page.domain_id)
        .where(Domain.project_id == project_id, Backlink.is_deleted.is_(False))
    )

    tox_avg_stmt = select(func.avg(Backlink.toxicity)).join(
        Page, Page.id == Backlink.source_page_id
    ).join(Domain, Domain.id == Page.domain_id)
    tox_avg_stmt = tox_avg_stmt.where(Domain.project_id == project_id, Backlink.is_deleted.is_(False))

    new_7 = await session.scalar(new_7_stmt) or 0
    new_30 = await session.scalar(new_30_stmt) or 0
    lost_7 = await session.scalar(lost_7_stmt) or 0
    lost_30 = await session.scalar(lost_30_stmt) or 0
    follow_row = (await session.execute(follow_ratio_stmt)).first()
    follow_count = int(follow_row[0]) if follow_row else 0
    total_count = int(follow_row[1]) if follow_row else 0
    follow_ratio = (follow_count / total_count) * 100 if total_count else 0
    toxicity_avg = await session.scalar(tox_avg_stmt) or 0.0

    return {
        "total_backlinks": total,
        "referring_domains": referring_domains,
        "new_7": new_7,
        "new_30": new_30,
        "lost_7": lost_7,
        "lost_30": lost_30,
        "follow_ratio": round(follow_ratio, 2),
        "toxicity_avg": round(float(toxicity_avg), 2),
    }


async def series_new_vs_lost(
    session: AsyncSession,
    project_id: int,
    start: datetime,
    end: datetime,
) -> list[dict[str, object]]:
    day_col = func.date(LinkEvent.event_at).label("day")
    bucket_stmt = (
        select(
            day_col,
            func.count().filter(LinkEvent.event_type == LinkEventType.new).label("new"),
            func.count().filter(LinkEvent.event_type == LinkEventType.lost).label("lost"),
        )
        .join(Backlink, Backlink.id == LinkEvent.backlink_id)
        .join(Page, Page.id == Backlink.source_page_id)
        .join(Domain, Domain.id == Page.domain_id)
        .where(Domain.project_id == project_id, LinkEvent.event_at.between(start, end))
        .group_by(day_col)
        .order_by(day_col)
    )
    rows = await session.execute(bucket_stmt)
    data = []
    for row in rows:
        day = row.day
        if hasattr(day, "isoformat"):
            day_str = day.isoformat()  # type: ignore[call-arg]
        else:
            day_str = str(day)
        data.append({"date": day_str, "new": int(row.new or 0), "lost": int(row.lost or 0)})
    return data
