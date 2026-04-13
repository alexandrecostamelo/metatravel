"""
Adapter para a Partner API do seats.aero (Cached Search).
Docs: https://developers.seats.aero/reference/cached-search
"""
from datetime import date
from decimal import Decimal

import httpx

from app.adapters.base import BaseAdapter
from app.config import settings
from app.schemas.busca import BuscaRequest
from app.schemas.oferta import Cabine, Oferta

CABINE_MAP = {
    Cabine.ECONOMICA: "economy",
    Cabine.PREMIUM_ECONOMICA: "premium",
    Cabine.EXECUTIVA: "business",
    Cabine.PRIMEIRA: "first",
}

# Prefixos de campo por cabine no JSON do seats.aero
_CABINE_PREFIX = {
    Cabine.ECONOMICA: "Y",
    Cabine.PREMIUM_ECONOMICA: "W",
    Cabine.EXECUTIVA: "J",
    Cabine.PRIMEIRA: "F",
}

# Mapeamento do campo Route.Source do seats.aero → slug do banco
# Verificado empiricamente em 2026-04-09 via buscas reais na API
SOURCE_SLUG_MAP: dict[str, str] = {
    "aeroplan":      "aeroplan",
    "american":      "aadvantage",
    "alaska":        "alaska",
    "azul":          "azul",
    "emirates":      "emirates",
    "etihad":        "etihad",
    "finnair":       "finnair_plus",
    "flyingblue":    "flying_blue",
    "iberia":        "avios_iberia",
    "british":       "avios_british",
    "lufthansa":     "lufthansa",
    "qantas":        "qantas",
    "qatar":         "avios_qatar",
    "singapore":     "singapore",
    "tap":           "tap",
    "turkish":       "turkish",
    "united":        "united",
    "virginatlantic":"virgin_atlantic",
    # programas brasileiros (via Moblix futuramente)
    "smiles":        "smiles",
    "latam":         "latam_pass",
}

# Links de busca por programa. {o}=origem, {d}=destino, {dt}=data YYYY-MM-DD
_BOOKING_LINKS: dict[str, str] = {
    "aeroplan":      "https://www.aircanada.com/aeroplan/redeem/availability/outbound?org0={o}&dest0={d}&departureDate0={dt}&ADT=1&YTH=0&CHD=0&INF=0&INS=0&marketCode=INT",
    "aadvantage":    "https://www.aa.com/booking/find-flights",
    "alaska":        "https://www.alaskaair.com/search/results?o0={o}&d0={d}&dt0={dt}&px=1&tt=1&pt=MilesOnly",
    "emirates":      "https://www.emirates.com/english/book/",
    "etihad":        "https://www.etihad.com/en-us/etihad-guest/redeem/",
    "finnair_plus":  "https://www.finnair.com/en/flights",
    "flying_blue":   "https://www.flyingblue.com/en/spend/flights/search",
    "avios_iberia":  "https://www.iberia.com/en/avios/spend-avios/",
    "avios_british": "https://www.britishairways.com/travel/redeem/execclub/_gf/en_gb?eId=106013&od={o}{d}&dd={dt}&ar=1",
    "lufthansa":     "https://www.miles-and-more.com/row/en/earn/flight-award.html",
    "qantas":        "https://www.qantas.com/us/en/frequent-flyer/points/use-points/classic-flight-rewards.html",
    "avios_qatar":   "https://www.qatarairways.com/en/privilege-club/redeem-avios.html",
    "singapore":     "https://www.singaporeair.com/en_UK/us/plan-travel/book-a-flight/",
    "tap":           "https://www.flytap.com/en-pt/miles-points/use-miles",
    "turkish":       "https://www.turkishairlines.com/en-us/miles-and-smiles/use-miles/",
    "united":        "https://www.united.com/ual/en/us/flight-search/book-a-flight/results/rev?f={o}&t={d}&d={dt}&tt=1&sc=7&px=1&taxer=1",
    "virgin_atlantic":"https://www.virginatlantic.com/flights/search",
    "smiles":        "https://www.smiles.com.br/compra/passagem/resultado?originAirportCode={o}&destinationAirportCode={d}&departureDate={dt}&adults=1&tripType=2",
    "azul":          "https://www.voeazul.com.br/tudo-azul/compra-com-pontos",
    "latam_pass":    "https://www.latamairlines.com/br/pt/latam-pass/usar-pontos",
}


