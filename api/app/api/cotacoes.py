"""
Cotações de câmbio turismo (BRL) para o frontend.

Fontes (em ordem):
  1. Redis cache (1h)
  2. Frankfurter API (ECB) — gratuita, global, funciona de qualquer IP
  3. BCB PTAX — pode falhar em IPs fora do Brasil
  4. AwesomeAPI — pode falhar em IPs fora do Brasil
  5. Fallback estático (valores aproximados)
Aplica spread de 4% para aproximar câmbio turismo.
Salva taxas base no Redis para uso interno do ptax.py.
"""
import asyncio
import logging
import time
from typing import Optional

import httpx
from fastapi import APIRouter
from pydantic import BaseModel

from app.services.cache import cache_get, cache_set

router = APIRouter()
logger = logging.getLogger(__name__)

BCB_BASE = "https://olinda.bcb.gov.br/olinda/servico/PTAX/versao/v1/odata"
AWESOME_URL = "https://economia.awesomeapi.com.br/json/last/{pares}"
FRANKFURTER_URL = "https://api.frankfurter.app/latest"
TURISMO_SPREAD = 1.04
CACHE_KEY = "cotacoes:frontend:v2"
CACHE_TTL = 3600

MOEDAS = ["USD", "EUR", "GBP", "CAD"]
STATIC_FALLBACK = {"USD": 5.80, "EUR": 6.40, "GBP": 7.50, "CAD": 4.20}

_mem_cache: Optional[dict] = None
_mem_ts: float = 0
_MEM_TTL = 15 * 60


class CotacoesResponse(BaseModel):
    USD: float
    EUR: float
    GBP: float
    CAD: float
    fonte: str = "câmbio turismo estimado"


async def _fetch_frankfurter() -> dict[str, float]:
    """Frankfurter (ECB) — funciona globalmente, sem auth, sem restrição de IP."""
    try:
        async with httpx.AsyncClient(timeout=8.0) as client:
            resp = await client.get(
                FRANKFURTER_URL,
                params={"base": "EUR", "symbols": "USD,BRL,GBP,CAD"},
            )
            resp.raise_for_status()
            r = resp.json().get("rates", {})
            brl_eur = r.get("BRL", 0)
            if brl_eur <= 0:
                return {}
            return {
                "EUR": brl_eur,
                "USD": round(brl_eur / r["USD"], 4) if r.get("USD") else 0,
                "GBP": round(brl_eur / r["GBP"], 4) if r.get("GBP") else 0,
                "CAD": round(brl_eur / r["CAD"], 4) if r.get("CAD") else 0,
            }
    except Exception as exc:
        logger.warning("[cotacoes] Frankfurter: %s", exc)
        return {}


async def _fetch_bcb(client: httpx.AsyncClient, moeda: str) -> Optional[float]:
    from datetime import date, timedelta
    hoje = date.today().strftime("%m-%d-%Y")
    semana = (date.today() - timedelta(days=7)).strftime("%m-%d-%Y")
    url = (
        f"{BCB_BASE}/CotacaoMoedaPeriodo"
        f"(moeda=@moeda,dataInicial=@dataInicial,dataFinalCotacao=@dataFinalCotacao)"
        f"?@moeda='{moeda}'"
        f"&@dataInicial='{semana}'"
        f"&@dataFinalCotacao='{hoje}'"
        f"&$top=1&$orderby=dataHoraCotacao%20desc&$format=json&$select=cotacaoVenda"
    )
    try:
        resp = await client.get(url, timeout=8.0)
        resp.raise_for_status()
        values = resp.json().get("value", [])
        if values:
            v = float(values[0].get("cotacaoVenda", 0))
            return v if v > 0 else None
    except Exception as exc:
        logger.warning("[cotacoes] BCB %s: %s", moeda, exc)
    return None


async def _fetch_awesome_all() -> dict[str, float]:
    pares = ",".join(f"{m}-BRL" for m in MOEDAS)
    try:
        async with httpx.AsyncClient(timeout=8.0) as client:
            resp = await client.get(AWESOME_URL.format(pares=pares))
            resp.raise_for_status()
            data = resp.json()
            result = {}
            for moeda in MOEDAS:
                chave = f"{moeda}BRL"
                if chave in data:
                    ask = float(data[chave].get("ask", 0))
                    if ask > 0:
                        result[moeda] = ask
            return result
    except Exception as exc:
        logger.warning("[cotacoes] AwesomeAPI: %s", exc)
        return {}


async def _salvar_caches(rates: dict[str, float], fonte: str) -> None:
    """Salva no Redis (cotacoes + ptax individual) e atualiza memória."""
    global _mem_cache, _mem_ts
    payload = {**rates, "fonte": fonte}
    await cache_set(CACHE_KEY, rates, ttl=CACHE_TTL)
    for moeda, taxa_com_spread in rates.items():
        if isinstance(taxa_com_spread, float) and taxa_com_spread > 0:
            taxa_base = round(taxa_com_spread / TURISMO_SPREAD, 4)
            await cache_set(f"ptax:{moeda}:latest", str(taxa_base), ttl=CACHE_TTL)
    _mem_cache = rates
    _mem_ts = time.time()


@router.get("/api/cotacoes", response_model=CotacoesResponse)
async def get_cotacoes() -> CotacoesResponse:
    global _mem_cache, _mem_ts

    # 1. Memória recente
    if _mem_cache and (time.time() - _mem_ts) < _MEM_TTL:
        return CotacoesResponse(**_mem_cache)

    # 2. Redis
    cached = await cache_get(CACHE_KEY)
    if cached and all(cached.get(m, 0) > 0 for m in MOEDAS):
        _mem_cache = cached
        _mem_ts = time.time()
        return CotacoesResponse(**cached)

    # 3. Frankfurter + BCB + AwesomeAPI em paralelo
    async with httpx.AsyncClient(timeout=8.0) as client:
        bcb_tasks = [_fetch_bcb(client, m) for m in MOEDAS]
        frankfurter, bcb_results, awesome = await asyncio.gather(
            _fetch_frankfurter(),
            asyncio.gather(*bcb_tasks, return_exceptions=True),
            _fetch_awesome_all(),
        )

    rates: dict[str, float] = {}
    for moeda, bcb_val in zip(MOEDAS, bcb_results):
        if isinstance(bcb_val, Exception):
            bcb_val = None
        if bcb_val and bcb_val > 0:
            rates[moeda] = round(bcb_val * TURISMO_SPREAD, 4)
        elif frankfurter.get(moeda, 0) > 0:
            rates[moeda] = round(frankfurter[moeda] * TURISMO_SPREAD, 4)
        elif awesome.get(moeda, 0) > 0:
            rates[moeda] = round(awesome[moeda] * TURISMO_SPREAD, 4)

    if rates.get("USD") and rates.get("EUR"):
        for m in MOEDAS:
            rates.setdefault(m, 0.0)
        await _salvar_caches(rates, "Frankfurter/BCB/AwesomeAPI")
        return CotacoesResponse(**rates)

    # 4. Cache expirado do Redis
    if cached:
        return CotacoesResponse(**cached)

    # 5. Fallback estático — salva no Redis para o ptax.py poder usar
    logger.error("[cotacoes] todas as fontes falharam — usando fallback estático")
    fallback_with_spread = {m: round(v * TURISMO_SPREAD, 4) for m, v in STATIC_FALLBACK.items()}
    await _salvar_caches(fallback_with_spread, "fallback estático")
    return CotacoesResponse(**fallback_with_spread, fonte="fallback estático — atualizar em breve")
