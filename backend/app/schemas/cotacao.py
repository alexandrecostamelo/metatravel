"""
Schemas para o CRUD de programas e cotações do milheiro.
"""
from datetime import datetime
from decimal import Decimal

from pydantic import BaseModel, ConfigDict


class ProgramaMilhasOut(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: int
    slug: str
    nome: str
    moeda_taxas_default: str
    ativo: bool


class CotacaoMilheiroIn(BaseModel):
    programa_slug: str
    valor_brl: Decimal
    fonte: str = "manual"


class CotacaoMilheiroOut(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: int
    programa_id: int
    valor_brl: Decimal
    vigente_desde: datetime
    fonte: str
