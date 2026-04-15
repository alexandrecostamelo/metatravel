"""
Endpoints de administração — gerenciamento de programas e cotações do milheiro.
Requer autenticação JWT (Supabase).
"""
from datetime import datetime
from decimal import Decimal
from typing import Optional
from uuid import UUID

import jwt as _jwt

from fastapi import APIRouter, Depends, HTTPException, Request, status
from pydantic import BaseModel, Field
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.auth import get_current_user
from app.config import settings
from app.database import get_session
from app.models.milhas import CotacaoMilheiro, ProgramaMilhas

router = APIRouter(prefix="/api/admin", tags=["admin"])


@router.get("/debug-duffel", include_in_schema=False)
async def debug_duffel() -> dict:
    """Diagnóstico da integração Duffel — testa chave e faz chamada de exemplo."""
    from app.adapters.duffel import buscar_cash_equivalente, DUFFEL_BASE, DUFFEL_VERSION
    from app.schemas.oferta import Cabine
    import httpx

    result: dict = {
        "chave_configurada": bool(settings.duffel_api_key),
        "chave_prefixo": settings.duffel_api_key[:12] + "..." if settings.duffel_api_key else None,
    }

    if not settings.duffel_api_key:
        result["erro"] = "DUFFEL_API_KEY não configurada"
        return result

    # Testa autenticação com uma chamada mínima
    try:
        async with httpx.AsyncClient(timeout=10.0) as client:
            resp = await client.get(
                f"{DUFFEL_BASE}/air/airports?iata_code=GRU",
                headers={
                    "Authorization": f"Bearer {settings.duffel_api_key}",
                    "Duffel-Version": DUFFEL_VERSION,
                    "Accept": "application/json",
                },
            )
            result["auth_status"] = resp.status_code
            if resp.status_code != 200:
                result["auth_erro"] = resp.text[:300]
                return result
    except Exception as exc:
        result["auth_erro"] = str(exc)
        return result

    # Testa busca real GRU→MIA com data futura
    from datetime import date, timedelta
    data_teste = (date.today() + timedelta(days=60)).isoformat()
    result["data_teste"] = data_teste

    # Chamada direta para ver resposta bruta do Duffel
    payload = {
        "data": {
            "slices": [{"origin": "GRU", "destination": "MIA", "departure_date": data_teste}],
            "passengers": [{"type": "adult"}],
            "cabin_class": "economy",
        }
    }
    try:
        async with httpx.AsyncClient(timeout=15.0) as client:
            resp = await client.post(
                f"{DUFFEL_BASE}/air/offer_requests",
                params={"return_offers": "true"},
                headers={
                    "Authorization": f"Bearer {settings.duffel_api_key}",
                    "Duffel-Version": DUFFEL_VERSION,
                    "Content-Type": "application/json",
                    "Accept": "application/json",
                },
                json=payload,
            )
            result["duffel_status"] = resp.status_code
            raw = resp.json()
            offers = raw.get("data", {}).get("offers", [])
            result["total_ofertas"] = len(offers)
            if offers:
                result["primeira_oferta"] = {
                    "total_amount": offers[0].get("total_amount"),
                    "total_currency": offers[0].get("total_currency"),
                }
            else:
                result["resposta_parcial"] = str(raw)[:500]
    except Exception as exc:
        result["busca_erro"] = str(exc)

    return result


