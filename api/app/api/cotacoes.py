"""
Cotações de câmbio turismo (BRL).
Um único request com os 4 pares comerciais + spread de 4% = aproximação turismo.
Cache in-process de 15 minutos.
"""
import time
from typing import Optional

import httpx
from fastapi import APIRouter, HTTPException
from pydantic import BaseModel

router = APIRouter()

AWESOME_URL = "https://economia.awesomeapi.com.br/json/last/USD-BRL,EUR-BRL,GBP-BRL,CAD-BRL"
TURISMO_SPREAD = 1.04  # ~4% sobre a taxa comercial
CACHE_TTL = 15 * 60   # 15 minutos

_cache: Optional[dict] = None
_cache_ts: float = 0


class CotacoesResponse(BaseModel):
    USD: float
    EUR: float
    GBP: float
    CAD: float
    fonte: str = "awesomeapi / câmbio turismo estimado"


@router.get("/api/cotacoes", response_model=CotacoesResponse)
async def get_cotacoes() -> CotacoesResponse:
    global _cache, _cache_ts

    if _cache and (time.time() - _cache_ts) < CACHE_TTL:
        return CotacoesResponse(**_cache)

    try:
        async with httpx.AsyncClient(timeout=8.0) as client:
            resp = await client.get(AWESOME_URL)
            resp.raise_for_status()
            data = resp.json()
    except Exception as exc:
        raise HTTPException(status_code=502, detail=f"Erro ao buscar cotações: {exc}")

    def rate(key: str) -> float:
        return round(float(data.get(key, {}).get("ask", 0)) * TURISMO_SPREAD, 4)

    rates = {
        "USD": rate("USDBRL"),
        "EUR": rate("EURBRL"),
        "GBP": rate("GBPBRL"),
        "CAD": rate("CADBRL"),
    }

    _cache = rates
    _cache_ts = time.time()
    return CotacoesResponse(**rates)
