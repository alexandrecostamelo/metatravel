from functools import lru_cache
from typing import Any

import airportsdata
from fastapi import APIRouter, Query

router = APIRouter()


@lru_cache(maxsize=1)
def _load() -> dict[str, Any]:
    """Carrega o dataset IATA uma única vez (fica em memória na instância)."""
    return airportsdata.load("IATA")


@router.get("/api/airports")
def search_airports(q: str = Query(default="", min_length=0, max_length=50)) -> list[dict]:
    """
    Busca aeroportos pelo código IATA, cidade ou nome.
    Retorna até 8 resultados, priorizando match exato de IATA.
    """
    q = q.strip()
    if not q:
        return []

    db = _load()
    q_upper = q.upper()
    q_lower = q.lower()

    exact: list[dict] = []
    prefix: list[dict] = []
    text: list[dict] = []

    for iata, ap in db.items():
        name: str = ap.get("name", "")
        city: str = ap.get("city", "")
        country: str = ap.get("country", "")

        entry = {
            "iata": iata,
            "name": name,
            "city": city,
            "country": country,
        }

        if iata == q_upper:
            exact.append(entry)
        elif iata.startswith(q_upper):
            prefix.append(entry)
        elif (
            q_lower in city.lower()
            or q_lower in name.lower()
            or q_lower in country.lower()
        ):
            text.append(entry)

    results = exact + prefix + text
    return results[:8]
