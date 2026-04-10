"""
Setup do SQLAlchemy 2.0 em modo assíncrono.

- `engine` é o pool de conexões.
- `AsyncSessionLocal` é a factory de sessões (use via dependência `get_session`).
- `Base` é a classe-pai dos models declarativos.
"""
from collections.abc import AsyncGenerator

from sqlalchemy.ext.asyncio import (
    AsyncSession,
    async_sessionmaker,
    create_async_engine,
)
from sqlalchemy.orm import DeclarativeBase

from app.config import settings


engine = create_async_engine(
    settings.database_url,
    echo=settings.app_debug,
    pool_pre_ping=True,
)

AsyncSessionLocal = async_sessionmaker(
    engine,
    class_=AsyncSession,
    expire_on_commit=False,
)


class Base(DeclarativeBase):
    """Base declarativa para os models do SQLAlchemy."""
    pass


async def get_session() -> AsyncGenerator[AsyncSession, None]:
    """Dependência do FastAPI para injetar uma sessão por request."""
    async with AsyncSessionLocal() as session:
        yield session
