from abc import ABC, abstractmethod

from app.schemas.busca import BuscaRequest
from app.schemas.oferta import Oferta


class BaseAdapter(ABC):
    nome: str

    @abstractmethod
    async def buscar(self, req: BuscaRequest) -> list[Oferta]:
        """Busca disponibilidade e retorna lista de Oferta normalizadas."""
        ...
