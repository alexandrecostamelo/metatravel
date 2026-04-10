"""
Serviço de valoração.

Recebe uma lista de `Oferta` (que vem dos adapters só com milhas e taxas)
e preenche os campos em R$:
- `cotacao_milheiro_brl`: preço atual do milheiro do programa
- `taxas_brl`: taxas convertidas para R$ (TODO: integrar PTAX)
- `custo_total_brl`: soma final, pronta para ordenação

Busca a cotação mais recente de cada programa no banco em uma única query
para evitar N+1.
"""
from decimal import Decimal

from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.models.milhas import CotacaoMilheiro, ProgramaMilhas
from app.schemas.oferta import Oferta


async def carregar_cotacoes_vigentes(
    session: AsyncSession,
    slugs: set[str],
) -> dict[str, Decimal]:
    """Retorna {slug_do_programa: valor_brl_do_milheiro} para a cotação mais
    recente de cada programa solicitado."""
    if not slugs:
        return {}

    stmt = (
        select(ProgramaMilhas.slug, CotacaoMilheiro.valor_brl)
        .join(CotacaoMilheiro, CotacaoMilheiro.programa_id == ProgramaMilhas.id)
        .where(ProgramaMilhas.slug.in_(slugs))
        .order_by(ProgramaMilhas.slug, CotacaoMilheiro.vigente_desde.desc())
    )
    result = await session.execute(stmt)

    # Como ordenamos desc, o primeiro de cada slug é o mais recente
    cotacoes: dict[str, Decimal] = {}
    for slug, valor in result.all():
        if slug not in cotacoes:
            cotacoes[slug] = valor
    return cotacoes


async def valorar_ofertas(
    session: AsyncSession,
    ofertas: list[Oferta],
) -> list[Oferta]:
    """Preenche os campos em R$ de cada oferta in-place e retorna a lista."""
    slugs_necessarios = {o.programa for o in ofertas}
    cotacoes = await carregar_cotacoes_vigentes(session, slugs_necessarios)

    for oferta in ofertas:
        cotacao = cotacoes.get(oferta.programa)
        if cotacao is None:
            # Programa sem cotação cadastrada — deixa custo_total_brl = None
            # e ele vai cair no fim da ordenação.
            continue

        # Custo das milhas em R$ = (milhas / 1000) * cotação_milheiro
        custo_milhas = (Decimal(oferta.milhas) / Decimal(1000)) * cotacao

        # TODO: converter taxas_valor da moeda original para BRL via PTAX.
        # Por enquanto, se já vier em BRL usamos direto; senão ignoramos.
        taxas_brl = oferta.taxas_valor if oferta.taxas_moeda == "BRL" else Decimal(0)

        oferta.cotacao_milheiro_brl = cotacao
        oferta.taxas_brl = taxas_brl
        oferta.custo_total_brl = (custo_milhas + taxas_brl).quantize(Decimal("0.01"))

    return ofertas
