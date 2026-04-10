"""
Models do domínio de milhas.

- `ProgramaMilhas`: catálogo de programas de fidelidade (Smiles, Azul,
  Aeroplan, etc.). Usamos um "slug" curto como chave natural para casar
  com o que as APIs externas retornam (ex.: "smiles", "aeroplan").
- `CotacaoMilheiro`: histórico do valor do milheiro (preço de 1.000 milhas
  em R$) por programa. Mantemos todas as cotações e buscamos sempre a
  mais recente na hora de valorar uma oferta — isso nos dá auditoria e
  gráfico de histórico de graça no futuro.
"""
from datetime import datetime
from decimal import Decimal

from sqlalchemy import ForeignKey, Numeric, String, DateTime, func
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.database import Base


class ProgramaMilhas(Base):
    __tablename__ = "programas_milhas"

    id: Mapped[int] = mapped_column(primary_key=True)
    slug: Mapped[str] = mapped_column(String(50), unique=True, index=True)
    nome: Mapped[str] = mapped_column(String(120))
    moeda_taxas_default: Mapped[str] = mapped_column(String(3), default="BRL")
    ativo: Mapped[bool] = mapped_column(default=True)

    cotacoes: Mapped[list["CotacaoMilheiro"]] = relationship(
        back_populates="programa",
        cascade="all, delete-orphan",
    )

    def __repr__(self) -> str:
        return f"<ProgramaMilhas {self.slug}>"


class CotacaoMilheiro(Base):
    __tablename__ = "cotacoes_milheiro"

    id: Mapped[int] = mapped_column(primary_key=True)
    programa_id: Mapped[int] = mapped_column(ForeignKey("programas_milhas.id"))
    # Preço em R$ para cada 1.000 milhas. Ex.: Smiles 16.00, Avios 56.00.
    valor_brl: Mapped[Decimal] = mapped_column(Numeric(10, 2))
    vigente_desde: Mapped[datetime] = mapped_column(
        DateTime(timezone=True),
        server_default=func.now(),
    )
    fonte: Mapped[str] = mapped_column(String(120), default="manual")

    programa: Mapped[ProgramaMilhas] = relationship(back_populates="cotacoes")
