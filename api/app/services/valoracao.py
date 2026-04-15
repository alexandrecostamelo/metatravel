"""
Valoração de ofertas: converte milhas → R$ usando cotação do milheiro e PTAX.

A query de cotações busca TODOS os programas sem WHERE parametrizado,
evitando DuplicatePreparedStatementError com pgbouncer em transaction mode.
O resultado é armazenado em Redis (5min) e em memória como fallback.
"""
import time
from decimal import Decimal

from sqlalchemy import text
from sqlalchemy.ext.asyncio import AsyncSession

from app.schemas.oferta import Oferta
from app.services.cache import cache_get, cache_set
from app.services.ptax import get_ptax_brl

_REDIS_KEY = "cotacoes:vigor:all"
_REDIS_TTL = 300  # 5 minutos

# Cache em memória: usa dict mutável para evitar 'global' em async
_mem: dict = {"cotacoes": {}, "ts": 0.0}
_MEM_TTL = 300


async def _cotacoes_vigentes(session: AsyncSession) -> dict[str, Decimal]:
    """
    Retorna {slug: cotacao_brl} para todos os programas com cotação.
    Ordem: memória → Redis → DB (sem parâmetros para evitar prepared statements).
    """
    agora = time.monotonic()

    # 1. Memória recente
    if _mem["cotacoes"] and (agora - _mem["ts"]) < _MEM_TTL:
        return dict(_mem["cotacoes"])

    # 2. Redis
    cached = await cache_get(_REDIS_KEY)
    if cached:
        result = {k: Decimal(str(v)) for k, v in cached.items()}
        _mem["cotacoes"] = result
        _mem["ts"] = agora
        return dict(result)

    # 3. DB — sem WHERE parametrizado → asyncpg usa simple query protocol
    sql = text("""
        SELECT DISTINCT ON (p.slug)
               p.slug,
               c.valor_brl
        FROM   programas_milhas p
        JOIN   cotacoes_milheiro c ON c.programa_id = p.id
        ORDER  BY p.slug, c.vigente_desde DESC
    """)
    try:
        rows = (await session.execute(sql)).all()
    except Exception as exc:
        print(f"[valoracao] erro ao buscar cotações do DB: {exc}")
        return dict(_mem["cotacoes"])

    result = {slug: Decimal(str(valor)) for slug, valor in rows}

    await cache_set(_REDIS_KEY, {k: str(v) for k, v in result.items()}, ttl=_REDIS_TTL)
    _mem["cotacoes"] = result
    _mem["ts"] = agora

    return dict(result)


async def valorar_ofertas(session: AsyncSession, ofertas: list[Oferta]) -> list[Oferta]:
    """Preenche custo_total_brl em cada oferta e retorna ordenado por R$ asc."""
    cotacoes = await _cotacoes_vigentes(session)

    moedas_necessarias = {o.taxas_moeda for o in ofertas if o.taxas_moeda != "BRL"}
    ptax: dict[str, Decimal] = {}
    for moeda in moedas_necessarias:
        try:
            ptax[moeda] = await get_ptax_brl(moeda)
        except Exception as exc:
            print(f"[valoracao] PTAX {moeda} indisponível: {exc}")

    for oferta in ofertas:
        cotacao = cotacoes.get(oferta.programa)
        if cotacao is None:
            continue

        custo_milhas = (Decimal(oferta.milhas) / Decimal(1000)) * cotacao

        if oferta.taxas_moeda == "BRL":
            taxas_brl = oferta.taxas_valor
        else:
            taxa_cambio = ptax.get(oferta.taxas_moeda)
            taxas_brl = (oferta.taxas_valor * taxa_cambio) if taxa_cambio else Decimal("0")

        oferta.cotacao_milheiro_brl = cotacao
        oferta.taxas_brl = taxas_brl
        oferta.custo_total_brl = (custo_milhas + taxas_brl).quantize(Decimal("0.01"))

    ofertas.sort(
        key=lambda o: o.custo_total_brl if o.custo_total_brl is not None else Decimal("999999999")
    )
    return ofertas
