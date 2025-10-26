from __future__ import annotations

from collections.abc import AsyncGenerator

from fastapi import Depends, HTTPException, Path, status
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from backlinks.core.auth import dev_auth
from backlinks.db.models import Project
from backlinks.db.session import get_db_session


async def get_session() -> AsyncGenerator[AsyncSession, None]:
    async for session in get_db_session():
        yield session


async def authorize(_: None = Depends(dev_auth)) -> None:
    return


async def get_project_or_404(
    project_id: int = Path(..., ge=1),
    session: AsyncSession = Depends(get_session),
) -> Project:
    project = await session.scalar(select(Project).where(Project.id == project_id))
    if not project:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Project not found")
    return project

