from __future__ import annotations

from datetime import datetime, timedelta

import pytest
from httpx import AsyncClient
from sqlalchemy.ext.asyncio import AsyncSession

from backlinks.db.models import (
    Backlink,
    BacklinkStatus,
    Domain,
    LinkEvent,
    LinkEventType,
    LinkRel,
    Page,
    PageStatus,
    Project,
)


async def _create_backlink(
    session: AsyncSession,
    project: Project,
    rel: LinkRel = LinkRel.dofollow,
    status: BacklinkStatus = BacklinkStatus.active,
) -> Backlink:
    domain = Domain(
        project_id=project.id,
        root_domain="example.com",
        tld="com",
        authority_score=55.0,
        toxicity_score=12.0,
    )
    session.add(domain)
    await session.flush()

    page = Page(
        domain_id=domain.id,
        url="https://example.com/article",
        status=PageStatus.active,
        lang="en",
        country_guess="US",
        title="Example Article",
    )
    session.add(page)
    await session.flush()

    backlink = Backlink(
        source_page_id=page.id,
        target_url="https://clientsite.com/resource",
        rel=rel,
        anchor="Example anchor",
        status=status,
        status_code=200,
        first_seen=datetime.utcnow() - timedelta(days=3),
        last_seen=datetime.utcnow(),
        authority=45.0,
        toxicity=18.0,
        is_deleted=status == BacklinkStatus.lost,
    )
    session.add(backlink)
    await session.flush()

    event = LinkEvent(
        backlink_id=backlink.id,
        event_type=LinkEventType.new,
        event_at=backlink.first_seen,
        diff={"status": "new"},
    )
    session.add(event)
    await session.commit()
    return backlink


@pytest.mark.asyncio
async def test_create_domain(client: AsyncClient, auth_headers: dict[str, str], project: Project):
    response = await client.post(
        f"/projects/{project.id}/domains",
        headers=auth_headers,
        json={"root_domain": "clientsite.com", "authority_score": 50, "toxicity_score": 10},
    )
    assert response.status_code == 201
    data = response.json()
    assert data["root_domain"] == "clientsite.com"
    assert data["project_id"] == project.id


@pytest.mark.asyncio
async def test_list_backlinks_filters(
    client: AsyncClient,
    auth_headers: dict[str, str],
    session: AsyncSession,
    project: Project,
):
    backlink = await _create_backlink(session, project, rel=LinkRel.nofollow)

    response = await client.get(
        "/backlinks",
        headers=auth_headers,
        params={"project_id": project.id, "rel": "nofollow"},
    )
    assert response.status_code == 200
    payload = response.json()
    assert payload["total"] == 1
    assert payload["items"][0]["id"] == backlink.id
    assert payload["items"][0]["rel"] == "nofollow"


@pytest.mark.asyncio
async def test_disavow_export(
    client: AsyncClient,
    auth_headers: dict[str, str],
    session: AsyncSession,
    project: Project,
):
    await _create_backlink(session, project)
    response = await client.post(
        "/disavow/export",
        headers=auth_headers,
        json={"project_id": project.id},
    )
    assert response.status_code == 200
    body = await response.aread()
    assert b"domain:example.com" in body


@pytest.mark.asyncio
async def test_events_since_filter(
    client: AsyncClient,
    auth_headers: dict[str, str],
    session: AsyncSession,
    project: Project,
):
    backlink = await _create_backlink(session, project)
    response = await client.get(
        "/backlinks/events",
        headers=auth_headers,
        params={"project_id": project.id},
    )
    assert response.status_code == 200
    events = response.json()
    assert len(events) >= 1
    assert events[0]["backlink_id"] == backlink.id
