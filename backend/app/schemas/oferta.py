"""
Schema da `Oferta` — o objeto normalizado que todos os adapters devem
retornar. É a "língua franca" interna do sistema.

Se amanhã você trocar o seats.aero por outro provedor, ou adicionar
a Moblix, só precisa escrever um adapter que produza este mesmo objeto.
Nada do resto do app muda.
"""
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
    """Uma opção de passagem em milhas, já normalizada e valorada."""

    # Rota
    origem: str = Field(..., description="Código IATA do aeroporto de origem")
    destino: str = Field(..., description="Código IATA do aeroporto de destino")
    data_ida: date
    data_volta: Optional[date] = None

    # Voo
    cia_aerea: str = Field(..., description="Código IATA da cia (ex.: G3, AD, QR)")
    cabine: Cabine
    paradas: int = 0
    duracao_minutos: Optional[int] = None

    # Custo em milhas
    programa: str = Field(..., description="Slug do programa (ex.: 'smiles')")
    milhas: int
    taxas_moeda: str = "BRL"
    taxas_valor: Decimal = Decimal("0")

    # Custo valorado em R$ (preenchido pela camada de valoração)
    taxas_brl: Optional[Decimal] = None
    cotacao_milheiro_brl: Optional[Decimal] = None
    custo_total_brl: Optional[Decimal] = None

    # Metadados
    link_reserva: Optional[str] = None
    fonte: str = Field(..., description="Qual adapter gerou esta oferta")
    atualizado_em: datetime = Field(default_factory=datetime.utcnow)
