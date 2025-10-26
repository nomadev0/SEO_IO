from __future__ import annotations

from collections.abc import AsyncGenerator, Generator
from contextlib import contextmanager

from sqlalchemy import create_engine
from sqlalchemy.ext.asyncio import AsyncSession, async_sessionmaker, create_async_engine
from sqlalchemy.orm import Session, sessionmaker

from backlinks.core.config import settings

async_engine = create_async_engine(settings.database_url, echo=False, pool_pre_ping=True)
async_session_factory = async_sessionmaker(async_engine, expire_on_commit=False)

sync_engine = create_engine(settings.sync_database_url, echo=False, pool_pre_ping=True)
sync_session_factory = sessionmaker(bind=sync_engine, expire_on_commit=False)


async def get_db_session() -> AsyncGenerator[AsyncSession, None]:
    async with async_session_factory() as session:
        yield session


@contextmanager
def get_sync_session() -> Generator[Session, None, None]:
    session: Session = sync_session_factory()
    try:
        yield session
        session.commit()
    finally:
        session.close()

