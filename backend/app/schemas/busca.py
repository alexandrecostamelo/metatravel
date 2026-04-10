"""
Schemas de busca de passagens.
"""
from datetime import date
from typing import Optional

from pydantic import BaseModel, Field

from app.schemas.oferta import Cabine, Oferta


class BuscaRequest(BaseModel):
    origem: str = Field(..., min_length=3, max_length=3, description="IATA origem")
    destino: str = Field(..., min_length=3, max_length=3, description="IATA destino")
    data_ida: date
    data_volta: Optional[date] = None
    cabine: Cabine = Cabine.ECONOMICA
    pax: int = Field(default=1, ge=1, le=9)
    # Lista de programas aceitos; vazio = todos
    programas: list[str] = Field(default_factory=list)


class BuscaResponse(BaseModel):
    total: int
    ofertas: list[Oferta]
