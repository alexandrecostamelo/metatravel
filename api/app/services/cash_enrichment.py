"""
Enriquecimento de ofertas de milhas com preço em dinheiro (Duffel) e métricas CPM.
Agrupa ofertas por (origem, destino, data, cabine) para minimizar chamadas à API.
"""
import asyncio
import logging
from decimal import Decimal
from typing import Optional

from app.adapters.duffel import buscar_cash_equivalente
from app.schemas.oferta import Oferta
from app.services.ptax import get_ptax_brl

logger = logging.getLogger(__name__)

_SEM = asyncio.Semaphore(5)  # máx 5 chamadas Duffel concorrentes


def _grupo(oferta: Oferta) -> tuple:
    return (oferta.origem, oferta.destino, str(oferta.data_ida), oferta.cabine)


async def _buscar_grupo(origem: str, destino: str, data: str, cabine, adultos: int) -> Optional[dict]:
    async with _SEM:
        return await buscar_cash_equivalente(origem, destino, data, cabine, adultos)


def _classificar(valor_milheiro: Decimal, cotacao_milheiro: Decimal) -> str:
    """
    Classifica o resgate pelo ratio valor_efetivo / custo_das_milhas.
    excelente ≥ 3×, bom ≥ 2×, ok ≥ 1.5×, ruim < 1.5×
    """
    if cotacao_milheiro <= 0:
        return "ok"
    ratio = valor_milheiro / cotacao_milheiro
    if ratio >= Decimal("3.0"):
        return "excelente"
    if ratio >= Decimal("2.0"):
        return "bom"
    if ratio >= Decimal("1.5"):
        return "ok"
    return "ruim"


async def enriquecer_com_cash(ofertas: list[Oferta], adultos: int = 1) -> list[Oferta]:
    """
    Preenche os campos CPM em cada oferta usando o menor preço em dinheiro do Duffel.
    Retorna a mesma lista com os campos preenchidos quando disponíveis.
    """
    if not ofertas:
        return ofertas

    # Agrupa ofertas por chave única de busca
    grupos: dict[tuple, list[Oferta]] = {}
    for oferta in ofertas:
        chave = _grupo(oferta)
        grupos.setdefault(chave, []).append(oferta)

    # Busca Duffel em paralelo para cada grupo (com semáforo de concorrência)
    chaves = list(grupos.keys())
    tasks = [
        _buscar_grupo(ch[0], ch[1], ch[2], ch[3], adultos)
        for ch in chaves
    ]
    raw_results = await asyncio.gather(*tasks, return_exceptions=True)

    # Cache de PTAX para evitar chamadas repetidas
    ptax_cache: dict[str, Optional[Decimal]] = {}

    for chave, resultado in zip(chaves, raw_results):
        if isinstance(resultado, Exception) or resultado is None:
            if isinstance(resultado, Exception):
                logger.warning("[cash_enrichment] grupo %s falhou: %s", chave, resultado)
            continue

        preco_raw = Decimal(resultado["preco"])
        moeda = resultado["moeda"]

        # Converte para BRL se necessário
        if moeda == "BRL":
            preco_brl: Optional[Decimal] = preco_raw
        else:
            if moeda not in ptax_cache:
                try:
                    ptax_cache[moeda] = await get_ptax_brl(moeda)
                except Exception as exc:
                    logger.warning("[cash_enrichment] PTAX %s indisponível: %s", moeda, exc)
                    ptax_cache[moeda] = None
            taxa = ptax_cache.get(moeda)
            preco_brl = (preco_raw * taxa).quantize(Decimal("0.01")) if taxa else None

        if preco_brl is None:
            continue

        for oferta in grupos[chave]:
            if oferta.milhas <= 0:
                continue

            oferta.preco_cash_brl = preco_brl
            oferta.preco_cash_moeda = moeda

            valor_milheiro = (preco_brl / Decimal(oferta.milhas) * 1000).quantize(Decimal("0.01"))
            oferta.valor_milheiro_brl = valor_milheiro
            oferta.valor_milha_brl = (valor_milheiro / 1000).quantize(Decimal("0.0001"))

            if oferta.custo_total_brl is not None:
                oferta.economia_brl = (preco_brl - oferta.custo_total_brl).quantize(Decimal("0.01"))
                if preco_brl > 0:
                    oferta.economia_percentual = (
                        oferta.economia_brl / preco_brl * 100
                    ).quantize(Decimal("0.1"))

            if oferta.cotacao_milheiro_brl and oferta.cotacao_milheiro_brl > 0:
                oferta.qualidade_resgate = _classificar(valor_milheiro, oferta.cotacao_milheiro_brl)

    return ofertas
