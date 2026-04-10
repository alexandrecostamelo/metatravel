import asyncio
import hashlib
import json
from datetime import date

from sqlalchemy.ext.asyncio import AsyncSession

from app.adapters.base import BaseAdapter
from app.adapters.seats_aero import SeatsAeroAdapter
from app.schemas.busca import BuscaRequest
from app.schemas.oferta import Oferta
from app.services.cache import cache_get, cache_set
from app.services.valoracao import valorar_ofertas

ADAPTERS: list[BaseAdapter] = [
    SeatsAeroAdapter(),
    # MoblixAdapter(),
]


def _cache_key(req: BuscaRequest) -> str:
    payload = f"{req.origem}:{req.destino}:{req.data_ida}:{req.data_volta}:{req.cabine}:{req.adultos}"
    digest = hashlib.sha256(payload.encode()).hexdigest()[:16]
    return f"busca:{digest}"


def _serialize(ofertas: list[Oferta]) -> list[dict]:
    return [o.model_dump(mode="json") for o in ofertas]


def _deserialize(data: list[dict]) -> list[Oferta]:
    return [Oferta.model_validate(d) for d in data]


async def buscar_passagens(
    req: BuscaRequest,
    session: AsyncSession,
) -> tuple[list[Oferta], bool]:
    """Retorna (ofertas, cache_hit)."""
    key = _cache_key(req)

    cached = await cache_get(key)
    if cached is not None:
        return _deserialize(cached), True

    print(f"[orquestrador] iniciando busca {req.origem}->{req.destino}")

    resultados = await asyncio.wait_for(
        asyncio.gather(
            *(adapter.buscar(req) for adapter in ADAPTERS),
            return_exceptions=True,
        ),
        timeout=6.0,
    )

    todas: list[Oferta] = []
    for adapter, resultado in zip(ADAPTERS, resultados):
        if isinstance(resultado, Exception):
            print(f"[orquestrador] adapter {adapter.nome} falhou: {resultado}")
            continue
        todas.extend(resultado)

    todas = await valorar_ofertas(session, todas)
    print(f"[orquestrador] concluido, total={len(todas)}")

    await cache_set(key, _serialize(todas), ttl=900)

    return todas, False
