"""
Adapter Duffel — busca o menor preço em dinheiro para um trecho/data/cabine.
Usa a REST API diretamente via httpx (compatível com async).
"""
import hashlib
import logging
from decimal import Decimal
from typing import Optional

import httpx

from app.config import settings
from app.schemas.oferta import Cabine
from app.services.cache import cache_get, cache_set

logger = logging.getLogger(__name__)

DUFFEL_BASE = "https://api.duffel.com"
DUFFEL_VERSION = "v2"

CABIN_MAP: dict[Cabine, str] = {
    Cabine.ECONOMICA: "economy",
    Cabine.PREMIUM_ECONOMICA: "premium_economy",
    Cabine.EXECUTIVA: "business",
    Cabine.PRIMEIRA: "first",
}


def _cache_key(origem: str, destino: str, data: str, cabine: str, adultos: int) -> str:
    raw = f"duffel:{origem}:{destino}:{data}:{cabine}:{adultos}"
    digest = hashlib.sha256(raw.encode()).hexdigest()[:16]
    return f"duffel:{digest}"


async def buscar_cash_equivalente(
    origem: str,
    destino: str,
    data_ida: str,
    cabine: Cabine,
    adultos: int = 1,
) -> Optional[dict]:
    """
    Retorna {'preco': str(Decimal), 'moeda': str} com o menor preço encontrado,
    ou None se indisponível / Duffel não configurado.
    """
    if not settings.duffel_api_key:
        return None

    key = _cache_key(origem, destino, data_ida, cabine.value, adultos)
    cached = await cache_get(key)
    if cached is not None:
        return cached

    cabin_class = CABIN_MAP.get(cabine, "economy")
    payload = {
        "data": {
            "slices": [{"origin": origem, "destination": destino, "departure_date": data_ida}],
            "passengers": [{"type": "adult"} for _ in range(adultos)],
            "cabin_class": cabin_class,
        }
    }

    try:
        async with httpx.AsyncClient(timeout=10.0) as client:
            resp = await client.post(
                f"{DUFFEL_BASE}/air/offer_requests",
                params={"return_offers": "true"},
                headers={
                    "Authorization": f"Bearer {settings.duffel_api_key}",
                    "Duffel-Version": DUFFEL_VERSION,
                    "Content-Type": "application/json",
                    "Accept": "application/json",
                },
                json=payload,
            )
            resp.raise_for_status()
            data = resp.json()
    except Exception as exc:
        logger.warning("[duffel] erro %s->%s %s: %s", origem, destino, data_ida, exc)
        return None

    offers = data.get("data", {}).get("offers", [])
    if not offers:
        return None

    menor_valor: Optional[Decimal] = None
    menor_moeda: Optional[str] = None
    for offer in offers:
        try:
            valor = Decimal(offer["total_amount"])
            moeda = offer["total_currency"]
            if menor_valor is None or valor < menor_valor:
                menor_valor = valor
                menor_moeda = moeda
        except Exception:
            continue

    if menor_valor is None:
        return None

    result = {"preco": str(menor_valor), "moeda": menor_moeda}
    await cache_set(key, result, ttl=3600)
    return result
