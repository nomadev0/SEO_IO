from __future__ import annotations

import random
from datetime import datetime, timedelta

from sqlalchemy import func, select
from sqlalchemy.orm import Session

from backlinks.db.models import (
    Alert,
    Backlink,
    BacklinkStatus,
    Domain,
    LinkEvent,
    LinkEventType,
    LinkRel,
    Outreach,
    OutreachStage,
    Page,
    PageStatus,
    PageScore,
    Project,
)
from backlinks.db.session import get_sync_session

DOMAIN_CONFIG = [
    {
        "root_domain": "clientsite.com",
        "tld": "com",
        "country": "US",
        "authority": 62.0,
        "toxicity": 14.0,
    },
    {
        "root_domain": "competitor-one.com",
        "tld": "com",
        "country": "US",
        "authority": 58.0,
        "toxicity": 21.0,
    },
    {
        "root_domain": "competitor-two.io",
        "tld": "io",
        "country": "GB",
        "authority": 54.0,
        "toxicity": 17.0,
    },
]

TARGET_PAGES = [
    "/blog/seo-checklist",
    "/guides/link-building",
    "/resources/backlink-analysis",
    "/pricing",
    "/case-studies/saas",
    "/contact",
    "/webinars/backlink-quality",
]


def ensure_project(session: Session) -> Project:
    project = session.scalar(select(Project).where(Project.name == "Backlinks Demo"))
    if project:
        return project
    project = Project(name="Backlinks Demo")
    session.add(project)
    session.commit()
    session.refresh(project)
    return project


def create_domains(session: Session, project: Project) -> list[Domain]:
    created: list[Domain] = []
    for cfg in DOMAIN_CONFIG:
        domain = session.scalar(
            select(Domain).where(Domain.project_id == project.id, Domain.root_domain == cfg["root_domain"])
        )
        if domain:
            created.append(domain)
            continue
        domain = Domain(
            project_id=project.id,
            root_domain=cfg["root_domain"],
            tld=cfg["tld"],
            whois_country=cfg["country"],
            authority_score=cfg["authority"],
            toxicity_score=cfg["toxicity"],
            first_seen=datetime.utcnow() - timedelta(days=90),
            last_seen=datetime.utcnow(),
        )
        session.add(domain)
        created.append(domain)
    session.commit()
    return created


def generate_pages(session: Session, domain: Domain, count: int = 80) -> list[Page]:
    pages: list[Page] = []
    base_url = f"https://{domain.root_domain}"
    page_templates = [
        "/blog/{topic}-tips",
        "/news/{topic}-update",
        "/guides/{topic}-playbook",
        "/{topic}-resources",
        "/{topic}/case-study",
        "/{topic}/tools",
    ]
    topics = [
        "seo",
        "content",
        "growth",
        "marketing",
        "analytics",
        "backlinks",
        "technical-seo",
        "digital-pr",
    ]
    for i in range(count):
        topic = random.choice(topics)
        template = random.choice(page_templates)
        slug = template.format(topic=topic)
        url = f"{base_url}{slug}-{i}"
        page = Page(
            domain_id=domain.id,
            url=url,
            status=random.choice(list(PageStatus)),
            lang=random.choice(["en", "es", "fr", "de"]),
            country_guess=random.choice(["US", "ES", "FR", "DE", "GB"]),
            title=f"{topic.replace('-', ' ').title()} insights #{i}",
            crawled_at=datetime.utcnow() - timedelta(days=random.randint(0, 30)),
        )
        session.add(page)
        pages.append(page)
    session.commit()
    return pages


