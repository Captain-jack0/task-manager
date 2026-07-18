"""Pytest fixtures.

Tests run against a real PostgreSQL database. Configure via env var
`TEST_DATABASE_URL` (default: same as DATABASE_URL but with `_test` suffix).
The schema is dropped and recreated for the session.
"""
from __future__ import annotations

import asyncio
import os
from collections.abc import AsyncGenerator
from urllib.parse import urlparse

import asyncpg
import pytest_asyncio
from httpx import ASGITransport, AsyncClient
from sqlalchemy.ext.asyncio import (
    AsyncSession,
    async_sessionmaker,
    create_async_engine,
)

# IMPORTANT: set test env BEFORE importing app modules so settings cache uses test DB.
TEST_DB_URL = os.environ.get(
    "TEST_DATABASE_URL",
    "postgresql+asyncpg://taskmanager:taskmanager@localhost:5432/taskmanager_test",
)
os.environ["DATABASE_URL"] = TEST_DB_URL
os.environ["JWT_SECRET"] = "test-secret"
os.environ["ENVIRONMENT"] = "test"

from app.api.deps import get_db  # noqa: E402
from app.db.base import Base  # noqa: E402
from app.main import create_app  # noqa: E402


def _ensure_test_database() -> None:
    """Create the test database if it does not yet exist (idempotent)."""
    parsed = urlparse(TEST_DB_URL.replace("postgresql+asyncpg://", "postgresql://"))
    db_name = (parsed.path or "/").lstrip("/")
    if not db_name:
        return

    async def _create() -> None:
        conn = await asyncpg.connect(
            user=parsed.username,
            password=parsed.password,
            host=parsed.hostname,
            port=parsed.port or 5432,
            database="postgres",
        )
        try:
            exists = await conn.fetchval(
                "SELECT 1 FROM pg_database WHERE datname = $1", db_name
            )
            if not exists:
                await conn.execute(f'CREATE DATABASE "{db_name}"')
        finally:
            await conn.close()

    asyncio.run(_create())


_ensure_test_database()
_engine = create_async_engine(TEST_DB_URL, echo=False, future=True)
_TestSession = async_sessionmaker(_engine, expire_on_commit=False, class_=AsyncSession)


@pytest_asyncio.fixture(scope="session", autouse=True, loop_scope="session")
async def _setup_db() -> AsyncGenerator[None, None]:
    async with _engine.begin() as conn:
        await conn.run_sync(Base.metadata.drop_all)
        await conn.run_sync(Base.metadata.create_all)
    yield
    async with _engine.begin() as conn:
        await conn.run_sync(Base.metadata.drop_all)
    await _engine.dispose()


@pytest_asyncio.fixture(loop_scope="session")
async def session() -> AsyncGenerator[AsyncSession, None]:
    async with _TestSession() as s:
        try:
            yield s
        finally:
            # The session may be in a failed transaction state after an
            # IntegrityError; rollback first, then truncate via a fresh
            # connection so each test starts from a clean slate.
            await s.rollback()
            async with _engine.begin() as conn:
                for table in reversed(Base.metadata.sorted_tables):
                    await conn.execute(table.delete())


@pytest_asyncio.fixture(loop_scope="session")
async def client(session: AsyncSession) -> AsyncGenerator[AsyncClient, None]:
    app = create_app()

    async def _override_get_db() -> AsyncGenerator[AsyncSession, None]:
        yield session

    app.dependency_overrides[get_db] = _override_get_db
    transport = ASGITransport(app=app)
    async with AsyncClient(transport=transport, base_url="http://test") as ac:
        yield ac
    app.dependency_overrides.clear()


@pytest_asyncio.fixture(loop_scope="session")
async def auth_headers(client: AsyncClient) -> dict[str, str]:
    resp = await client.post(
        "/auth/register",
        json={"email": "alice@example.com", "password": "password123"},
    )
    assert resp.status_code == 201, resp.text
    token = resp.json()["access_token"]
    return {"Authorization": f"Bearer {token}"}


@pytest_asyncio.fixture(loop_scope="session")
async def second_auth_headers(client: AsyncClient) -> dict[str, str]:
    resp = await client.post(
        "/auth/register",
        json={"email": "bob@example.com", "password": "password123"},
    )
    assert resp.status_code == 201, resp.text
    token = resp.json()["access_token"]
    return {"Authorization": f"Bearer {token}"}
