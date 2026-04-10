from datetime import date
from typing import Optional

from pydantic import BaseModel, Field, field_validator, model_validator

from app.schemas.oferta import Cabine, Oferta


class BuscaRequest(BaseModel):
    origem: str = Field(..., min_length=3, max_length=3, description="IATA origem")
    destino: str = Field(..., min_length=3, max_length=3, description="IATA destino")
    data_ida: date
    data_volta: Optional[date] = None
    cabine: Cabine = Cabine.ECONOMICA
    adultos: int = Field(default=1, ge=1, le=9)
    programas: list[str] = Field(default_factory=list, description="Slugs dos programas; vazio = todos")

    @field_validator("origem", "destino", mode="before")
    @classmethod
    def uppercase_iata(cls, v: str) -> str:
        return v.upper()

    @field_validator("data_ida")
    @classmethod
    def data_ida_nao_passado(cls, v: date) -> date:
        if v < date.today():
            raise ValueError("data_ida não pode ser no passado")
        return v

    @model_validator(mode="after")
    def data_volta_valida(self) -> "BuscaRequest":
        if self.data_volta is not None and self.data_volta < self.data_ida:
            raise ValueError("data_volta deve ser maior ou igual a data_ida")
        return self


class BuscaResponse(BaseModel):
    origem: str
    destino: str
    data_ida: date
    data_volta: Optional[date] = None
    cabine: Cabine
    total: int
    cache_hit: bool = False
    ofertas: list[Oferta]
