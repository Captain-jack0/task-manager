import ssl as ssl_lib
from collections.abc import AsyncGenerator
from typing import Any
from urllib.parse import parse_qsl, urlencode, urlsplit, urlunsplit

from sqlalchemy.ext.asyncio import (
    AsyncSession,
    async_sessionmaker,
    create_async_engine,
)

from app.config import get_settings

_settings = get_settings()

_SSL_REQUIRING = {"require", "prefer", "allow", "verify-ca", "verify-full"}


def _engine_args(database_url: str) -> tuple[str, dict[str, Any]]:
    """Normalise the DB URL for asyncpg.

    Managed Postgres (Neon, Supabase, Render) require TLS and hand out libpq-style
    URLs with `?sslmode=require`. asyncpg does not understand `sslmode` and raises
    on it, so we strip it and pass an SSL context instead — letting the operator
    paste the provider's connection string almost verbatim.
    """
    parts = urlsplit(database_url)
    query = dict(parse_qsl(parts.query))
    sslmode = query.pop("sslmode", None)
    ssl_flag = query.pop("ssl", None)
    # libpq params asyncpg doesn't accept (Neon puts channel_binding in its URL).
    query.pop("channel_binding", None)

    connect_args: dict[str, Any] = {}
    if sslmode in _SSL_REQUIRING or ssl_flag in ("require", "true", "1"):
        ctx = ssl_lib.create_default_context()
        # `require` means "encrypt" without full cert-chain verification, which
        # matches how these providers are normally used; verify-* keeps it strict.
        if sslmode not in ("verify-ca", "verify-full"):
            ctx.check_hostname = False
            ctx.verify_mode = ssl_lib.CERT_NONE
        connect_args["ssl"] = ctx

    clean_url = urlunsplit(
        (parts.scheme, parts.netloc, parts.path, urlencode(query), parts.fragment)
    )
    return clean_url, connect_args


_url, _connect_args = _engine_args(_settings.database_url)

engine = create_async_engine(
    _url,
    echo=_settings.environment == "development",
    pool_pre_ping=True,
    future=True,
    connect_args=_connect_args,
)

SessionLocal = async_sessionmaker(
    engine, class_=AsyncSession, expire_on_commit=False, autoflush=False
)


async def get_session() -> AsyncGenerator[AsyncSession, None]:
    async with SessionLocal() as session:
        try:
            yield session
        except Exception:
            await session.rollback()
            raise
        finally:
            await session.close()
