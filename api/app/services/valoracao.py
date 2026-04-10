import time
from decimal import Decimal

from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.models.milhas import CotacaoMilheiro, ProgramaMilhas
from app.schemas.oferta import Oferta
from app.services.ptax import get_ptax_brl

# Cache em memória de cotações do milheiro: {slug: (valor_brl, timestamp)}
_cache: dict[str, tuple[Decimal, float]] = {}
_CACHE_TTL = 300  # 5 minutos


async def _cotacoes_vigentes(session: AsyncSession, slugs: set[str]) -> dict[str, Decimal]:
    """Busca a cotação mais recente de cada programa em uma única query."""
    agora = time.monotonic()
    pendentes = {s for s in slugs if s not in _cache or agora - _cache[s][1] > _CACHE_TTL}

    if pendentes:
        stmt = (
            select(ProgramaMilhas.slug, CotacaoMilheiro.valor_brl)
            .join(CotacaoMilheiro, CotacaoMilheiro.programa_id == ProgramaMilhas.id)
            .where(ProgramaMilhas.slug.in_(pendentes))
            .order_by(ProgramaMilhas.slug, CotacaoMilheiro.vigente_desde.desc())
        )
        rows = (await session.execute(stmt)).all()

        vistos: set[str] = set()
        for slug, valor in rows:
            if slug not in vistos:
                _cache[slug] = (valor, agora)
                vistos.add(slug)

    return {s: _cache[s][0] for s in slugs if s in _cache}


async def valorar_ofertas(session: AsyncSession, ofertas: list[Oferta]) -> list[Oferta]:
    """Preenche custo_total_brl em cada oferta e retorna ordenado por R$ asc."""
    slugs = {o.programa for o in ofertas}
    cotacoes = await _cotacoes_vigentes(session, slugs)

    # Coleta moedas estrangeiras para buscar PTAX em lote (evita N chamadas)
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
