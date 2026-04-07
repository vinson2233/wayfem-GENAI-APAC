from pydantic_settings import BaseSettings
from typing import List
import json


class Settings(BaseSettings):
    GOOGLE_CLOUD_PROJECT: str
    GOOGLE_CLOUD_LOCATION: str = "us-central1"
    GOOGLE_APPLICATION_CREDENTIALS: str = ""
    GEMINI_API_KEY: str
    GOOGLE_MAPS_API_KEY: str
    GOOGLE_SEARCH_API_KEY: str = ""   # deprecated
    GOOGLE_SEARCH_CX: str = ""        # deprecated
    SERPAPI_KEY: str = ""             # deprecated
    SERPER_API_KEY: str = ""          # MCP Search server + direct fallback
    ENABLE_WEB_SEARCH: bool = True
    GOOGLE_CALENDAR_CREDENTIALS_JSON: str = ""
    CALENDAR_MCP_URL: str = "http://calendar-mcp:8003/mcp"
    FIRESTORE_COLLECTION_PREFIX: str = ""
    CORS_ORIGINS: List[str] = ["http://localhost:5173", "http://localhost:3000"]

    model_config = {"env_file": ".env", "env_file_encoding": "utf-8", "extra": "ignore"}

    @classmethod
    def _parse_cors(cls, v):
        if isinstance(v, str):
            try:
                return json.loads(v)
            except Exception:
                return [origin.strip() for origin in v.split(",")]
        return v


settings = Settings()
