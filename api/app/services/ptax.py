"""
Cotações de câmbio para uso interno (valoracao, cash_enrichment).

Ordem de tentativa:
  1. Redis cache (24h)
  2. AwesomeAPI (economia.awesomeapi.com.br) — gratuita, sem chave, sem restrição de dia útil
  3. BCB PTAX período (últimos 7 dias) — fallback quando AwesomeAPI falha
  4. Último valor em memória (dentro da mesma instância)
"""
import logging
from datetime import date, timedelta
from decimal import Decimal
from typing import Optional

import httpx

from app.services.cache import cache_get, cache_set

logger = logging.getLogger(__name__)

_AWESOME_URL = "https://economia.awesomeapi.com.br/json/last/{moeda}-BRL"
_BCB_URL = (
    "https://olinda.bcb.gov.br/olinda/servico/PTAX/versao/v1/odata/"
    "CotacaoMoedaPeriodo(moeda=@moeda,dataInicial=@dataInicial,dataFinalCotacao=@dataFinalCotacao)"
)

_ultimo_conhecido: dict[str, Decimal] = {}


def _redis_key(moeda: str) -> str:
    return f"ptax:{moeda}:latest"


async def _fetch_awesome(moeda: str) -> Optional[Decimal]:
    try:
        async with httpx.AsyncClient(timeout=8.0) as client:
            resp = await client.get(_AWESOME_URL.format(moeda=moeda))
            resp.raise_for_status()
            data = resp.json()
            chave = f"{moeda}BRL"
            if chave in data:
                ask = Decimal(str(data[chave]["ask"]))
                if ask > 0:
                    return ask
    except Exception as exc:
        logger.warning("[ptax] AwesomeAPI %s: %s", moeda, exc)
    return None


async def _fetch_bcb(moeda: str) -> Optional[Decimal]:
    hoje = date.today().strftime("%m-%d-%Y")
    semana = (date.today() - timedelta(days=7)).strftime("%m-%d-%Y")
    params = {
        "@moeda": f"'{moeda}'",
        "@dataInicial": f"'{semana}'",
        "@dataFinalCotacao": f"'{hoje}'",
        "$top": "1",
        "$orderby": "dataHoraCotacao desc",
        "$format": "json",
        "$select": "cotacaoVenda",
    }
    try:
        async with httpx.AsyncClient(timeout=8.0) as client:
            resp = await client.get(_BCB_URL, params=params)
            resp.raise_for_status()
            items = resp.json().get("value", [])
            if items:
                v = Decimal(str(items[0]["cotacaoVenda"]))
                if v > 0:
                    return v
    except Exception as exc:
        logger.warning("[ptax] BCB %s: %s", moeda, exc)
    return None


async def get_ptax_brl(moeda: str) -> Decimal:
    """Retorna cotação de venda da moeda em BRL. Nunca retorna None — levanta ValueError se tudo falhar."""
    if moeda == "BRL":
        return Decimal("1")

    key = _redis_key(moeda)

    # 1. Redis cache
    cached = await cache_get(key)
    if cached is not None:
        return Decimal(str(cached))

    # 2. AwesomeAPI (primário — sem restrição de dia útil)
    valor = await _fetch_awesome(moeda)
    if valor is not None:
        await cache_set(key, str(valor), ttl=86400)
        _ultimo_conhecido[moeda] = valor
        return valor

    logger.warning("[ptax] AwesomeAPI falhou para %s, tentando BCB", moeda)

    # 3. BCB período (últimos 7 dias)
    valor = await _fetch_bcb(moeda)
    if valor is not None:
        await cache_set(key, str(valor), ttl=86400)
        _ultimo_conhecido[moeda] = valor
        return valor

    logger.warning("[ptax] BCB falhou para %s", moeda)

    # 4. Último valor em memória
    if moeda in _ultimo_conhecido:
        return _ultimo_conhecido[moeda]

    raise ValueError(f"Não foi possível obter cotação para {moeda}")
