import base64
from typing import Optional
from uuid import UUID

import jwt
from fastapi import Depends, HTTPException, status
from fastapi.security import HTTPAuthorizationCredentials, HTTPBearer

from app.config import settings

_bearer = HTTPBearer(auto_error=False)


def _jwt_secret() -> bytes:
    """Retorna o segredo JWT decodificado de base64 (formato Supabase)."""
    raw = settings.supabase_jwt_secret
    try:
        return base64.b64decode(raw)
    except Exception:
        return raw.encode()


def _decode(token: str) -> dict:
    return jwt.decode(
        token,
        _jwt_secret(),
        algorithms=["HS256"],
        audience="authenticated",
    )


async def get_current_user(
    credentials: HTTPAuthorizationCredentials = Depends(_bearer),
) -> UUID:
    if credentials is None:
        raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="Token ausente")
    try:
        payload = _decode(credentials.credentials)
        return UUID(payload["sub"])
    except Exception:
        raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="Token inválido")


async def get_current_user_optional(
    credentials: HTTPAuthorizationCredentials = Depends(_bearer),
) -> Optional[UUID]:
    if credentials is None:
        return None
    try:
        payload = _decode(credentials.credentials)
        return UUID(payload["sub"])
    except Exception:
        return None
