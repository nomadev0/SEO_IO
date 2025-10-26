from __future__ import annotations

from fastapi import APIRouter, Depends, status
from sqlalchemy.ext.asyncio import AsyncSession

from backlinks.api import deps
from backlinks.schemas.alert import AlertCreate, AlertOut
from backlinks.services.alerts import list_alerts, upsert_alert

router = APIRouter(prefix="/alerts", tags=["alerts"])


@router.post("", response_model=AlertOut, status_code=status.HTTP_201_CREATED)
async def create_or_update_alert(
    payload: AlertCreate,
    _: None = Depends(deps.authorize),
    session: AsyncSession = Depends(deps.get_session),
) -> AlertOut:
    alert = await upsert_alert(session, payload)
    return AlertOut.model_validate(alert)


@router.get("", response_model=list[AlertOut])
async def get_alerts(
    project_id: int,
    _: None = Depends(deps.authorize),
    session: AsyncSession = Depends(deps.get_session),
) -> list[AlertOut]:
    return await list_alerts(session, project_id)

