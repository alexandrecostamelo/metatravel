"""
Cotações de câmbio em BRL.

Ordem de tentativa:
  1. Redis cache (24h)
  2. BCB PTAX — tenta hoje e até 4 dias úteis anteriores (fins de semana / feriados)
  3. AwesomeAPI (economia.awesomeapi.com.br) — gratuita, sem chave
  4. Último valor em memória (fallback dentro da mesma instância)
"""
import logging
from datetime import date, timedelta
from decimal import Decimal
from typing import Optional

import httpx

from app.services.cache import cache_get, cache_set

logger = logging.getLogger(__name__)

_BCB_URL = (
    "https://olinda.bcb.gov.br/olinda/servico/PTAX/versao/v1/odata/"
    "CotacaoMoedaDia(moeda=@moeda,dataCotacao=@dataCotacao)"
)
_AWESOME_URL = "https://economia.awesomeapi.com.br/json/last/{par}"

# Fallback em memória (útil quando Redis também falha; não persiste em serverless)
_ultimo_conhecido: dict[str, Decimal] = {}


def _redis_key(moeda: str) -> str:
    # Chave sem data — armazena o valor mais recente independente do dia
    return f"ptax:{moeda}:latest"


async def _fetch_bcb(moeda: str) -> Optional[Decimal]:
    """Tenta BCB para hoje e recua até 4 dias (cobre fins de semana + feriado prolongado)."""
    for dias_atras in range(5):
        dia = date.today() - timedelta(days=dias_atras)
        # BCB só tem cotações em dias úteis (seg–sex)
        if dia.weekday() >= 5 and dias_atras == 0:
            continue
        params = {
            "@moeda": f"'{moeda}'",
            "@dataCotacao": f"'{dia.strftime('%m-%d-%Y')}'",
            "$format": "json",
            "$select": "cotacaoVenda",
        }
        try:
            async with httpx.AsyncClient(timeout=8.0) as client:
                resp = await client.get(_BCB_URL, params=params)
                resp.raise_for_status()
                items = resp.json().get("value", [])
                if items:
                    return Decimal(str(items[-1]["cotacaoVenda"]))
        except Exception as exc:
            logger.warning("[ptax] BCB %s dia %s: %s", moeda, dia, exc)
    return None


async def _fetch_awesome(moeda: str) -> Optional[Decimal]:
    """AwesomeAPI — gratuita, sem chave, suporta USD/EUR/GBP/AUD/CAD/JPY etc."""
    par = f"{moeda}-BRL"
    try:
        async with httpx.AsyncClient(timeout=8.0) as client:
            resp = await client.get(_AWESOME_URL.format(par=par))
            resp.raise_for_status()
            data = resp.json()
            chave = f"{moeda}BRL"
            if chave in data:
                return Decimal(str(data[chave]["ask"]))
    except Exception as exc:
        logger.warning("[ptax] AwesomeAPI %s: %s", moeda, exc)
    return None


async def get_ptax_brl(moeda: str) -> Decimal:
    """Retorna cotação de venda da moeda em BRL.

    Fluxo: Redis → BCB (com retry dias anteriores) → AwesomeAPI → memória → erro.
    """
    if moeda == "BRL":
        return Decimal("1")

    key = _redis_key(moeda)

    # 1. Redis cache
    cached = await cache_get(key)
    if cached is not None:
        return Decimal(str(cached))

    # 2. BCB PTAX
    valor = await _fetch_bcb(moeda)
    if valor is not None:
        await cache_set(key, str(valor), ttl=86400)
        _ultimo_conhecido[moeda] = valor
        return valor

    logger.warning("[ptax] BCB falhou para %s, tentando AwesomeAPI", moeda)

    # 3. AwesomeAPI
    valor = await _fetch_awesome(moeda)
    if valor is not None:
        await cache_set(key, str(valor), ttl=86400)
        _ultimo_conhecido[moeda] = valor
        return valor

    logger.warning("[ptax] AwesomeAPI falhou para %s", moeda)

    # 4. Último valor em memória
    if moeda in _ultimo_conhecido:
        logger.warning("[ptax] usando fallback em memória para %s", moeda)
        return _ultimo_conhecido[moeda]

    raise ValueError(f"Não foi possível obter cotação para {moeda} em nenhuma fonte")
