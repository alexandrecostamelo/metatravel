"""
Endpoint de voos — busca disponibilidade no seats.aero via /search.
A API retorna dados agregados por rota/data: milhas, taxas, CIAs, assentos,
distância e se é direto. Detalhes por segmento (horário, número, aeronave)
não são retornados pelo plano atual da API.
"""
from typing import Optional

import httpx
from fastapi import APIRouter, HTTPException, Query
from pydantic import BaseModel

from app.config import settings

router = APIRouter()

CABINE_MAP = {
    "economica": "economy",
    "premium_economica": "premium",
    "executiva": "business",
    "primeira": "first",
}

CABINE_PREFIX = {
    "economica": "Y",
    "premium_economica": "W",
    "executiva": "J",
    "primeira": "F",
}

SLUG_TO_SOURCE: dict[str, str] = {
    "aeroplan": "aeroplan", "aadvantage": "american", "alaska": "alaska",
    "smiles": "smiles", "azul": "azul", "latam_pass": "latam",
    "united": "united", "delta": "delta", "emirates": "emirates",
    "avios_british": "british", "avios_qatar": "qatar", "avios_iberia": "iberia",
    "flying_blue": "flyingblue", "singapore": "singapore", "turkish": "turkish",
    "lufthansa": "lufthansa", "tap": "tap", "finnair_plus": "finnair",
    "virgin_atlantic": "virginatlantic", "etihad": "etihad", "qantas": "qantas",
}


class Segmento(BaseModel):
    origem: str
    destino: str
    partida: Optional[str] = None
    chegada: Optional[str] = None
    numero_voo: Optional[str] = None
    duracao_minutos: Optional[int] = None
    layover_minutos: Optional[int] = None
    escala: bool = False
    aeronave: Optional[str] = None


class BookingLink(BaseModel):
    label: str
    link: str
    primary: bool = False


class Trip(BaseModel):
    id: str
    origem: str
    destino: str
    data: str
    cabine: str
    milhas: int
    taxas_valor: float
    taxas_moeda: str
    paradas: int
    duracao_minutos: Optional[int] = None
    segmentos: list[Segmento] = []
    link_reserva: Optional[str] = None
    assentos: Optional[int] = None
    airlines: list[str] = []
    carriers: dict[str, str] = {}   # {"AD": "Azul Airlines", ...}
    source: Optional[str] = None
    distancia_milhas: Optional[int] = None
    direto: bool = False
    booking_links: list[BookingLink] = []


def _build_link(source: str, origem: str, destino: str, data: str) -> Optional[str]:
    from app.adapters.seats_aero import _build_link as bl
    from datetime import date
    try:
        return bl(source, origem, destino, date.fromisoformat(data))
    except Exception:
        return None


def _parse_avail_item(item: dict, cabine: str, origem: str, destino: str, programa: str) -> dict:
    """Extrai campos de disponibilidade de um item do /search."""
    prefix = CABINE_PREFIX.get(cabine, "Y")
    route = item.get("Route") or {}
    milhas = int(item.get(f"{prefix}MileageCostRaw") or item.get(f"{prefix}MileageCost") or 0)
    taxas_raw = int(item.get(f"{prefix}TotalTaxesRaw") or item.get(f"{prefix}TotalTaxes") or 0)
    taxas_moeda = item.get("TaxesCurrency") or "USD"
    taxas_valor = float(taxas_raw) / 100
    direto = bool(item.get(f"{prefix}Direct") or item.get(f"{prefix}DirectRaw"))
    assentos_raw = item.get(f"{prefix}RemainingSeatsRaw") or item.get(f"{prefix}RemainingSeats")
    airlines_raw = item.get(f"{prefix}AirlinesRaw") or item.get(f"{prefix}Airlines") or ""
    dist_raw = route.get("Distance")
    return {
        "id": str(item.get("ID") or ""),
        "origem": route.get("OriginAirport") or origem,
        "destino": route.get("DestinationAirport") or destino,
        "data": item.get("Date") or "",
        "milhas": milhas,
        "taxas_valor": taxas_valor,
        "taxas_moeda": taxas_moeda,
        "direto": direto,
        "assentos": int(assentos_raw) if assentos_raw is not None else None,
        "airlines": [a.strip() for a in airlines_raw.split(",") if a.strip()],
        "distancia_milhas": int(dist_raw) if dist_raw is not None else None,
        "link_reserva": item.get("URL") or _build_link(
            programa,
            route.get("OriginAirport") or origem,
            route.get("DestinationAirport") or destino,
            item.get("Date") or "",
        ),
        "source": item.get("Source") or programa,
    }


