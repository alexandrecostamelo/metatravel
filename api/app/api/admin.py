"""
Endpoints de administração — gerenciamento de programas e cotações do milheiro.
Requer autenticação JWT (Supabase).
"""
from datetime import datetime
from decimal import Decimal
from typing import Optional
from uuid import UUID

from fastapi import APIRouter, Depends, HTTPException, status
from pydantic import BaseModel, Field
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.auth import get_current_user
from app.database import get_session
from app.models.milhas import CotacaoMilheiro, ProgramaMilhas

router = APIRouter(prefix="/api/admin", tags=["admin"])


# ── Schemas ─────────────────────────────────────────────────────────────────

class ProgramaAdminOut(BaseModel):
    id: int
    slug: str
    nome: str
    moeda_taxas_default: str
    ativo: bool
    cotacao_atual_brl: Optional[Decimal] = None
    cotacao_vigente_desde: Optional[datetime] = None


class ProgramaCreate(BaseModel):
    slug: str = Field(..., min_length=2, max_length=64)
    nome: str = Field(..., min_length=2, max_length=128)
    moeda_taxas_default: str = Field(default="BRL", max_length=3)


class ProgramaUpdate(BaseModel):
    nome: Optional[str] = Field(None, min_length=2, max_length=128)
    ativo: Optional[bool] = None
    moeda_taxas_default: Optional[str] = Field(None, max_length=3)


class CotacaoCreate(BaseModel):
    valor_brl: Decimal = Field(..., gt=0, description="R$ por 1.000 milhas")


class CotacaoOut(BaseModel):
    id: int
    programa_id: int
    valor_brl: Decimal
    vigente_desde: datetime
    fonte: str


# ── Helpers ──────────────────────────────────────────────────────────────────

async def _get_programa(session: AsyncSession, programa_id: int) -> ProgramaMilhas:
    prog = await session.get(ProgramaMilhas, programa_id)
    if not prog:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Programa não encontrado")
    return prog


async def _latest_cotacao(session: AsyncSession, programa_id: int):
    stmt = (
        select(CotacaoMilheiro)
        .where(CotacaoMilheiro.programa_id == programa_id)
        .order_by(CotacaoMilheiro.vigente_desde.desc())
        .limit(1)
    )
    return (await session.execute(stmt)).scalar_one_or_none()


# ── Endpoints ────────────────────────────────────────────────────────────────

@router.get("/programas", response_model=list[ProgramaAdminOut])
async def listar_programas_admin(
    session: AsyncSession = Depends(get_session),
    _user: UUID = Depends(get_current_user),
) -> list[ProgramaAdminOut]:
    """Lista todos os programas (ativos e inativos) com cotação atual."""
    stmt = select(ProgramaMilhas).order_by(ProgramaMilhas.nome)
    programas = (await session.execute(stmt)).scalars().all()

    resultado = []
    for p in programas:
        cot = await _latest_cotacao(session, p.id)
        resultado.append(
            ProgramaAdminOut(
                id=p.id,
                slug=p.slug,
                nome=p.nome,
                moeda_taxas_default=p.moeda_taxas_default,
                ativo=p.ativo,
                cotacao_atual_brl=cot.valor_brl if cot else None,
                cotacao_vigente_desde=cot.vigente_desde if cot else None,
            )
        )
    return resultado


@router.post("/programas", response_model=ProgramaAdminOut, status_code=201)
async def criar_programa(
    body: ProgramaCreate,
    session: AsyncSession = Depends(get_session),
    _user: UUID = Depends(get_current_user),
) -> ProgramaAdminOut:
    """Cria um novo programa de milhas."""
    prog = ProgramaMilhas(
        slug=body.slug,
        nome=body.nome,
        moeda_taxas_default=body.moeda_taxas_default,
    )
    session.add(prog)
    await session.commit()
    await session.refresh(prog)
    return ProgramaAdminOut(
        id=prog.id, slug=prog.slug, nome=prog.nome,
        moeda_taxas_default=prog.moeda_taxas_default, ativo=prog.ativo,
    )


@router.patch("/programas/{programa_id}", response_model=ProgramaAdminOut)
async def atualizar_programa(
    programa_id: int,
    body: ProgramaUpdate,
    session: AsyncSession = Depends(get_session),
    _user: UUID = Depends(get_current_user),
) -> ProgramaAdminOut:
    """Atualiza nome, status ou moeda de um programa."""
    prog = await _get_programa(session, programa_id)
    if body.nome is not None:
        prog.nome = body.nome
    if body.ativo is not None:
        prog.ativo = body.ativo
    if body.moeda_taxas_default is not None:
        prog.moeda_taxas_default = body.moeda_taxas_default
    await session.commit()
    await session.refresh(prog)
    cot = await _latest_cotacao(session, prog.id)
    return ProgramaAdminOut(
        id=prog.id, slug=prog.slug, nome=prog.nome,
        moeda_taxas_default=prog.moeda_taxas_default, ativo=prog.ativo,
        cotacao_atual_brl=cot.valor_brl if cot else None,
        cotacao_vigente_desde=cot.vigente_desde if cot else None,
    )


@router.delete("/programas/{programa_id}", status_code=204)
async def deletar_programa(
    programa_id: int,
    session: AsyncSession = Depends(get_session),
    _user: UUID = Depends(get_current_user),
) -> None:
    """Remove um programa (hard delete). Use PATCH ativo=false para desativar."""
    prog = await _get_programa(session, programa_id)
    await session.delete(prog)
    await session.commit()


@router.get("/programas/{programa_id}/cotacoes", response_model=list[CotacaoOut])
async def historico_cotacoes(
    programa_id: int,
    session: AsyncSession = Depends(get_session),
    _user: UUID = Depends(get_current_user),
) -> list[CotacaoOut]:
    """Histórico de cotações de um programa."""
    await _get_programa(session, programa_id)
    stmt = (
        select(CotacaoMilheiro)
        .where(CotacaoMilheiro.programa_id == programa_id)
        .order_by(CotacaoMilheiro.vigente_desde.desc())
    )
    cotacoes = (await session.execute(stmt)).scalars().all()
    return [
        CotacaoOut(
            id=c.id, programa_id=c.programa_id,
            valor_brl=c.valor_brl, vigente_desde=c.vigente_desde, fonte=c.fonte,
        )
        for c in cotacoes
    ]


@router.post("/programas/{programa_id}/cotacao", response_model=CotacaoOut, status_code=201)
async def registrar_cotacao(
    programa_id: int,
    body: CotacaoCreate,
    session: AsyncSession = Depends(get_session),
    _user: UUID = Depends(get_current_user),
) -> CotacaoOut:
    """Registra uma nova cotação (R$/1.000 milhas) para o programa."""
    await _get_programa(session, programa_id)
    cot = CotacaoMilheiro(
        programa_id=programa_id,
        valor_brl=body.valor_brl,
        fonte="manual",
    )
    session.add(cot)
    await session.commit()
    await session.refresh(cot)
    return CotacaoOut(
        id=cot.id, programa_id=cot.programa_id,
        valor_brl=cot.valor_brl, vigente_desde=cot.vigente_desde, fonte=cot.fonte,
    )
