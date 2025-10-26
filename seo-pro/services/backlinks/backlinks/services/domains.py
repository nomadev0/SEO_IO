from __future__ import annotations

from datetime import datetime

from sqlalchemy import func, select
from sqlalchemy.ext.asyncio import AsyncSession

from backlinks.core.errors import AppError
from backlinks.db.models import Domain
from backlinks.schemas.domain import DomainCreate


async def create_domain(
    session: AsyncSession,
    project_id: int,
    payload: DomainCreate,
) -> Domain:
    existing = await session.scalar(
        select(Domain).where(
            Domain.project_id == project_id,
            func.lower(Domain.root_domain) == payload.root_domain.lower(),
        )
    )
    if existing:
        raise AppError("Domain already exists for project", status_code=409)

    domain = Domain(
        project_id=project_id,
        root_domain=payload.root_domain,
        tld=payload.tld,
        asn=payload.asn,
        ip=payload.ip,
        whois_country=payload.whois_country,
        authority_score=payload.authority_score,
        toxicity_score=payload.toxicity_score,
        first_seen=payload.first_seen or datetime.utcnow(),
        last_seen=payload.last_seen or datetime.utcnow(),
    )
    session.add(domain)
    await session.commit()
    await session.refresh(domain)
    return domain


async def get_top_domains(session: AsyncSession, project_id: int, limit: int = 10) -> list[tuple[Domain, int]]:
    from backlinks.db.models import Backlink, Page

    stmt = (
        select(Domain, func.count(Backlink.id).label("referring_pages"))
        .join(Page, Page.domain_id == Domain.id)
        .join(Backlink, Backlink.source_page_id == Page.id)
        .where(Domain.project_id == project_id, Backlink.is_deleted.is_(False))
        .group_by(Domain.id)
        .order_by(func.avg(Backlink.authority).desc())
        .limit(limit)
    )
    result = await session.execute(stmt)
    return [(row[0], row[1]) for row in result.all()]

