import base64
import json
import logging
from typing import Optional
from uuid import UUID

import jwt
from fastapi import Depends, HTTPException, status
from fastapi.security import HTTPAuthorizationCredentials, HTTPBearer

from app.config import settings

_bearer = HTTPBearer(auto_error=False)
logger = logging.getLogger(__name__)


def _token_alg(token: str) -> str:
    """Lê o algoritmo do header JWT sem verificar assinatura."""
    try:
        part = token.split(".")[0]
        part += "=" * (4 - len(part) % 4)
        header = json.loads(base64.b64decode(part))
        return header.get("alg", "HS256")
    except Exception:
        return "HS256"


def _decode(token: str) -> dict:
    secret = settings.supabase_jwt_secret
    if not secret:
        raise ValueError("SUPABASE_JWT_SECRET não configurado")
    alg = _token_alg(token)
    print(f"[auth] algoritmo do token: {alg}", flush=True)
    return jwt.decode(
        token,
        secret,
        algorithms=[alg],
        options={"verify_aud": False},
        leeway=10,
    )


async def get_current_user(
    credentials: HTTPAuthorizationCredentials = Depends(_bearer),
) -> UUID:
    if credentials is None:
        print("[auth] ERRO: credentials ausentes — Authorization header não enviado", flush=True)
        raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="Token ausente")
    try:
        payload = _decode(credentials.credentials)
        user_id = payload.get("sub")
        if not user_id:
            raise ValueError("sub ausente no token")
        return UUID(user_id)
    except jwt.ExpiredSignatureError:
        print("[auth] ERRO: token expirado", flush=True)
        raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="Token expirado")
    except jwt.InvalidSignatureError:
        secret = settings.supabase_jwt_secret
        print(f"[auth] ERRO: assinatura inválida — secret len={len(secret)} prefix={secret[:6]!r}", flush=True)
        raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="Token: assinatura inválida")
    except Exception as e:
        print(f"[auth] ERRO inesperado: {type(e).__name__}: {e}", flush=True)
        raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail=f"Token inválido: {type(e).__name__}: {e}")


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
