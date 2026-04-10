"""
Utilitário para cotações PTAX do Banco Central do Brasil.
Docs: https://olinda.bcb.gov.br/olinda/servico/PTAX/versao/v1/swagger-ui3
"""
from datetime import date
from decimal import Decimal
from typing import Optional

import httpx

from app.services.cache import cache_get, cache_set

_BCB_URL = (
    "https://olinda.bcb.gov.br/olinda/servico/PTAX/versao/v1/odata/"
    "CotacaoMoedaDia(moeda=@moeda,dataCotacao=@dataCotacao)"
)

# Fallback em memória para último valor bem-sucedido
_ultimo_conhecido: dict[str, Decimal] = {}


def _cache_key(moeda: str, data: date) -> str:
    return f"ptax:{moeda}:{data.isoformat()}"


async def _fetch_bcb(moeda: str, data: date) -> Optional[Decimal]:
    params = {
        "@moeda": f"'{moeda}'",
        "@dataCotacao": f"'{data.strftime('%m-%d-%Y')}'",
        "$format": "json",
        "$select": "cotacaoVenda",
    }
    try:
        async with httpx.AsyncClient(timeout=8.0) as client:
            resp = await client.get(_BCB_URL, params=params)
            resp.raise_for_status()
            items = resp.json().get("value", [])
            if not items:
                return None
            return Decimal(str(items[-1]["cotacaoVenda"]))
    except Exception as exc:
        print(f"[ptax] erro ao buscar BCB {moeda}: {exc}")
        return None


async def get_ptax_brl(moeda: str) -> Decimal:
    """Retorna cotação de venda da moeda em BRL para hoje.

    Ordem: Redis cache → BCB → último valor conhecido em memória.
    BRL retorna 1 diretamente.
    """
    if moeda == "BRL":
        return Decimal("1")

    hoje = date.today()
    key = _cache_key(moeda, hoje)

    cached = await cache_get(key)
    if cached is not None:
        return Decimal(str(cached))

    valor = await _fetch_bcb(moeda, hoje)
    if valor is not None:
        await cache_set(key, str(valor), ttl=86400)  # 24h
        _ultimo_conhecido[moeda] = valor
        return valor

    # Fallback: último valor conhecido (mesmo expirado)
    if moeda in _ultimo_conhecido:
        print(f"[ptax] usando fallback em memória para {moeda}")
        return _ultimo_conhecido[moeda]

    raise ValueError(f"Não foi possível obter cotação PTAX para {moeda}")
