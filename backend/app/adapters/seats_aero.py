"""
Adapter para o seats.aero (Cached Search / Partner API).

Este é um esqueleto funcional: ele faz a chamada HTTP real, mas o
mapeamento do JSON de resposta para `Oferta` está marcado com TODO
porque você precisa rodar uma busca real e inspecionar o shape que
seats.aero devolve para mapear os campos exatos (o formato muda
ocasionalmente).

Docs: https://developers.seats.aero/reference/cached-search
"""
from datetime import date
from decimal import Decimal

import httpx
import structlog

from app.adapters.base import BaseAdapter
from app.config import settings
from app.schemas.busca import BuscaRequest
from app.schemas.oferta import Cabine, Oferta

log = structlog.get_logger()


# Mapeamento de cabine do nosso enum para o que o seats.aero espera
CABINE_MAP = {
    Cabine.ECONOMICA: "economy",
    Cabine.PREMIUM_ECONOMICA: "premium",
    Cabine.EXECUTIVA: "business",
    Cabine.PRIMEIRA: "first",
}


class SeatsAeroAdapter(BaseAdapter):
    nome = "seats_aero"

    def __init__(self) -> None:
        self.base_url = settings.seats_aero_base_url
        self.api_key = settings.seats_aero_api_key

    async def buscar(self, req: BuscaRequest) -> list[Oferta]:
        if not self.api_key:
            log.warning("seats_aero_sem_chave", msg="SEATS_AERO_API_KEY vazia, pulando")
            return []

        params = {
            "origin_airport": req.origem,
            "destination_airport": req.destino,
            "start_date": req.data_ida.isoformat(),
            "end_date": (req.data_volta or req.data_ida).isoformat(),
            "cabin": CABINE_MAP[req.cabine],
            "take": 100,
        }
        headers = {"Partner-Authorization": self.api_key}

        try:
            async with httpx.AsyncClient(timeout=15.0) as client:
                resp = await client.get(
                    f"{self.base_url}/search",
                    params=params,
                    headers=headers,
                )
                resp.raise_for_status()
                data = resp.json()
        except httpx.HTTPError as exc:
            log.error("seats_aero_http_error", error=str(exc))
            return []

        return self._parse(data, req)

    def _parse(self, data: dict, req: BuscaRequest) -> list[Oferta]:
        """Converte o JSON do seats.aero em `Oferta`s normalizadas.

        TODO: rodar uma busca real, inspecionar `data["data"]` e mapear
        os campos corretos. O esboço abaixo assume uma estrutura típica
        e deve ser ajustado.
        """
        ofertas: list[Oferta] = []

        for item in data.get("data", []):
            try:
                ofertas.append(
                    Oferta(
                        origem=item.get("Route", {}).get("OriginAirport", req.origem),
                        destino=item.get("Route", {}).get("DestinationAirport", req.destino),
                        data_ida=date.fromisoformat(item["Date"]),
                        data_volta=None,
                        cia_aerea=item.get("Route", {}).get("Source", "??"),
                        cabine=req.cabine,
                        paradas=0,  # cached search não detalha; usar Get Trips depois
                        programa=item.get("Route", {}).get("Source", "unknown").lower(),
                        milhas=int(item.get("YMileageCost", 0) or 0),
                        taxas_moeda=item.get("TaxesCurrency", "USD"),
                        taxas_valor=Decimal(str(item.get("YTotalTaxes", 0) or 0)) / 100,
                        fonte=self.nome,
                    )
                )
            except (KeyError, ValueError, TypeError) as exc:
                log.warning("seats_aero_parse_skip", error=str(exc))
                continue

        log.info("seats_aero_ok", total=len(ofertas))
        return ofertas
