from fastapi import APIRouter
from sqlalchemy import text

from app.database import AsyncSessionLocal
from app.services.cache import _get_client

router = APIRouter()


@router.get("/api/health")
async def health() -> dict[str, str]:
    db_status = "ok"
    cache_status = "ok"

    # Verifica Postgres
    try:
        async with AsyncSessionLocal() as session:
            await session.execute(text("SELECT 1"))
    except Exception as exc:
        print(f"[health] db falhou: {exc}")
        db_status = "fail"

    # Verifica Redis
    try:
        client = _get_client()
        if client is None:
            cache_status = "unavailable"
        else:
            client.ping()
    except Exception as exc:
        print(f"[health] cache falhou: {exc}")
        cache_status = "fail"

    return {"status": "ok", "db": db_status, "cache": cache_status}
