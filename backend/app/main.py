"""
Entry point do FastAPI.

No startup (via lifespan):
1. Cria as tabelas se não existirem (`Base.metadata.create_all`).
   Em produção você troca isso por migrations com Alembic.
2. Faz seed inicial do catálogo de programas + cotações de referência
   (valores médios de mercado; você atualiza depois via /cotacoes/milheiro).
"""
from contextlib import asynccontextmanager
from decimal import Decimal

from fastapi import FastAPI
from sqlalchemy import select

from app.api import busca, cotacoes, health
from app.config import settings
from app.database import AsyncSessionLocal, Base, engine
from app.models.milhas import CotacaoMilheiro, ProgramaMilhas


# Seed: programas + cotação inicial de referência em R$/milheiro
# (valores médios de mercado início de 2026 — você atualiza depois)
SEED_PROGRAMAS = [
    ("smiles", "GOL Smiles", Decimal("16.00")),
    ("azul", "Azul Fidelidade", Decimal("15.00")),
    ("latam_pass", "LATAM Pass", Decimal("25.00")),
    ("tap", "TAP Miles&Go", Decimal("40.00")),
    ("aeroplan", "Air Canada Aeroplan", Decimal("45.00")),
    ("avios_qatar", "Qatar Privilege Club (Avios)", Decimal("56.00")),
    ("avios_iberia", "Iberia Plus (Avios)", Decimal("56.00")),
    ("flying_blue", "Air France/KLM Flying Blue", Decimal("50.00")),
    ("united", "United MileagePlus", Decimal("48.00")),
    ("aadvantage", "American AAdvantage", Decimal("48.00")),
]


async def seed_inicial() -> None:
    """Popula o banco com programas e cotações se estiver vazio."""
    async with AsyncSessionLocal() as session:
        existing = await session.execute(select(ProgramaMilhas).limit(1))
        if existing.scalar_one_or_none() is not None:
            return  # já tem dado, não mexe

        for slug, nome, valor in SEED_PROGRAMAS:
            programa = ProgramaMilhas(slug=slug, nome=nome)
            session.add(programa)
            await session.flush()  # pega o id

            session.add(
                CotacaoMilheiro(
                    programa_id=programa.id,
                    valor_brl=valor,
                    fonte="seed_inicial",
                )
            )
        await session.commit()


@asynccontextmanager
async def lifespan(app: FastAPI):
    # Startup
    async with engine.begin() as conn:
        await conn.run_sync(Base.metadata.create_all)
    await seed_inicial()
    yield
    # Shutdown
    await engine.dispose()


app = FastAPI(
    title="Passagens em Milhas",
    description="Busca, valora e compara passagens em milhas em R$",
    version="0.1.0",
    debug=settings.app_debug,
    lifespan=lifespan,
)

app.include_router(health.router)
app.include_router(busca.router)
app.include_router(cotacoes.router)


@app.get("/")
async def root() -> dict[str, str]:
    return {
        "app": "passagens-milhas",
        "docs": "/docs",
        "health": "/health",
    }
