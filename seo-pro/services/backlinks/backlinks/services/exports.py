from __future__ import annotations

import csv
from io import StringIO
from urllib.parse import urlparse

from sqlalchemy.ext.asyncio import AsyncSession

from backlinks.schemas.backlink import BacklinkFilterParams
from backlinks.services.backlinks import list_backlinks


async def _iter_backlinks(
    session: AsyncSession,
    filters: BacklinkFilterParams,
    chunk_size: int = 500,
):
    page = 1
    while True:
        chunk_filters = filters.model_copy(update={"page": page, "page_size": chunk_size})
        chunk = await list_backlinks(session, chunk_filters)
        if not chunk.items:
            break
        yield chunk
        if len(chunk.items) < chunk_filters.page_size:
            break
        page += 1


async def backlinks_csv_stream(session: AsyncSession, filters: BacklinkFilterParams):
    header = [
        "source_url",
        "source_title",
        "target_url",
        "rel",
        "anchor",
        "status",
        "status_code",
        "authority",
        "toxicity",
        "first_seen",
        "last_seen",
    ]
    buffer = StringIO()
    writer = csv.writer(buffer)
    writer.writerow(header)
    yield buffer.getvalue()
    buffer.seek(0)
    buffer.truncate(0)

    async for chunk in _iter_backlinks(session, filters):
        for item in chunk.items:
            writer.writerow(
                [
                    item.source_url,
                    item.source_title or "",
                    item.target_url,
                    item.rel.value if hasattr(item.rel, "value") else item.rel,
                    item.anchor or "",
                    item.status.value if hasattr(item.status, "value") else item.status,
                    item.status_code or "",
                    item.authority,
                    item.toxicity,
                    item.first_seen.isoformat(),
                    item.last_seen.isoformat(),
                ]
            )
            yield buffer.getvalue()
            buffer.seek(0)
            buffer.truncate(0)


async def disavow_stream(session: AsyncSession, filters: BacklinkFilterParams):
    seen_domains: set[str] = set()
    async for chunk in _iter_backlinks(session, filters):
        for item in chunk.items:
            parsed = urlparse(item.source_url)
            domain = parsed.netloc
            if not domain:
                continue
            if domain in seen_domains:
                continue
            seen_domains.add(domain)
            yield f"domain:{domain}\n"
