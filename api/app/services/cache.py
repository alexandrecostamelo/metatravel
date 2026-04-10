"""
Cache via Upstash Redis REST API.
Stateless e compatível com serverless (sem conexão persistente).
Em caso de falha do Redis, degrada silenciosamente.
"""
import json
from typing import Any, Optional

from upstash_redis import Redis

from app.config import settings

_client: Optional[Redis] = None


def _get_client() -> Optional[Redis]:
    global _client
    if _client is not None:
        return _client
    if not settings.upstash_redis_rest_url or not settings.upstash_redis_rest_token:
        return None
    try:
        _client = Redis(
            url=settings.upstash_redis_rest_url,
            token=settings.upstash_redis_rest_token,
        )
    except Exception as exc:
        print(f"[cache] falha ao criar cliente Redis: {exc}")
    return _client


async def cache_get(key: str) -> Optional[Any]:
    client = _get_client()
    if client is None:
        return None
    try:
        raw = client.get(key)
        if raw is None:
            print(f"[cache] miss: {key}")
            return None
        print(f"[cache] hit: {key}")
        return json.loads(raw)
    except Exception as exc:
        print(f"[cache] erro no get ({key}): {exc}")
        return None


async def cache_set(key: str, value: Any, ttl: int = 900) -> None:
    client = _get_client()
    if client is None:
        return
    try:
        client.set(key, json.dumps(value), ex=ttl)
        print(f"[cache] set: {key} ttl={ttl}s")
    except Exception as exc:
        print(f"[cache] erro no set ({key}): {exc}")
