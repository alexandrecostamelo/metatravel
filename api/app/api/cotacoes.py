"""
Cotações de câmbio turismo (BRL) via Banco Central do Brasil (PTAX).
API oficial: olinda.bcb.gov.br — sem rate limit, sem autenticação.
Busca os últimos 7 dias para cobrir fins de semana/feriados.
Aplica spread de 4% sobre a taxa PTAX venda para aproximar câmbio turismo.
Cache in-process de 15 minutos.
"""
import asyncio
import time
from datetime import date, timedelta
from typing import Optional

import httpx
from fastapi import APIRouter, HTTPException
from pydantic import BaseModel

router = APIRouter()

BCB_BASE = "https://olinda.bcb.gov.br/olinda/servico/PTAX/versao/v1/odata"
TURISMO_SPREAD = 1.04   # +4% sobre PTAX venda ≈ câmbio turismo
CACHE_TTL = 15 * 60     # 15 minutos

_cache: Optional[dict] = None
_cache_ts: float = 0

MOEDAS = ["USD", "EUR", "GBP", "CAD"]


class CotacoesResponse(BaseModel):
    USD: float
    EUR: float
    GBP: float
    CAD: float
    fonte: str = "BCB PTAX / câmbio turismo estimado"


async def _fetch_moeda(client: httpx.AsyncClient, moeda: str, hoje: str, semana: str) -> float:
    url = (
        f"{BCB_BASE}/CotacaoMoedaPeriodo"
        f"(moeda=@moeda,dataInicial=@dataInicial,dataFinalCotacao=@dataFinalCotacao)"
        f"?@moeda='{moeda}'"
        f"&@dataInicial='{semana}'"
        f"&@dataFinalCotacao='{hoje}'"
        f"&$top=1&$orderby=dataHoraCotacao%20desc&$format=json&$select=cotacaoVenda"
    )
    resp = await client.get(url)
    resp.raise_for_status()
    data = resp.json()
    values = data.get("value", [])
    if not values:
        return 0.0
    return float(values[0].get("cotacaoVenda", 0))


@router.get("/api/cotacoes", response_model=CotacoesResponse)
async def get_cotacoes() -> CotacoesResponse:
    global _cache, _cache_ts

    if _cache and (time.time() - _cache_ts) < CACHE_TTL:
        return CotacoesResponse(**_cache)

    hoje = date.today().strftime("%m-%d-%Y")
    semana = (date.today() - timedelta(days=7)).strftime("%m-%d-%Y")

    try:
        async with httpx.AsyncClient(timeout=10.0) as client:
            results = await asyncio.gather(
                *[_fetch_moeda(client, m, hoje, semana) for m in MOEDAS],
                return_exceptions=True,
            )
    except Exception as exc:
        raise HTTPException(status_code=502, detail=f"Erro BCB: {exc}")

    rates: dict[str, float] = {}
    for moeda, result in zip(MOEDAS, results):
        if isinstance(result, Exception) or result == 0.0:
            raise HTTPException(status_code=502, detail=f"Cotação indisponível para {moeda}")
        rates[moeda] = round(result * TURISMO_SPREAD, 4)

    _cache = rates
    _cache_ts = time.time()
    return CotacoesResponse(**rates)
