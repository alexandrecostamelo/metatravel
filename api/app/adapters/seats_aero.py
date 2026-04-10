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
                source_slug = cia.lower()

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
                        link_reserva=item.get("URL"),
                        fonte=self.nome,
                    )
                )
            except (KeyError, ValueError, TypeError) as exc:
                print(f"[seats_aero] parse skip: {exc}")
                continue

        return ofertas
