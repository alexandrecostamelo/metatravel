"""
Cotações de câmbio turismo (BRL).
- USD e EUR: par *-BRLT (câmbio turismo oficial da AwesomeAPI)
- GBP e CAD: par *-BRL comercial (BRLT não existe para essas moedas)
Todos usam o campo `ask` (taxa de venda — o que o turista paga).
Cache in-process de 15 minutos.
"""
import asyncio
import time
from typing import Optional

import httpx
from fastapi import APIRouter, HTTPException
from pydantic import BaseModel

router = APIRouter()

_cache: Optional[dict] = None
_cache_ts: float = 0
CACHE_TTL = 15 * 60  # 15 minutos


class CotacoesResponse(BaseModel):
    USD: float
    EUR: float
    GBP: float
    CAD: float
    fonte: str = "awesomeapi"


async def _fetch_pairs(client: httpx.AsyncClient, pairs: str) -> dict:
    url = f"https://economia.awesomeapi.com.br/json/last/{pairs}"
    resp = await client.get(url)
    resp.raise_for_status()
    return resp.json()


@router.get("/api/cotacoes", response_model=CotacoesResponse)
async def get_cotacoes() -> CotacoesResponse:
    global _cache, _cache_ts

    if _cache and (time.time() - _cache_ts) < CACHE_TTL:
        return CotacoesResponse(**_cache)

    try:
        async with httpx.AsyncClient(timeout=8.0) as client:
            # USD e EUR têm par BRLT (turismo); GBP e CAD só têm BRL (comercial)
            turismo, comercial = await asyncio.gather(
                _fetch_pairs(client, "USD-BRLT,EUR-BRLT"),
                _fetch_pairs(client, "GBP-BRL,CAD-BRL"),
            )
    except Exception as exc:
        raise HTTPException(status_code=502, detail=f"Erro ao buscar cotações: {exc}")

    rates = {
        "USD": float(turismo.get("USDBRLT", {}).get("ask", 0)),
        "EUR": float(turismo.get("EURBRLT", {}).get("ask", 0)),
        "GBP": float(comercial.get("GBPBRL", {}).get("ask", 0)),
        "CAD": float(comercial.get("CADBRL", {}).get("ask", 0)),
    }

    _cache = rates
    _cache_ts = time.time()
    return CotacoesResponse(**rates)
