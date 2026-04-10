from pydantic_settings import BaseSettings, SettingsConfigDict


class Settings(BaseSettings):
    model_config = SettingsConfigDict(env_file=".env", extra="ignore")

    seats_aero_api_key: str = ""
    seats_aero_base_url: str = "https://seats.aero/partnerapi"
    app_debug: bool = False

    database_url: str = ""
    supabase_url: str = ""
    supabase_jwt_secret: str = ""
    supabase_service_key: str = ""

    upstash_redis_rest_url: str = ""
    upstash_redis_rest_token: str = ""

    cron_secret: str = ""


settings = Settings()
