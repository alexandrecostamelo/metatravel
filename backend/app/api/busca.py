"""Endpoint de busca de passagens."""
from fastapi import APIRouter, Depends
from sqlalchemy.ext.asyncio import AsyncSession

from app.database import get_session
from app.schemas.busca import BuscaRequest, BuscaResponse
from app.services.orquestrador import buscar_passagens

router = APIRouter(prefix="/busca", tags=["busca"])


@router.post("", response_model=BuscaResponse)
async def buscar(
    req: BuscaRequest,
    session: AsyncSession = Depends(get_session),
) -> BuscaResponse:
    """Busca passagens em milhas em todos os provedores integrados,
    valora em R$ e devolve ordenado do mais barato ao mais caro."""
    ofertas = await buscar_passagens(req, session)
    return BuscaResponse(total=len(ofertas), ofertas=ofertas)
