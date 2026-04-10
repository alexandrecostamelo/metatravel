from decimal import Decimal
from typing import Optional

from fastapi import APIRouter, Depends
from pydantic import BaseModel
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.database import get_session
from app.models.milhas import CotacaoMilheiro, ProgramaMilhas

router = APIRouter()


class ProgramaOut(BaseModel):
    id: int
    slug: str
    nome: str
    moeda_taxas_default: str
    ativo: bool
    cotacao_atual_brl: Optional[Decimal] = None


@router.get("/api/programas", response_model=list[ProgramaOut])
async def listar_programas(session: AsyncSession = Depends(get_session)) -> list[ProgramaOut]:
    stmt = (
        select(ProgramaMilhas, CotacaoMilheiro.valor_brl)
        .outerjoin(
            CotacaoMilheiro,
            CotacaoMilheiro.programa_id == ProgramaMilhas.id,
        )
        .where(ProgramaMilhas.ativo == True)
        .order_by(ProgramaMilhas.nome, CotacaoMilheiro.vigente_desde.desc())
    )
    rows = (await session.execute(stmt)).all()

    vistos: set[int] = set()
    resultado: list[ProgramaOut] = []
    for programa, valor_brl in rows:
        if programa.id in vistos:
            continue
        vistos.add(programa.id)
        resultado.append(
            ProgramaOut(
                id=programa.id,
                slug=programa.slug,
                nome=programa.nome,
                moeda_taxas_default=programa.moeda_taxas_default,
                ativo=programa.ativo,
                cotacao_atual_brl=valor_brl,
            )
        )
    return resultado
