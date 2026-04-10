import time

from fastapi import APIRouter
from pydantic import BaseModel

from app.config import settings

router = APIRouter()

_start_time = time.time()


class InfoResponse(BaseModel):
    versao: str
    ambiente: str
    uptime_segundos: float


@router.get("/api/info", response_model=InfoResponse)
async def info() -> InfoResponse:
    return InfoResponse(
        versao="0.2.0",
        ambiente="dev" if settings.app_debug else "prod",
        uptime_segundos=round(time.time() - _start_time, 1),
    )