@router.get("/debug-enrichment", include_in_schema=False)
async def debug_enrichment(session: AsyncSession = Depends(get_session)) -> dict:
    """Testa o pipeline completo de enriquecimento CPM com oferta simulada."""
    from datetime import date, timedelta
    from decimal import Decimal
    from app.schemas.oferta import Cabine, Oferta
    from app.services.valoracao import valorar_ofertas
    from app.services.cash_enrichment import enriquecer_com_cash

    data_futura = date.today() + timedelta(days=60)

    oferta = Oferta(
        origem="GRU", destino="MIA",
        data_ida=data_futura,
        cia_aerea="AA", cabine=Cabine.ECONOMICA,
        paradas=1, programa="smiles",
        milhas=60000, taxas_moeda="USD", taxas_valor=Decimal("120.00"),
        fonte="debug",
    )

    resultado = {
        "antes_valoracao": {
            "custo_total_brl": str(oferta.custo_total_brl),
            "taxas_brl": str(oferta.taxas_brl),
        }
    }

    try:
        ofertas = await valorar_ofertas(session, [oferta])
        resultado["apos_valoracao"] = {
            "custo_total_brl": str(ofertas[0].custo_total_brl),
            "taxas_brl": str(ofertas[0].taxas_brl),
            "cotacao_milheiro_brl": str(ofertas[0].cotacao_milheiro_brl),
        }
    except Exception as exc:
        resultado["erro_valoracao"] = str(exc)
        return resultado

    # Testa PTAX diretamente
    from app.services.ptax import get_ptax_brl, _fetch_awesome, _fetch_bcb
    try:
        ptax_usd = await get_ptax_brl("USD")
        resultado["ptax_usd"] = str(ptax_usd)
    except Exception as exc:
        resultado["ptax_usd_erro"] = str(exc)
        # testa cada fonte individualmente
        try:
            resultado["ptax_awesome"] = str(await _fetch_awesome("USD"))
        except Exception as e:
            resultado["ptax_awesome_erro"] = str(e)
        try:
            resultado["ptax_bcb"] = str(await _fetch_bcb("USD"))
        except Exception as e:
            resultado["ptax_bcb_erro"] = str(e)

    # Testa Duffel diretamente com a mesma data do enrichment
    from app.adapters.duffel import buscar_cash_equivalente
    try:
        cash_direto = await buscar_cash_equivalente("GRU", "MIA", str(data_futura), Cabine.ECONOMICA, 1)
        resultado["duffel_direto"] = cash_direto
    except Exception as exc:
        resultado["duffel_direto_erro"] = str(exc)

    try:
        ofertas = await enriquecer_com_cash(ofertas, adultos=1)
        o = ofertas[0]
        resultado["apos_enrichment"] = {
            "preco_cash_brl": str(o.preco_cash_brl),
            "preco_cash_moeda": o.preco_cash_moeda,
            "valor_milheiro_brl": str(o.valor_milheiro_brl),
            "economia_brl": str(o.economia_brl),
            "economia_percentual": str(o.economia_percentual),
            "qualidade_resgate": o.qualidade_resgate,
        }
    except Exception as exc:
        resultado["erro_enrichment"] = str(exc)

    return resultado


@router.get("/debug-auth", include_in_schema=False)
async def debug_auth(request: Request) -> dict:
    """Diagnóstico de autenticação — remover após resolver o problema."""
    auth_header = request.headers.get("Authorization", "")
    secret = settings.supabase_jwt_secret

    result: dict = {
        "secret_configurado": bool(secret),
        "secret_tamanho": len(secret) if secret else 0,
        "header_presente": bool(auth_header),
        "header_scheme": auth_header.split(" ")[0] if auth_header else None,
    }

    if auth_header.startswith("Bearer ") and secret:
        token = auth_header[7:]
        result["token_tamanho"] = len(token)
        result["token_partes"] = len(token.split("."))
        for verificar_aud in (True, False):
            try:
                opts = {} if verificar_aud else {"verify_aud": False}
                payload = _jwt.decode(token, secret, algorithms=["HS256"],
                                      audience="authenticated" if verificar_aud else None,
                                      options=opts if not verificar_aud else {}, leeway=10)
                result[f"decode_aud_{verificar_aud}"] = "ok"
                result["sub"] = payload.get("sub")
                result["aud"] = payload.get("aud")
                result["role"] = payload.get("role")
                break
            except Exception as e:
                result[f"decode_aud_{verificar_aud}"] = f"{type(e).__name__}: {e}"

    return result


# ── Schemas ─────────────────────────────────────────────────────────────────

class ProgramaAdminOut(BaseModel):
    id: int
    slug: str
    nome: str
    moeda_taxas_default: str
    ativo: bool
    cotacao_atual_brl: Optional[Decimal] = None
    cotacao_vigente_desde: Optional[datetime] = None


class ProgramaCreate(BaseModel):
    slug: str = Field(..., min_length=2, max_length=64)
    nome: str = Field(..., min_length=2, max_length=128)
    moeda_taxas_default: str = Field(default="BRL", max_length=3)


class ProgramaUpdate(BaseModel):
    nome: Optional[str] = Field(None, min_length=2, max_length=128)
    ativo: Optional[bool] = None
    moeda_taxas_default: Optional[str] = Field(None, max_length=3)


class CotacaoCreate(BaseModel):
    valor_brl: Decimal = Field(..., gt=0, description="R$ por 1.000 milhas")


class CotacaoOut(BaseModel):
    id: int
    programa_id: int
    valor_brl: Decimal
    vigente_desde: datetime
    fonte: str


# ── Helpers ──────────────────────────────────────────────────────────────────

async def _get_programa(session: AsyncSession, programa_id: int) -> ProgramaMilhas:
    prog = await session.get(ProgramaMilhas, programa_id)
    if not prog:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Programa não encontrado")
    return prog


async def _latest_cotacao(session: AsyncSession, programa_id: int):
    stmt = (
        select(CotacaoMilheiro)
        .where(CotacaoMilheiro.programa_id == programa_id)
        .order_by(CotacaoMilheiro.vigente_desde.desc())
        .limit(1)
    )
    return (await session.execute(stmt)).scalar_one_or_none()


# ── Endpoints ────────────────────────────────────────────────────────────────

