from __future__ import annotations

from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession
from structlog import get_logger

from backlinks.db.models import Alert
from backlinks.schemas.alert import AlertCreate, AlertOut

logger = get_logger()


async def upsert_alert(session: AsyncSession, payload: AlertCreate) -> Alert:
    existing = await session.scalar(
        select(Alert).where(Alert.project_id == payload.project_id, Alert.channel == payload.channel)
    )

    if existing and existing.rule_json.get("name") == payload.rule.name:
        existing.rule_json = payload.rule.model_dump()
        existing.is_active = payload.is_active
        session.add(existing)
        await session.commit()
        await session.refresh(existing)
        logger.info("alert.updated", alert_id=existing.id, project_id=existing.project_id)
        return existing

    alert = Alert(
        project_id=payload.project_id,
        channel=payload.channel,
        rule_json=payload.rule.model_dump(),
        is_active=payload.is_active,
    )
    session.add(alert)
    await session.commit()
    await session.refresh(alert)
    logger.info("alert.created", alert_id=alert.id, project_id=alert.project_id)
    return alert


async def list_alerts(session: AsyncSession, project_id: int) -> list[AlertOut]:
    alerts = (await session.execute(select(Alert).where(Alert.project_id == project_id))).scalars().all()
    return [AlertOut.model_validate(a) for a in alerts]