def generate_backlinks(
    session: Session,
    project: Project,
    domains: list[Domain],
    total: int = 1500,
    events_target: int = 400,
) -> None:
    random.seed(2024)
    created = 0
    event_count = 0
    base_date = datetime.utcnow()
    pages_cache: dict[int, list[Page]] = {d.id: generate_pages(session, d) for d in domains}

    while created < total:
        domain = random.choice(domains)
        page = random.choice(pages_cache[domain.id])
        target_path = random.choice(TARGET_PAGES)
        target_url = f"https://clientsite.com{target_path}"
        first_seen = base_date - timedelta(days=random.randint(5, 120))
        last_seen = first_seen + timedelta(days=random.randint(0, 60))

        rel = random.choices(
            [LinkRel.dofollow, LinkRel.nofollow, LinkRel.sponsored, LinkRel.ugc],
            weights=[0.6, 0.25, 0.1, 0.05],
            k=1,
        )[0]
        status = random.choices(
            [BacklinkStatus.active, BacklinkStatus.lost, BacklinkStatus.pending],
            weights=[0.7, 0.2, 0.1],
            k=1,
        )[0]

        backlink = Backlink(
            source_page_id=page.id,
            target_url=target_url,
            rel=rel,
            anchor=random.choice(
                [
                    "SEO insights",
                    "Backlink strategies",
                    "Marketing report",
                    "Growth hacking",
                    "SaaS benchmarks",
                ]
            ),
            context_snippet="Lorem ipsum dolor sit amet, consectetur adipiscing elit.",
            status=status,
            status_code=random.choice([200, 301, 302, 404, 410]),
            first_seen=first_seen,
            last_seen=last_seen,
            authority=round(random.uniform(15, 90), 2),
            toxicity=round(random.uniform(5, 80), 2),
            is_deleted=status == BacklinkStatus.lost,
        )
        session.add(backlink)
        session.flush()

        # Attach page score heuristics
        score = PageScore(
            page_id=page.id,
            authority=round(random.uniform(10, 70), 2),
            outlinks=random.randint(5, 120),
            topical=[random.choice(["SEO", "Content", "PR", "Technical", "Links"]) for _ in range(3)],
            updated_at=last_seen,
        )
        session.merge(score)

        # Outreach sample
        if random.random() < 0.2:
            outreach = Outreach(
                backlink_id=backlink.id,
                stage=random.choice(list(OutreachStage)),
                owner=random.choice(["Alice", "Bob", "Carol", "Diego"]),
                cost=round(random.uniform(50, 400), 2),
                notes="Generated via demo seed.",
            )
            session.add(outreach)

        # Events: always a "new"
        new_event = LinkEvent(
            backlink_id=backlink.id,
            event_type=LinkEventType.new,
            event_at=first_seen,
            diff={"status": "new"},
        )
        session.add(new_event)
        event_count += 1

        if status == BacklinkStatus.lost and event_count < events_target:
            lost_event = LinkEvent(
                backlink_id=backlink.id,
                event_type=LinkEventType.lost,
                event_at=last_seen,
                diff={"status": "lost"},
            )
            session.add(lost_event)
            event_count += 1
        elif status == BacklinkStatus.active and random.random() < 0.15 and event_count < events_target:
            changed_event = LinkEvent(
                backlink_id=backlink.id,
                event_type=LinkEventType.changed,
                event_at=last_seen,
                diff={"anchor": "Updated anchor text"},
            )
            session.add(changed_event)
            event_count += 1

        created += 1

    session.commit()


def seed_alert(session: Session, project: Project) -> None:
    existing = session.scalar(select(Alert).where(Alert.project_id == project.id))
    if existing:
        return
    alert = Alert(
        project_id=project.id,
        rule_json={
            "name": "lost-backlinks-spike",
            "description": ">50 enlaces perdidos en 24h",
            "condition": {"type": "lost_backlinks", "threshold": 50, "window_hours": 24},
        },
        channel="webhook",
        is_active=True,
    )
    session.add(alert)
    session.commit()


def run() -> None:
    with get_sync_session() as session:
        existing = session.scalar(select(func.count(Backlink.id)))  # type: ignore[name-defined]
        if existing and existing > 0:
            print("Seed data already present; skipping.")
            return
        project = ensure_project(session)
        domains = create_domains(session, project)
        generate_backlinks(session, project, domains)
            seed_alert(session, project)
        print("Demo seed completed.")


if __name__ == "__main__":
    run()
