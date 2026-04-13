"""
Cotações de câmbio turismo (BRL) para USD, EUR, GBP e CAD.
Fonte: economia.awesomeapi.com.br  (par *-BRLT = câmbio turismo)
Cache in-process de 15 minutos para não bater na API a cada request.
"""
import time
from typing import Optional

import httpx
from fastapi import APIRouter
from pydantic import BaseModel

router = APIRouter()

AWESOME_URL = (
    "https://economia.awesomeapi.com.br/json/last/"
    "USD-BRLT,EUR-BRLT,GBP-BRLT,CAD-BRLT"
)

_cache: Optional[dict] = None
_cache_ts: float = 0
CACHE_TTL = 15 * 60  # 15 minutos


class CotacoesResponse(BaseModel):
    USD: float
    EUR: float
    GBP: float
    CAD: float
    fonte: str = "awesomeapi / câmbio turismo"


@router.get("/api/cotacoes", response_model=CotacoesResponse)
async def get_cotacoes() -> CotacoesResponse:
    global _cache, _cache_ts

    if _cache and (time.time() - _cache_ts) < CACHE_TTL:
        return CotacoesResponse(**_cache)

    async with httpx.AsyncClient(timeout=8.0) as client:
        resp = await client.get(AWESOME_URL)
        resp.raise_for_status()
        data = resp.json()

    rates = {
        "USD": float(data.get("USDBRLT", {}).get("bid", 0)),
        "EUR": float(data.get("EURBRLT", {}).get("bid", 0)),
        "GBP": float(data.get("GBPBRLT", {}).get("bid", 0)),
        "CAD": float(data.get("CADBRLT", {}).get("bid", 0)),
    }

    _cache = rates
    _cache_ts = time.time()

    return CotacoesResponse(**rates)
