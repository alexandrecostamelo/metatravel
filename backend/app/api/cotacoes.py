"""
Endpoints administrativos para gerenciar programas de milhas e
cadastrar novas cotações do milheiro.

No MVP isto é público; depois você protege com autenticação
(API key / JWT / OAuth2 — FastAPI tem suporte nativo a todos).
"""
from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.database import get_session
from app.models.milhas import CotacaoMilheiro, ProgramaMilhas
from app.schemas.cotacao import (
    CotacaoMilheiroIn,
    CotacaoMilheiroOut,
    ProgramaMilhasOut,
)

router = APIRouter(prefix="/cotacoes", tags=["cotacoes"])


@router.get("/programas", response_model=list[ProgramaMilhasOut])
async def listar_programas(session: AsyncSession = Depends(get_session)):
    result = await session.execute(select(ProgramaMilhas).order_by(ProgramaMilhas.slug))
    return result.scalars().all()


@router.post("/milheiro", response_model=CotacaoMilheiroOut, status_code=201)
async def cadastrar_cotacao(
    payload: CotacaoMilheiroIn,
    session: AsyncSession = Depends(get_session),
):
    # Acha o programa pelo slug
    result = await session.execute(
        select(ProgramaMilhas).where(ProgramaMilhas.slug == payload.programa_slug)
    )
    programa = result.scalar_one_or_none()
    if programa is None:
        raise HTTPException(status_code=404, detail=f"Programa '{payload.programa_slug}' não encontrado")

    # Cria nova cotação (mantemos histórico)
    cotacao = CotacaoMilheiro(
        programa_id=programa.id,
        valor_brl=payload.valor_brl,
        fonte=payload.fonte,
    )
    session.add(cotacao)
    await session.commit()
    await session.refresh(cotacao)
    return cotacao


@router.get("/milheiro/{slug}", response_model=CotacaoMilheiroOut)
async def cotacao_atual(slug: str, session: AsyncSession = Depends(get_session)):
    """Retorna a cotação vigente (mais recente) de um programa."""
    stmt = (
        select(CotacaoMilheiro)
        .join(ProgramaMilhas, ProgramaMilhas.id == CotacaoMilheiro.programa_id)
        .where(ProgramaMilhas.slug == slug)
        .order_by(CotacaoMilheiro.vigente_desde.desc())
        .limit(1)
    )
    result = await session.execute(stmt)
    cotacao = result.scalar_one_or_none()
    if cotacao is None:
        raise HTTPException(status_code=404, detail=f"Sem cotação para '{slug}'")
    return cotacao
