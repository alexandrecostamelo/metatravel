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
from typing import Optional

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

# Mapeamento de Source (seats.aero) → URL de busca do programa
# {o} = origem IATA, {d} = destino IATA, {dt} = data YYYY-MM-DD
_LINK_TEMPLATES: dict[str, str] = {
    "AC": "https://www.aircanada.com/aeroplan/redeem/availability/outbound?org0={o}&dest0={d}&departureDate0={dt}&ADT=1&YTH=0&CHD=0&INF=0&INS=0&marketCode=INT",
    "AS": "https://www.alaskaair.com/search/results?o0={o}&d0={d}&dt0={dt}&px=1&tt=1&pt=MilesOnly",
    "AA": "https://www.aa.com/booking/find-flights",
    "DL": "https://www.delta.com/us/en/flight-search/search?tripType=ONE_WAY&passengers.adultCount=1&departureCity={o}&arrivalCity={d}&departureDate={dt}&fareType=MILES",
    "UA": "https://www.united.com/ual/en/us/flight-search/book-a-flight/results/rev?f={o}&t={d}&d={dt}&tt=1&sc=7&px=1&taxer=1",
    "BA": "https://www.britishairways.com/travel/redeem/execclub/_gf/en_gb?eId=106013&od={o}{d}&dd={dt}&ar=1",
    "QR": "https://www.qatarairways.com/en/privilege-club/redeem-avios.html",
    "EK": "https://www.emirates.com/english/book/",
    "SQ": "https://www.singaporeair.com/en_UK/us/plan-travel/book-a-flight/",
    "VS": "https://www.virginatlantic.com/flights/search",
    "ANA": "https://www.ana.co.jp/en/us/flyandbuy/",
    "NH": "https://www.ana.co.jp/en/us/flyandbuy/",
    "LH": "https://www.miles-and-more.com/row/en/earn/flight-award.html",
    "AF": "https://www.flyingblue.com/en/spend/flights/search",
    "KL": "https://www.flyingblue.com/en/spend/flights/search",
    "TK": "https://www.turkishairlines.com/en-us/miles-and-smiles/use-miles/",
    "EY": "https://www.etihad.com/en-us/etihad-guest/redeem/",
    "smiles": "https://www.smiles.com.br/compra/passagem/resultado?originAirportCode={o}&destinationAirportCode={d}&departureDate={dt}&adults=1&tripType=2",
    "azul": "https://www.voeazul.com.br/tudo-azul/compra-com-pontos",
    "latam_pass": "https://www.latamairlines.com/br/pt/latam-pass/usar-pontos",
}


def _build_link(source: str, origem: str, destino: str, data_ida: date) -> Optional[str]:
    """Retorna URL de reserva para o programa, com deep link quando disponível."""
    template = _LINK_TEMPLATES.get(source.upper()) or _LINK_TEMPLATES.get(source.lower())
    if not template:
        return None
    return template.format(o=origem, d=destino, dt=data_ida.isoformat())


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
                        link_reserva=_build_link(
                            item.get("Route", {}).get("Source", ""),
                            item.get("Route", {}).get("OriginAirport", req.origem),
                            item.get("Route", {}).get("DestinationAirport", req.destino),
                            date.fromisoformat(item["Date"]),
                        ),
                        fonte=self.nome,
                    )
                )
            except (KeyError, ValueError, TypeError) as exc:
                log.warning("seats_aero_parse_skip", error=str(exc))
                continue

        log.info("seats_aero_ok", total=len(ofertas))
        return ofertas
