from collections.abc import AsyncGenerator
from typing import Optional

from sqlalchemy.ext.asyncio import (
    AsyncEngine,
    AsyncSession,
    async_sessionmaker,
    create_async_engine,
)

from app.config import settings

# asyncpg + Supavisor transaction mode exige esses connect_args
_connect_args = {
    "statement_cache_size": 0,
    "prepared_statement_cache_size": 0,
}

_engine: Optional[AsyncEngine] = None
_factory: Optional[async_sessionmaker] = None


def _init() -> async_sessionmaker:
    global _engine, _factory
    if _factory is None:
        if not settings.database_url:
            raise RuntimeError("DATABASE_URL não configurada")
        _engine = create_async_engine(
            settings.database_url,
            connect_args=_connect_args,
            pool_pre_ping=True,
        )
        _factory = async_sessionmaker(_engine, expire_on_commit=False)
    return _factory


def AsyncSessionLocal() -> AsyncSession:
    """Retorna um AsyncSession (context manager). Uso: async with AsyncSessionLocal() as s."""
    return _init()()


async def get_session() -> AsyncGenerator[AsyncSession, None]:
    async with _init()() as session:
        yield session
