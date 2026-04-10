"""
Interface comum para adapters de provedores de disponibilidade.

Todo adapter novo (seats.aero, Moblix, Duffel, etc.) implementa esta classe
retornando uma lista de `Oferta` normalizadas. O orquestrador não sabe nada
sobre como cada API funciona — só chama `buscar()` em paralelo.
"""
from abc import ABC, abstractmethod

from app.schemas.busca import BuscaRequest
from app.schemas.oferta import Oferta


class BaseAdapter(ABC):
    """Contrato que todo provedor de milhas deve seguir."""

    #: identificador curto usado em logs e no campo `fonte` da Oferta
    nome: str = "base"

    @abstractmethod
    async def buscar(self, req: BuscaRequest) -> list[Oferta]:
        """Executa a busca no provedor e devolve ofertas normalizadas.

        Deve capturar erros do provedor e retornar lista vazia em caso
        de falha — nunca levantar exceção para o orquestrador, que está
        rodando várias buscas em paralelo e não deve quebrar se uma falhar.
        """
        ...
