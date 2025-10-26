from __future__ import annotations

from fastapi import APIRouter, Depends, status
from sqlalchemy.ext.asyncio import AsyncSession

from backlinks.api import deps
from backlinks.schemas.domain import DomainCreate, DomainOut
from backlinks.services.domains import create_domain

router = APIRouter(prefix="/projects/{project_id}/domains", tags=["domains"])


@router.post(
    "",
    response_model=DomainOut,
    status_code=status.HTTP_201_CREATED,
    summary="Create a domain for the project",
)
async def add_domain(
    payload: DomainCreate,
    project = Depends(deps.get_project_or_404),
    _: None = Depends(deps.authorize),
    session: AsyncSession = Depends(deps.get_session),
) -> DomainOut:
    domain = await create_domain(session, project.id, payload)
    return DomainOut.model_validate(domain)

