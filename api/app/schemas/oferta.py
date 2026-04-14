from datetime import date, datetime
from decimal import Decimal
from enum import Enum
from typing import Optional

from pydantic import BaseModel, Field


class Cabine(str, Enum):
    ECONOMICA = "economica"
    PREMIUM_ECONOMICA = "premium_economica"
    EXECUTIVA = "executiva"
    PRIMEIRA = "primeira"


class Oferta(BaseModel):
    origem: str = Field(..., description="Código IATA de origem")
    destino: str = Field(..., description="Código IATA de destino")
    data_ida: date
    data_volta: Optional[date] = None

    cia_aerea: str
    cabine: Cabine
    paradas: int = 0
    duracao_minutos: Optional[int] = None

    programa: str = Field(..., description="Slug do programa (ex: smiles)")
    milhas: int
    taxas_moeda: str = "BRL"
    taxas_valor: Decimal = Decimal("0")

    taxas_brl: Optional[Decimal] = None
    cotacao_milheiro_brl: Optional[Decimal] = None
    custo_total_brl: Optional[Decimal] = None

    # Campos CPM — preenchidos pelo cash_enrichment (Duffel)
    preco_cash_brl: Optional[Decimal] = None
    preco_cash_moeda: Optional[str] = None
    valor_milha_brl: Optional[Decimal] = None       # R$ por milha individual
    valor_milheiro_brl: Optional[Decimal] = None    # R$ por 1.000 milhas (CPM equivalente)
    economia_brl: Optional[Decimal] = None          # preco_cash_brl - custo_total_brl
    economia_percentual: Optional[Decimal] = None   # economia_brl / preco_cash_brl × 100
    qualidade_resgate: Optional[str] = None         # "excelente" | "bom" | "ok" | "ruim"

    link_reserva: Optional[str] = None
    fonte: str
    atualizado_em: datetime = Field(default_factory=datetime.utcnow)