def _build_link(slug: str, origem: str, destino: str, data_ida: date) -> str | None:
    template = _BOOKING_LINKS.get(slug)
    if not template:
        return None
    return template.format(o=origem, d=destino, dt=data_ida.isoformat())


class SeatsAeroAdapter(BaseAdapter):
    nome = "seats_aero"

    async def buscar(self, req: BuscaRequest) -> list[Oferta]:
        if not settings.seats_aero_api_key:
            print("[seats_aero] SEATS_AERO_API_KEY vazia, pulando")
            return []

        params = {
            "origin_airport": req.origem,
            "destination_airport": req.destino,
            "start_date": req.data_ida.isoformat(),
            "end_date": (req.data_volta or req.data_ida).isoformat(),
            "cabin": CABINE_MAP[req.cabine],
            "take": 100,
        }

        try:
            async with httpx.AsyncClient(timeout=6.0) as client:
                resp = await client.get(
                    f"{settings.seats_aero_base_url}/search",
                    params=params,
                    headers={"Partner-Authorization": settings.seats_aero_api_key},
                )
                resp.raise_for_status()
                data = resp.json()
        except httpx.TimeoutException:
            print("[seats_aero] timeout na chamada à API")
            return []
        except httpx.HTTPStatusError as exc:
            print(f"[seats_aero] HTTP {exc.response.status_code}: {exc.response.text[:200]}")
            return []
        except Exception as exc:
            print(f"[seats_aero] erro inesperado: {exc}")
            return []

        ofertas = self._parse(data, req)
        print(f"[seats_aero] ok, total={len(ofertas)}")
        return ofertas

    def _parse(self, data: dict, req: BuscaRequest) -> list[Oferta]:
        prefix = _CABINE_PREFIX[req.cabine]
        ofertas: list[Oferta] = []

        for item in data.get("data", []):
            # Só inclui se houver disponibilidade na cabine solicitada
            if not item.get(f"{prefix}Available"):
                continue

            try:
                route = item.get("Route", {})
                origem = route.get("OriginAirport") or req.origem
                destino = route.get("DestinationAirport") or req.destino
                cia = route.get("Source") or "??"
                source_slug = SOURCE_SLUG_MAP.get(cia.lower(), cia.lower())

                milhas_raw = item.get(f"{prefix}MileageCost") or 0
                taxas_raw = item.get(f"{prefix}TotalTaxes") or 0
                taxas_moeda = item.get("TaxesCurrency") or "USD"

                # seats.aero devolve taxas em centavos
                taxas_valor = Decimal(str(taxas_raw)) / 100

                # Número de paradas: seats.aero não expõe diretamente; usa 0 como default
                paradas = int(item.get("Stops") or 0)

                ofertas.append(
                    Oferta(
                        origem=origem,
                        destino=destino,
                        data_ida=date.fromisoformat(item["Date"]),
                        data_volta=req.data_volta,
                        cia_aerea=cia,
                        cabine=req.cabine,
                        paradas=paradas,
                        programa=source_slug,
                        milhas=int(milhas_raw),
                        taxas_moeda=taxas_moeda,
                        taxas_valor=taxas_valor,
                        link_reserva=item.get("URL") or _build_link(source_slug, origem, destino, date.fromisoformat(item["Date"])),
                        fonte=self.nome,
                    )
                )
            except (KeyError, ValueError, TypeError) as exc:
                print(f"[seats_aero] parse skip: {exc}")
                continue

        return ofertas
