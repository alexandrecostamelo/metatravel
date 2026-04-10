"""
Orquestrador de buscas.

Dispara todos os adapters registrados em paralelo (asyncio.gather),
agrega os resultados, passa pela valoração e devolve ordenado.
"""
import asyncio
from decimal import Decimal

import structlog
from sqlalchemy.ext.asyncio import AsyncSession

from app.adapters.base import BaseAdapter
from app.adapters.seats_aero import SeatsAeroAdapter
from app.schemas.busca import BuscaRequest
from app.schemas.oferta import Oferta
from app.services.valoracao import valorar_ofertas

log = structlog.get_logger()


# Registry de adapters ativos. Adicionar um novo provedor é só
# instanciar aqui e ele entra no pool automaticamente.
ADAPTERS: list[BaseAdapter] = [
    SeatsAeroAdapter(),
    # MoblixAdapter(),   # quando você integrar
    # DuffelAdapter(),   # para preço cash
]


async def buscar_passagens(
    req: BuscaRequest,
    session: AsyncSession,
) -> list[Oferta]:
    """Executa a busca em todos os adapters, valora e ordena por R$."""
    log.info(
        "busca_iniciada",
        origem=req.origem,
        destino=req.destino,
        data_ida=str(req.data_ida),
        adapters=[a.nome for a in ADAPTERS],
    )

    # Dispara todos os adapters em paralelo.
    # return_exceptions=True garante que um adapter quebrado não
    # derruba a busca inteira — a gente só loga e segue.
    resultados = await asyncio.gather(
        *(adapter.buscar(req) for adapter in ADAPTERS),
        return_exceptions=True,
    )

    todas_ofertas: list[Oferta] = []
    for adapter, resultado in zip(ADAPTERS, resultados):
        if isinstance(resultado, Exception):
            log.error("adapter_falhou", adapter=adapter.nome, error=str(resultado))
            continue
        todas_ofertas.extend(resultado)

    # Valora em R$
    todas_ofertas = await valorar_ofertas(session, todas_ofertas)

    # Ordena por custo total em R$ (None vai para o fim)
    todas_ofertas.sort(
        key=lambda o: o.custo_total_brl if o.custo_total_brl is not None else Decimal("999999999")
    )

    log.info("busca_concluida", total=len(todas_ofertas))
    return todas_ofertas
