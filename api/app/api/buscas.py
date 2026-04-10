from datetime import date
from decimal import Decimal
from typing import Optional
from uuid import UUID

from fastapi import APIRouter, Depends, Query
from pydantic import BaseModel
from sqlalchemy import select, func
from sqlalchemy.ext.asyncio import AsyncSession

from app.auth import get_current_user
from app.database import get_session
from app.models.milhas import BuscaLog

router = APIRouter()


class BuscaLogOut(BaseModel):
    id: int
    origem: str
    destino: str
    data_ida: date
    data_volta: Optional[date] = None
    cabine: str
    total_ofertas: int


class BuscasResponse(BaseModel):
    total: int
    pagina: int
    por_pagina: int
    items: list[BuscaLogOut]


@router.get("/api/buscas/minhas", response_model=BuscasResponse)
async def minhas_buscas(
    pagina: int = Query(default=1, ge=1),
    por_pagina: int = Query(default=20, ge=1, le=100),
    user_id: UUID = Depends(get_current_user),
    session: AsyncSession = Depends(get_session),
) -> BuscasResponse:
    offset = (pagina - 1) * por_pagina

    total_stmt = select(func.count()).where(BuscaLog.user_id == user_id).select_from(BuscaLog)
    total = (await session.execute(total_stmt)).scalar_one()

    stmt = (
        select(BuscaLog)
        .where(BuscaLog.user_id == user_id)
        .order_by(BuscaLog.criado_em.desc())
        .offset(offset)
        .limit(por_pagina)
    )
    items = (await session.execute(stmt)).scalars().all()

    return BuscasResponse(
        total=total,
        pagina=pagina,
        por_pagina=por_pagina,
        items=[
            BuscaLogOut(
                id=b.id,
                origem=b.origem,
                destino=b.destino,
                data_ida=b.data_ida,
                data_volta=b.data_volta,
                cabine=b.cabine,
                total_ofertas=b.total_ofertas,
            )
            for b in items
        ],
    )
