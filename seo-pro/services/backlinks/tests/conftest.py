from __future__ import annotations

import asyncio
import os
import pathlib

import pytest
from httpx import AsyncClient
from sqlalchemy.ext.asyncio import AsyncSession, async_sessionmaker, create_async_engine

from backlinks.api import deps
from backlinks.core.config import settings
from backlinks.db.base import Base
from backlinks.db.models import Project
from backlinks.main import app

TEST_DB_PATH = pathlib.Path(__file__).parent / "test_backlinks.db"
TEST_DATABASE_URL = f"sqlite+aiosqlite:///{TEST_DB_PATH.as_posix()}"

engine = create_async_engine(TEST_DATABASE_URL, future=True)
AsyncSessionFactory = async_sessionmaker(engine, expire_on_commit=False, class_=AsyncSession)


@pytest.fixture(scope="session")
def event_loop():
    loop = asyncio.new_event_loop()
    yield loop
    loop.close()


@pytest.fixture(scope="session", autouse=True)
async def prepare_database():
    if TEST_DB_PATH.exists():
        TEST_DB_PATH.unlink()
    async with engine.begin() as conn:
        await conn.run_sync(Base.metadata.create_all)
    yield
    async with engine.begin() as conn:
        await conn.run_sync(Base.metadata.drop_all)
    if TEST_DB_PATH.exists():
        TEST_DB_PATH.unlink()


@pytest.fixture
async def session() -> AsyncSession:
    async with AsyncSessionFactory() as session:
        yield session


@pytest.fixture
async def project(session: AsyncSession) -> Project:
    project = Project(name="Test Project")
    session.add(project)
    await session.commit()
    await session.refresh(project)
    return project


@pytest.fixture
async def client():
    async def override_get_session():
        async with AsyncSessionFactory() as session:
            yield session

    app.dependency_overrides[deps.get_session] = override_get_session
    async with AsyncClient(app=app, base_url="http://test") as client:
        yield client
    app.dependency_overrides.clear()


@pytest.fixture
def auth_headers():
    return {"Authorization": f"Bearer {settings.auth_dev_token}"}

