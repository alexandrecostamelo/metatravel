"""
Autenticação JWT via Supabase.
Suporta RS256 (JWKS) e HS256 (secret direto).
"""
import logging
from typing import Optional
from uuid import UUID

import jwt
from jwt import PyJWKClient
from fastapi import Depends, HTTPException, status
from fastapi.security import HTTPAuthorizationCredentials, HTTPBearer

from app.config import settings

_bearer = HTTPBearer(auto_error=False)
logger = logging.getLogger(__name__)

_jwks_client: Optional[PyJWKClient] = None


def _get_jwks_client() -> PyJWKClient:
    global _jwks_client
    if _jwks_client is None:
        url = f"{settings.supabase_url}/auth/v1/.well-known/jwks.json"
        _jwks_client = PyJWKClient(url, cache_keys=True)
    return _jwks_client


def _decode(token: str) -> dict:
    # Tenta RS256/ES256 via JWKS (padrão em projetos Supabase recentes)
    if settings.supabase_url:
        try:
            client = _get_jwks_client()
            signing_key = client.get_signing_key_from_jwt(token)
            return jwt.decode(
                token,
                signing_key.key,
                algorithms=["RS256", "ES256", "HS256"],
                options={"verify_aud": False},
                leeway=10,
            )
        except Exception as e:
            logger.warning("[auth] JWKS falhou (%s: %s), tentando HS256 direto", type(e).__name__, e)

    # Fallback: HS256 com secret direto
    secret = settings.supabase_jwt_secret
    if not secret:
        raise ValueError("SUPABASE_JWT_SECRET e SUPABASE_URL não configurados")
    return jwt.decode(
        token,
        secret,
        algorithms=["HS256"],
        options={"verify_aud": False},
        leeway=10,
    )


async def get_current_user(
    credentials: HTTPAuthorizationCredentials = Depends(_bearer),
) -> UUID:
    if credentials is None:
        raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="Token ausente")
    try:
        payload = _decode(credentials.credentials)
        user_id = payload.get("sub")
        if not user_id:
            raise ValueError("sub ausente no token")
        return UUID(user_id)
    except jwt.ExpiredSignatureError:
        raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="Token expirado")
    except jwt.InvalidSignatureError:
        raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="Token: assinatura inválida")
    except Exception as e:
        logger.exception("[auth] falha ao validar token")
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
