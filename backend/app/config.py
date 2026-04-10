"""
Configurações da aplicação, carregadas a partir de variáveis de ambiente.

Uso:
    from app.config import settings
    print(settings.database_url)
"""
from functools import lru_cache
from pydantic_settings import BaseSettings, SettingsConfigDict


class Settings(BaseSettings):
    model_config = SettingsConfigDict(
        env_file=".env",
        env_file_encoding="utf-8",
        case_sensitive=False,
        extra="ignore",
    )

    # App
    app_env: str = "development"
    app_debug: bool = True

    # Infra
    database_url: str
    redis_url: str

    # Seats.aero
    seats_aero_api_key: str = ""
    seats_aero_base_url: str = "https://seats.aero/partnerapi"

    # Moblix
    moblix_username: str = ""
    moblix_password: str = ""
    moblix_base_url: str = "https://moblix-api.azurewebsites.net"


@lru_cache
def get_settings() -> Settings:
    """Singleton do Settings — evita reler o .env a cada request."""
    return Settings()


settings = get_settings()