@router.get("/programas", response_model=list[ProgramaAdminOut])
async def listar_programas_admin(
    session: AsyncSession = Depends(get_session),
    _user: UUID = Depends(get_current_user),
) -> list[ProgramaAdminOut]:
    """Lista todos os programas (ativos e inativos) com cotação atual."""
    stmt = select(ProgramaMilhas).order_by(ProgramaMilhas.nome)
    programas = (await session.execute(stmt)).scalars().all()

    resultado = []
    for p in programas:
        cot = await _latest_cotacao(session, p.id)
        resultado.append(
            ProgramaAdminOut(
                id=p.id,
                slug=p.slug,
                nome=p.nome,
                moeda_taxas_default=p.moeda_taxas_default,
                ativo=p.ativo,
                cotacao_atual_brl=cot.valor_brl if cot else None,
                cotacao_vigente_desde=cot.vigente_desde if cot else None,
            )
        )
    return resultado


@router.post("/programas", response_model=ProgramaAdminOut, status_code=201)
async def criar_programa(
    body: ProgramaCreate,
    session: AsyncSession = Depends(get_session),
    _user: UUID = Depends(get_current_user),
) -> ProgramaAdminOut:
    """Cria um novo programa de milhas."""
    prog = ProgramaMilhas(
        slug=body.slug,
        nome=body.nome,
        moeda_taxas_default=body.moeda_taxas_default,
    )
    session.add(prog)
    await session.commit()
    await session.refresh(prog)
    return ProgramaAdminOut(
        id=prog.id, slug=prog.slug, nome=prog.nome,
        moeda_taxas_default=prog.moeda_taxas_default, ativo=prog.ativo,
    )


@router.patch("/programas/{programa_id}", response_model=ProgramaAdminOut)
async def atualizar_programa(
    programa_id: int,
    body: ProgramaUpdate,
    session: AsyncSession = Depends(get_session),
    _user: UUID = Depends(get_current_user),
) -> ProgramaAdminOut:
    """Atualiza nome, status ou moeda de um programa."""
    prog = await _get_programa(session, programa_id)
    if body.nome is not None:
        prog.nome = body.nome
    if body.ativo is not None:
        prog.ativo = body.ativo
    if body.moeda_taxas_default is not None:
        prog.moeda_taxas_default = body.moeda_taxas_default
    await session.commit()
    await session.refresh(prog)
    cot = await _latest_cotacao(session, prog.id)
    return ProgramaAdminOut(
        id=prog.id, slug=prog.slug, nome=prog.nome,
        moeda_taxas_default=prog.moeda_taxas_default, ativo=prog.ativo,
        cotacao_atual_brl=cot.valor_brl if cot else None,
        cotacao_vigente_desde=cot.vigente_desde if cot else None,
    )


@router.delete("/programas/{programa_id}", status_code=204)
async def deletar_programa(
    programa_id: int,
    session: AsyncSession = Depends(get_session),
    _user: UUID = Depends(get_current_user),
) -> None:
    """Remove um programa (hard delete). Use PATCH ativo=false para desativar."""
    prog = await _get_programa(session, programa_id)
    await session.delete(prog)
    await session.commit()


@router.get("/programas/{programa_id}/cotacoes", response_model=list[CotacaoOut])
async def historico_cotacoes(
    programa_id: int,
    session: AsyncSession = Depends(get_session),
    _user: UUID = Depends(get_current_user),
) -> list[CotacaoOut]:
    """Histórico de cotações de um programa."""
    await _get_programa(session, programa_id)
    stmt = (
        select(CotacaoMilheiro)
        .where(CotacaoMilheiro.programa_id == programa_id)
        .order_by(CotacaoMilheiro.vigente_desde.desc())
    )
    cotacoes = (await session.execute(stmt)).scalars().all()
    return [
        CotacaoOut(
            id=c.id, programa_id=c.programa_id,
            valor_brl=c.valor_brl, vigente_desde=c.vigente_desde, fonte=c.fonte,
        )
        for c in cotacoes
    ]


@router.post("/programas/{programa_id}/cotacao", response_model=CotacaoOut, status_code=201)
async def registrar_cotacao(
    programa_id: int,
    body: CotacaoCreate,
    session: AsyncSession = Depends(get_session),
    _user: UUID = Depends(get_current_user),
) -> CotacaoOut:
    """Registra uma nova cotação (R$/1.000 milhas) para o programa."""
    await _get_programa(session, programa_id)
    cot = CotacaoMilheiro(
        programa_id=programa_id,
        valor_brl=body.valor_brl,
        fonte="manual",
    )
    session.add(cot)
    await session.commit()
    await session.refresh(cot)
    return CotacaoOut(
        id=cot.id, programa_id=cot.programa_id,
        valor_brl=cot.valor_brl, vigente_desde=cot.vigente_desde, fonte=cot.fonte,
    )
