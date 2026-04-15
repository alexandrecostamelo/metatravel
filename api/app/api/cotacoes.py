"""
Cotações de câmbio turismo (BRL) para o frontend.

Fontes (em ordem de preferência por moeda):
  1. BCB PTAX — período de 7 dias para cobrir fins de semana/feriados
  2. AwesomeAPI (economia.awesomeapi.com.br) — gratuita, sem chave
Aplica spread de 4% sobre a taxa de venda para aproximar câmbio turismo.
Cache Redis 1h; fallback em memória dentro da mesma instância.
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
TURISMO_SPREAD = 1.04
CACHE_KEY = "cotacoes:frontend:v2"
CACHE_TTL = 3600  # 1h no Redis

MOEDAS = ["USD", "EUR", "GBP", "CAD"]

# Fallback em memória (não persiste em serverless — apenas último request)
_mem_cache: Optional[dict] = None
_mem_ts: float = 0
_MEM_TTL = 15 * 60


class CotacoesResponse(BaseModel):
    USD: float
    EUR: float
    GBP: float
    CAD: float
    fonte: str = "BCB PTAX + AwesomeAPI / câmbio turismo estimado"


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


@router.get("/api/cotacoes", response_model=CotacoesResponse)
async def get_cotacoes() -> CotacoesResponse:
    global _mem_cache, _mem_ts

    # 1. Memória recente (15min)
    if _mem_cache and (time.time() - _mem_ts) < _MEM_TTL:
        return CotacoesResponse(**_mem_cache)

    # 2. Redis cache (1h)
    cached = await cache_get(CACHE_KEY)
    if cached and all(cached.get(m, 0) > 0 for m in MOEDAS):
        _mem_cache = cached
        _mem_ts = time.time()
        return CotacoesResponse(**cached)

    # 3. Busca BCB + AwesomeAPI em paralelo
    async with httpx.AsyncClient(timeout=8.0) as client:
        bcb_tasks = [_fetch_bcb(client, m) for m in MOEDAS]
        bcb_results, awesome = await asyncio.gather(
            asyncio.gather(*bcb_tasks, return_exceptions=True),
            _fetch_awesome_all(),
        )

    rates: dict[str, float] = {}
    for moeda, bcb_val in zip(MOEDAS, bcb_results):
        if isinstance(bcb_val, Exception):
            bcb_val = None
        if bcb_val and bcb_val > 0:
            rates[moeda] = round(bcb_val * TURISMO_SPREAD, 4)
        elif moeda in awesome and awesome[moeda] > 0:
            logger.warning("[cotacoes] usando AwesomeAPI para %s (BCB indisponível)", moeda)
            rates[moeda] = round(awesome[moeda] * TURISMO_SPREAD, 4)
        else:
            logger.error("[cotacoes] sem cotação para %s em nenhuma fonte", moeda)

    # Só salva no cache se tiver pelo menos USD e EUR
    if rates.get("USD") and rates.get("EUR"):
        # Preenche moedas faltantes com 0 para não quebrar o schema
        for m in MOEDAS:
            rates.setdefault(m, 0.0)
        await cache_set(CACHE_KEY, rates, ttl=CACHE_TTL)
        _mem_cache = rates
        _mem_ts = time.time()
        return CotacoesResponse(**rates)

    # Último recurso: retorna o que estava em cache mesmo expirado
    if cached:
        return CotacoesResponse(**cached)

    # Se não tiver absolutamente nada, retorna valores de emergência com flag
    logger.error("[cotacoes] todas as fontes falharam — retornando valores de emergência")
    fallback = {"USD": 5.80, "EUR": 6.40, "GBP": 7.50, "CAD": 4.20}
    return CotacoesResponse(**fallback, fonte="fallback estático — atualizar em breve")
