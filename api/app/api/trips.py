"""
Endpoint de voos individuais — busca trips detalhados no seats.aero
para uma rota/data/programa específicos.
Docs: https://developers.seats.aero/reference/get-trips
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


class Segmento(BaseModel):
    origem: str
    destino: str
    partida: Optional[str] = None          # HH:MM
    chegada: Optional[str] = None          # HH:MM
    numero_voo: Optional[str] = None
    duracao_minutos: Optional[int] = None
    layover_minutos: Optional[int] = None  # escala após este segmento
    escala: bool = False
    aeronave: Optional[str] = None


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
    airlines: list[str] = []          # CIAs operadoras (IATA), ex: ["AC","LH"]
    source: Optional[str] = None      # programa/parceiro seats.aero
    distancia_milhas: Optional[int] = None  # distância em milhas náuticas


def _build_link(source: str, origem: str, destino: str, data: str) -> Optional[str]:
    from app.adapters.seats_aero import _build_link as bl
    from datetime import date
    try:
        return bl(source, origem, destino, date.fromisoformat(data))
    except Exception:
        return None


def _parse_trips(data: dict, cabine: str, origem: str, destino: str, programa: str) -> list[Trip]:
    prefix = CABINE_PREFIX.get(cabine, "Y")
    trips: list[Trip] = []

    items = data.get("data", [])
    if items:
        first = items[0]
        print(f"[trips] keys no primeiro item: {list(first.keys())}")
        segs = first.get("Segments") or first.get("segments") or []
        if segs:
            print(f"[trips] segmento[0] keys: {list(segs[0].keys())}")
            print(f"[trips] segmento[0]: {segs[0]}")
        else:
            print(f"[trips] sem Segments — campos item: DepartureTime={first.get('DepartureTime')}, FlightNumber={first.get('FlightNumber')}, Aircraft={first.get('Aircraft')}, Distance={first.get('Distance')}, TotalDuration={first.get('TotalDuration')}")

    for item in items:
        if not item.get(f"{prefix}Available"):
            continue

        try:
            milhas = int(item.get(f"{prefix}MileageCost") or 0)
            taxas_raw = item.get(f"{prefix}TotalTaxes") or 0
            taxas_moeda = item.get("TaxesCurrency") or "USD"
            taxas_valor = float(taxas_raw) / 100
            paradas = int(item.get("Stops") or 0)
            duracao = item.get("TotalDuration") or item.get("Duration")

            # Segmentos individuais
            segmentos: list[Segmento] = []
            for seg in item.get("Segments") or item.get("segments") or []:
                layover_raw = seg.get("LayoverDuration") or seg.get("layoverDuration")
                segmentos.append(Segmento(
                    origem=seg.get("Origin") or seg.get("OriginAirport") or origem,
                    destino=seg.get("Destination") or seg.get("DestinationAirport") or destino,
                    partida=seg.get("DepartureTime") or seg.get("departureTime"),
                    chegada=seg.get("ArrivalTime") or seg.get("arrivalTime"),
                    numero_voo=seg.get("FlightNumber") or seg.get("flightNumber"),
                    duracao_minutos=seg.get("Duration") or seg.get("duration"),
                    layover_minutos=int(layover_raw) if layover_raw is not None else None,
                    aeronave=seg.get("Aircraft") or seg.get("aircraft"),
                    escala=seg.get("Stopover", False),
                ))

            # Se não tem segmentos, cria um sintético com os dados disponíveis
            if not segmentos:
                segmentos.append(Segmento(
                    origem=item.get("OriginAirport") or origem,
                    destino=item.get("DestinationAirport") or destino,
                    partida=item.get("DepartureTime") or item.get("departureTime"),
                    chegada=item.get("ArrivalTime") or item.get("arrivalTime"),
                    numero_voo=item.get("FlightNumber") or item.get("flightNumber"),
                    duracao_minutos=duracao,
                ))

            assentos_raw = item.get(f"{prefix}RemainingSeats")
            assentos = int(assentos_raw) if assentos_raw is not None else None

            airlines_raw = item.get(f"{prefix}Airlines") or ""
            airlines = [a.strip() for a in airlines_raw.split(",") if a.strip()]

            dist_raw = item.get("Distance") or item.get("distance")
            distancia_milhas = int(dist_raw) if dist_raw is not None else None

            trips.append(Trip(
                id=str(item.get("ID") or item.get("id") or len(trips)),
                origem=item.get("OriginAirport") or origem,
                destino=item.get("DestinationAirport") or destino,
                data=item.get("Date") or "",
                cabine=cabine,
                milhas=milhas,
                taxas_valor=taxas_valor,
                taxas_moeda=taxas_moeda,
                paradas=paradas,
                duracao_minutos=duracao,
                segmentos=segmentos,
                link_reserva=item.get("URL") or _build_link(programa, origem, destino, item.get("Date") or ""),
                assentos=assentos,
                airlines=airlines,
                source=item.get("Source") or item.get("source") or programa,
                distancia_milhas=distancia_milhas,
            ))
        except Exception as exc:
            print(f"[trips] parse skip: {exc}")
            continue

    return trips


@router.get("/api/trips", response_model=list[Trip])
async def get_trips(
    origem: str = Query(..., min_length=3, max_length=3),
    destino: str = Query(..., min_length=3, max_length=3),
    data: str = Query(..., description="YYYY-MM-DD"),
    cabine: str = Query(default="economica"),
    programa: str = Query(default=""),
) -> list[Trip]:
    """Retorna voos individuais do seats.aero para uma rota/data/programa."""
    if not settings.seats_aero_api_key:
        return []

    cabin_en = CABINE_MAP.get(cabine, "economy")

    params = {
        "origin_airport": origem.upper(),
        "destination_airport": destino.upper(),
        "start_date": data,
        "end_date": data,
        "cabin": cabin_en,
        "take": 100,
    }

    try:
        async with httpx.AsyncClient(timeout=10.0) as client:
            resp = await client.get(
                f"{settings.seats_aero_base_url}/search",
                params=params,
                headers={"Partner-Authorization": settings.seats_aero_api_key},
            )
            resp.raise_for_status()
            raw = resp.json()
    except httpx.TimeoutException:
        raise HTTPException(status_code=504, detail="Timeout ao consultar seats.aero")
    except httpx.HTTPStatusError as exc:
        raise HTTPException(status_code=exc.response.status_code, detail="Erro na API seats.aero")
    except Exception as exc:
        raise HTTPException(status_code=502, detail=str(exc))

    return _parse_trips(raw, cabine, origem.upper(), destino.upper(), programa)
