import sys
from pathlib import Path

sys.path.insert(0, str(Path(__file__).parent))

import re

from fastapi import FastAPI, Request
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import Response

from app.api import airports, busca, buscas, cron, health, info, programas
from app.config import settings
from app.middleware.rate_limit import RateLimitMiddleware

ALLOWED_ORIGIN_PATTERNS = [
    re.compile(r"^https://.*\.lovable\.app$"),
    re.compile(r"^http://localhost:\d+$"),
]

app = FastAPI(
    title="Passagens em Milhas API",
    description="Busca, valora e compara passagens aéreas em milhas convertidas para R$",
    version="0.2.0",
    debug=settings.app_debug,
)

app.add_middleware(
    CORSMiddleware,
    allow_origin_regex=r"^(https://.*\.lovable\.app|http://localhost:\d+)$",
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)
app.add_middleware(RateLimitMiddleware)

app.include_router(health.router)
app.include_router(info.router)
app.include_router(airports.router)
app.include_router(busca.router)
app.include_router(programas.router)
app.include_router(buscas.router)
app.include_router(cron.router)


@app.middleware("http")
async def add_api_headers(request: Request, call_next) -> Response:
    response = await call_next(request)
    if request.url.path.startswith("/api"):
        response.headers["X-Robots-Tag"] = "noindex"
    return response


@app.get("/")
async def root() -> dict[str, str]:
    return {"app": "passagens-milhas", "docs": "/docs", "health": "/api/health"}
