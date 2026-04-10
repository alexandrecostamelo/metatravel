"""
Endpoint de cron para atualização diária de cotações.
Chamado pelo Vercel Cron às 12:00 UTC (09:00 BRT).
"""
from datetime import date
from decimal import Decimal
from typing import Any

import httpx
from fastapi import APIRouter, Depends, HTTPException, Request, status
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.config import settings
from app.database import get_session
from app.models.milhas import CotacaoMilheiro, ProgramaMilhas
from app.services.cache import cache_set

router = APIRouter()

COTACOES_REFERENCIA: dict[str, float] = {
    "smiles": 16.00,
    "azul": 15.00,
    "latam_pass": 25.00,
    "tap": 40.00,
    "aeroplan": 45.00,
    "avios_qatar": 56.00,
    "avios_iberia": 56.00,
    "avios_british": 58.00,
    "flying_blue": 50.00,
    "united": 48.00,
    "aadvantage": 48.00,
    "finnair_plus": 52.00,
}

MOEDAS_PTAX = ["USD", "EUR", "GBP", "CAD"]

_BCB_URL = (
    "https://olinda.bcb.gov.br/olinda/servico/PTAX/versao/v1/odata/"
    "CotacaoMoedaDia(moeda=@moeda,dataCotacao=@dataCotacao)"
)


def _verificar_secret(request: Request) -> None:
    auth = request.headers.get("Authorization", "")
    if not auth.startswith("Bearer ") or auth[7:] != settings.cron_secret:
        raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="Não autorizado")


async def _fetch_ptax(moeda: str, data: date) -> tuple[str, Decimal | None]:
    params = {
        "@moeda": f"'{moeda}'",
        "@dataCotacao": f"'{data.strftime('%m-%d-%Y')}'",
        "$format": "json",
        "$select": "cotacaoVenda",
    }
    try:
        async with httpx.AsyncClient(timeout=8.0) as client:
            resp = await client.get(_BCB_URL, params=params)
            resp.raise_for_status()
            items = resp.json().get("value", [])
            if not items:
                return moeda, None
            return moeda, Decimal(str(items[-1]["cotacaoVenda"]))
    except Exception as exc:
        print(f"[cron] PTAX {moeda} falhou: {exc}")
        return moeda, None


@router.post("/api/cron/atualizar-cotacoes")
async def atualizar_cotacoes(
    request: Request,
    session: AsyncSession = Depends(get_session),
) -> dict[str, Any]:
    _verificar_secret(request)

    # 1. Atualizar cotações do milheiro
    stmt = select(ProgramaMilhas).where(ProgramaMilhas.ativo == True)
    programas = (await session.execute(stmt)).scalars().all()

    atualizadas = 0
    falhas = 0
    detalhes: list[dict] = []

    for programa in programas:
        valor_ref = COTACOES_REFERENCIA.get(programa.slug)
        if valor_ref is None:
            print(f"[cron] programa {programa.slug} sem referência, pulando")
            continue
        try:
            session.add(
                CotacaoMilheiro(
                    programa_id=programa.id,
                    valor_brl=Decimal(str(valor_ref)),
                    fonte="cron_diario",
                )
            )
            atualizadas += 1
            detalhes.append({"programa": programa.slug, "valor_brl": valor_ref, "status": "ok"})
        except Exception as exc:
            falhas += 1
            detalhes.append({"programa": programa.slug, "status": "erro", "detalhe": str(exc)})

    await session.commit()
    print(f"[cron] cotacoes_milheiro: atualizadas={atualizadas} falhas={falhas}")

    # 2. Atualizar PTAX
    hoje = date.today()
    ptax_atualizadas = 0

    for moeda in MOEDAS_PTAX:
        _, valor = await _fetch_ptax(moeda, hoje)
        if valor is not None:
            key = f"ptax:{moeda}:{hoje.isoformat()}"
            await cache_set(key, str(valor), ttl=86400)
            ptax_atualizadas += 1
            detalhes.append({"ptax": moeda, "valor_brl": float(valor), "status": "ok"})
            print(f"[cron] PTAX {moeda}={valor}")
        else:
            detalhes.append({"ptax": moeda, "status": "falha"})

    return {
        "atualizadas": atualizadas,
        "ptax_atualizadas": ptax_atualizadas,
        "falhas": falhas,
        "detalhes": detalhes,
    }
