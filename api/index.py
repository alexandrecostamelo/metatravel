import sys
from pathlib import Path

sys.path.insert(0, str(Path(__file__).parent))

from fastapi import FastAPI, Request
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import Response

from app.api import busca, buscas, cron, health, info, programas
from app.config import settings
from app.middleware.rate_limit import RateLimitMiddleware

app = FastAPI(
    title="Passagens em Milhas API",
    description="Busca, valora e compara passagens aéreas em milhas convertidas para R$",
    version="0.2.0",
    debug=settings.app_debug,
)

app.add_middleware(
    CORSMiddleware,
    allow_origins=[
        "https://voo-facil-milhas.lovable.app",
        "https://id-preview--10b66dbe-ca9f-4b63-8f13-246cd2a4ecad.lovable.app",
        "http://localhost:5173",
        "http://localhost:8080",
    ],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)
app.add_middleware(RateLimitMiddleware)

app.include_router(health.router)
app.include_router(info.router)
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
