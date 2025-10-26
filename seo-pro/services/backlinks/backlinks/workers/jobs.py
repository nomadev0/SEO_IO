from __future__ import annotations

import random
from datetime import datetime, timedelta

from structlog import get_logger
from sqlalchemy import select

from backlinks.db.models import Backlink, BacklinkStatus, Domain, LinkEvent, LinkEventType, LinkRel, Page, PageStatus
from backlinks.db.session import get_sync_session

logger = get_logger()


def discover_backlinks(domain_id: int, limit: int = 50) -> None:
    """Simulate backlink discovery for a domain by generating synthetic data."""
    with get_sync_session() as session:
        domain = session.get(Domain, domain_id)
        if not domain:
            logger.warning("worker.domain_missing", domain_id=domain_id)
            return

        base_url = f"https://{domain.root_domain}"
        random.seed(domain_id + int(datetime.utcnow().timestamp()))

        for i in range(limit):
            page_url = f"{base_url}/auto-generated-{datetime.utcnow().strftime('%Y%m%d')}-{i}"
            page = session.scalar(select(Page).where(Page.url == page_url))
            if not page:
                page = Page(
                    domain_id=domain.id,
                    url=page_url,
                    status=random.choice(list(PageStatus)),
                    lang=random.choice(["en", "es", "de"]),
                    country_guess=random.choice(["US", "ES", "DE", "GB"]),
                    title=f"Auto discovery #{i}",
                    crawled_at=datetime.utcnow(),
                )
                session.add(page)
                session.flush()

            rel = random.choice(list(LinkRel))
            first_seen = datetime.utcnow() - timedelta(days=random.randint(0, 3))
            backlink = Backlink(
                source_page_id=page.id,
                target_url="https://clientsite.com/generated",
                rel=rel,
                anchor=f"Generated anchor {i}",
                context_snippet="Simulated context snippet",
                status=BacklinkStatus.active,
                status_code=random.choice([200, 204, 301]),
                first_seen=first_seen,
                last_seen=datetime.utcnow(),
                authority=round(random.uniform(10, 80), 2),
                toxicity=round(random.uniform(5, 50), 2),
                is_deleted=False,
            )
            session.add(backlink)
            session.flush()

            event = LinkEvent(
                backlink_id=backlink.id,
                event_type=LinkEventType.new,
                event_at=backlink.first_seen,
                diff={"origin": "worker"},
            )
            session.add(event)

        logger.info("worker.backlinks_generated", domain_id=domain.id, count=limit)