def _iso_to_hhmm(iso: Optional[str]) -> Optional[str]:
    """Extrai HH:MM de um datetime ISO 8601 (ex: '2026-05-21T23:45:00Z' → '23:45')."""
    if not iso:
        return None
    try:
        t = iso[11:16]  # posição fixa em ISO 8601
        if len(t) == 5 and ":" in t:
            return t
    except Exception:
        pass
    return None


def _parse_trip_detail(
    flight: dict, avail: dict, cabine: str, idx: int,
    booking_links: list["BookingLink"] = [],
    carriers: dict = {},
    primary_link: Optional[str] = None,
) -> Trip:
    """Converte um voo individual do endpoint /trips/{id} em Trip."""
    segs: list[Segmento] = []
    raw_segs = flight.get("AvailabilitySegments") or flight.get("Segments") or flight.get("segments") or []
    for i, seg in enumerate(raw_segs):
        next_seg = raw_segs[i + 1] if i + 1 < len(raw_segs) else None
        # Calcula layover: diferença entre chegada deste e partida do próximo
        layover_mins: Optional[int] = None
        if next_seg:
            try:
                from datetime import datetime, timezone
                arr = datetime.fromisoformat(seg["ArrivesAt"].replace("Z", "+00:00"))
                dep = datetime.fromisoformat(next_seg["DepartsAt"].replace("Z", "+00:00"))
                layover_mins = int((dep - arr).total_seconds() / 60)
            except Exception:
                pass

        segs.append(Segmento(
            origem=seg.get("OriginAirport") or avail["origem"],
            destino=seg.get("DestinationAirport") or avail["destino"],
            partida=_iso_to_hhmm(seg.get("DepartsAt")),
            chegada=_iso_to_hhmm(seg.get("ArrivesAt")),
            numero_voo=seg.get("FlightNumber"),
            duracao_minutos=seg.get("Duration") or None,
            layover_minutos=layover_mins,
            aeronave=seg.get("AircraftName") or seg.get("Aircraft"),
            escala=i < len(raw_segs) - 1,
        ))

    paradas = max(0, len(segs) - 1)
    # Duração total = soma dos segmentos + layovers
    total_dur = avail.get("duracao_minutos") or flight.get("TotalDuration")
    if not total_dur and segs:
        seg_dur = sum(s.duracao_minutos or 0 for s in segs)
        lay_dur = sum(s.layover_minutos or 0 for s in segs)
        total_dur = seg_dur + lay_dur if seg_dur else None

    # CIAs: extraídas dos números de voo dos segmentos
    airlines = list({
        s.numero_voo[:2] for s in segs
        if s.numero_voo and len(s.numero_voo) >= 2
    }) or avail["airlines"]

    # Distância total = soma das distâncias dos segmentos
    dist = sum(seg.get("Distance") or 0 for seg in raw_segs) or avail["distancia_milhas"]

    return Trip(
        id=str(flight.get("ID") or f"{avail['id']}_{idx}"),
        origem=avail["origem"],
        destino=avail["destino"],
        data=avail["data"],
        cabine=cabine,
        milhas=avail["milhas"],
        taxas_valor=avail["taxas_valor"],
        taxas_moeda=avail["taxas_moeda"],
        paradas=paradas,
        direto=paradas == 0,
        duracao_minutos=int(total_dur) if total_dur else None,
        segmentos=segs,
        assentos=avail["assentos"],
        airlines=airlines,
        distancia_milhas=int(dist) if dist else None,
        link_reserva=primary_link or flight.get("URL") or avail["link_reserva"],
        booking_links=booking_links,
        carriers=carriers,
        source=avail["source"],
    )


