import asyncio
from typing import Optional
from uuid import UUID

from fastapi import APIRouter, Depends
from sqlalchemy.ext.asyncio import AsyncSession

from app.auth import get_current_user_optional
from app.database import get_session
from app.models.milhas import BuscaLog
from app.schemas.busca import BuscaRequest, BuscaResponse
from app.services.orquestrador import buscar_passagens

router = APIRouter()


async def _gravar_log(
    session: AsyncSession,
    req: BuscaRequest,
    user_id: Optional[UUID],
    total: int,
) -> None:
    log = BuscaLog(
        user_id=user_id,
        origem=req.origem,
        destino=req.destino,
        data_ida=req.data_ida,
        data_volta=req.data_volta,
        cabine=req.cabine.value,
        total_ofertas=total,
    )
    session.add(log)
    try:
        await session.commit()
    except Exception as exc:
        print(f"[busca_log] erro ao gravar: {exc}")


@router.post("/api/busca", response_model=BuscaResponse)
async def busca(
    req: BuscaRequest,
    session: AsyncSession = Depends(get_session),
    user_id: Optional[UUID] = Depends(get_current_user_optional),
) -> BuscaResponse:
    ofertas, cache_hit = await buscar_passagens(req, session)

    # Grava log sem bloquear a resposta (só em cache miss para não duplicar)
    if not cache_hit:
        asyncio.create_task(_gravar_log(session, req, user_id, len(ofertas)))

    return BuscaResponse(
        origem=req.origem,
        destino=req.destino,
        data_ida=req.data_ida,
        cabine=req.cabine,
        total=len(ofertas),
        cache_hit=cache_hit,
        ofertas=ofertas,
    )
