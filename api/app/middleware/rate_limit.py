"""
Rate limit por IP via Upstash Redis.
- Anônimo:      10 req/min em /api/busca
- Autenticado:  30 req/min em /api/busca
"""
import time
from typing import Optional

import jwt
from fastapi import Request, Response
from fastapi.responses import JSONResponse
from starlette.middleware.base import BaseHTTPMiddleware

from app.config import settings
from app.services.cache import _get_client

_LIMIT_ANONIMO = 10
_LIMIT_AUTENTICADO = 30


def _get_ip(request: Request) -> str:
    forwarded = request.headers.get("x-forwarded-for")
    if forwarded:
        return forwarded.split(",")[0].strip()
    return request.client.host if request.client else "unknown"


def _is_authenticated(request: Request) -> bool:
    auth = request.headers.get("Authorization", "")
    if not auth.startswith("Bearer "):
        return False
    token = auth[7:]
    try:
        jwt.decode(
            token,
            settings.supabase_jwt_secret,
            algorithms=["HS256"],
            audience="authenticated",
        )
        return True
    except Exception:
        return False


class RateLimitMiddleware(BaseHTTPMiddleware):
    async def dispatch(self, request: Request, call_next) -> Response:
        # Aplica apenas em /api/busca
        if request.url.path != "/api/busca" or request.method != "POST":
            return await call_next(request)

        client = _get_client()
        if client is None:
            # Redis indisponível — deixa passar (não bloqueia o serviço)
            return await call_next(request)

        ip = _get_ip(request)
        autenticado = _is_authenticated(request)
        limite = _LIMIT_AUTENTICADO if autenticado else _LIMIT_ANONIMO
        minuto = int(time.time() // 60)
        key = f"ratelimit:{ip}:{minuto}"

        try:
            contagem = client.incr(key)
            if contagem == 1:
                client.expire(key, 60)
        except Exception as exc:
            print(f"[rate_limit] erro Redis: {exc}")
            return await call_next(request)

        if contagem > limite:
            return JSONResponse(
                status_code=429,
                content={"detail": "Muitas buscas. Aguarde 1 minuto e tente novamente."},
                headers={"Retry-After": "60"},
            )

        response = await call_next(request)
        response.headers["X-RateLimit-Limit"] = str(limite)
        response.headers["X-RateLimit-Remaining"] = str(max(0, limite - contagem))
        return response