@router.get("/api/trips", response_model=list[Trip])
async def get_trips(
    origem: str = Query(..., min_length=3, max_length=3),
    destino: str = Query(..., min_length=3, max_length=3),
    data: str = Query(..., description="YYYY-MM-DD"),
    cabine: str = Query(default="economica"),
    programa: str = Query(default=""),
) -> list[Trip]:
    """Retorna disponibilidade de voos do seats.aero para uma rota/data/programa."""
    if not settings.seats_aero_api_key:
        return []

    cabin_en = CABINE_MAP.get(cabine, "economy")
    source = SLUG_TO_SOURCE.get(programa, programa)

    params: dict = {
        "origin_airport": origem.upper(),
        "destination_airport": destino.upper(),
        "start_date": data,
        "end_date": data,
        "cabin": cabin_en,
        "take": 20,
    }
    if source:
        params["source"] = source

    try:
        async with httpx.AsyncClient(timeout=20.0) as client:
            # 1) Busca disponibilidade para obter IDs
            resp = await client.get(
                f"{settings.seats_aero_base_url}/search",
                params=params,
                headers={"Partner-Authorization": settings.seats_aero_api_key},
            )
            resp.raise_for_status()
            search_data = resp.json()

            prefix = CABINE_PREFIX.get(cabine, "Y")
            available = [
                it for it in search_data.get("data", [])
                if it.get(f"{prefix}Available") and it.get("ID")
            ][:8]

            if not available:
                return []

            # 2) Para cada disponibilidade, busca voos individuais via /trips/{id}
            import asyncio

            async def fetch_trips_detail(avail_item: dict) -> list[Trip]:
                avail = _parse_avail_item(avail_item, cabine, origem.upper(), destino.upper(), programa)
                try:
                    r = await client.get(
                        f"{settings.seats_aero_base_url}/trips/{avail_item['ID']}",
                        headers={"Partner-Authorization": settings.seats_aero_api_key},
                    )
                    if r.status_code == 200:
                        flights = r.json()
                        # Resposta: {"data": [...], "booking_links": [...], "carriers": {...}}
                        inner: list = []
                        raw_booking_links: list = []
                        raw_carriers: dict = {}
                        if isinstance(flights, dict):
                            inner = flights.get("data") or []
                            raw_booking_links = flights.get("booking_links") or []
                            raw_carriers = flights.get("carriers") or {}
                        elif isinstance(flights, list):
                            inner = flights
                        booking_links = [
                            BookingLink(label=bl.get("label", ""), link=bl.get("link", ""), primary=bl.get("primary", False))
                            for bl in raw_booking_links if bl.get("link")
                        ]
                        primary_link = next((bl.link for bl in booking_links if bl.primary), None)
                        if inner:
                            return [
                                _parse_trip_detail(f, avail, cabine, i, booking_links, raw_carriers, primary_link)
                                for i, f in enumerate(inner)
                            ]
                except Exception as exc:
                    print(f"[trips] /trips/{avail_item['ID']} erro: {exc}")
                # Fallback: retorna um Trip com os dados de disponibilidade
                return [Trip(
                    id=avail["id"], origem=avail["origem"], destino=avail["destino"],
                    data=avail["data"], cabine=cabine, milhas=avail["milhas"],
                    taxas_valor=avail["taxas_valor"], taxas_moeda=avail["taxas_moeda"],
                    paradas=0 if avail["direto"] else 1, direto=avail["direto"],
                    assentos=avail["assentos"], airlines=avail["airlines"],
                    distancia_milhas=avail["distancia_milhas"],
                    link_reserva=avail["link_reserva"], source=avail["source"],
                    booking_links=[], carriers={},
                )]

            results = await asyncio.gather(*[fetch_trips_detail(it) for it in available])
            trips: list[Trip] = [t for group in results for t in group]
            return trips

    except httpx.TimeoutException:
        raise HTTPException(status_code=504, detail="Timeout ao consultar seats.aero")
    except httpx.HTTPStatusError as exc:
        raise HTTPException(status_code=exc.response.status_code, detail="Erro na API seats.aero")
    except Exception as exc:
        raise HTTPException(status_code=502, detail=str(exc))
