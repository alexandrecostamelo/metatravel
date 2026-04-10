"""
Models SQLAlchemy mapeando as tabelas reais do Supabase.
Nomes de tabela e colunas conforme docs/schema-real.md.
"""
from datetime import datetime
from decimal import Decimal
from typing import Optional
from uuid import UUID

from sqlalchemy import BigInteger, Boolean, Date, ForeignKey, Integer, Numeric, String, Text
from sqlalchemy.orm import DeclarativeBase, Mapped, mapped_column, relationship


class Base(DeclarativeBase):
    pass


class ProgramaMilhas(Base):
    __tablename__ = "programas_milhas"

    id: Mapped[int] = mapped_column(BigInteger, primary_key=True)
    slug: Mapped[str] = mapped_column(Text, unique=True, index=True)
    nome: Mapped[str] = mapped_column(Text)
    moeda_taxas_default: Mapped[str] = mapped_column(Text, default="BRL")
    ativo: Mapped[bool] = mapped_column(Boolean, default=True)
    criado_em: Mapped[datetime] = mapped_column(insert_default=None)

    cotacoes: Mapped[list["CotacaoMilheiro"]] = relationship(
        back_populates="programa", cascade="all, delete-orphan"
    )


class CotacaoMilheiro(Base):
    __tablename__ = "cotacoes_milheiro"

    id: Mapped[int] = mapped_column(BigInteger, primary_key=True)
    programa_id: Mapped[int] = mapped_column(BigInteger, ForeignKey("programas_milhas.id"))
    valor_brl: Mapped[Decimal] = mapped_column(Numeric(10, 2))
    vigente_desde: Mapped[datetime] = mapped_column(insert_default=None)
    fonte: Mapped[str] = mapped_column(Text, default="manual")

    programa: Mapped[ProgramaMilhas] = relationship(back_populates="cotacoes")


class BuscaLog(Base):
    __tablename__ = "buscas_log"

    id: Mapped[int] = mapped_column(BigInteger, primary_key=True)
    user_id: Mapped[Optional[UUID]] = mapped_column(nullable=True)
    origem: Mapped[str] = mapped_column(Text)
    destino: Mapped[str] = mapped_column(Text)
    data_ida: Mapped[datetime] = mapped_column(Date)
    data_volta: Mapped[Optional[datetime]] = mapped_column(Date, nullable=True)
    cabine: Mapped[str] = mapped_column(Text)
    total_ofertas: Mapped[int] = mapped_column(Integer, default=0)
    criado_em: Mapped[datetime] = mapped_column(insert_default=None)
