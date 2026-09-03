import os
from typing import List, Optional
from pydantic_settings import BaseSettings, SettingsConfigDict

class Settings(BaseSettings):
    PROJECT_NAME: str = "SatQuery AI Backend"
    VERSION: str = "1.0.0"
    API_V1_STR: str = "/api/v1"
    SECRET_KEY: str = "satquery_secret_key_sih2026_isro_space_tech_987654321"
    ALGORITHM: str = "HS256"
    ACCESS_TOKEN_EXPIRE_MINUTES: int = 60 * 24 * 7  # 7 days

    # Database
    DATABASE_URL: str = "sqlite:///./satquery.db"
    
    # CORS
    BACKEND_CORS_ORIGINS: List[str] = [
        "http://localhost:5173",
        "http://localhost:3000",
        "http://127.0.0.1:5173",
        "http://127.0.0.1:3000",
        "*"
    ]

    # Model Serving & MLOps Configuration
    MODEL_NAME: str = "SatQuery-VLM-Sentinel-v1"
    MODEL_DEVICE: str = "cuda" if os.environ.get("CUDA_VISIBLE_DEVICES") else "cpu"
    ENABLE_REAL_MODEL: bool = False
    
    # Remote Sensing Datasets
    BIGEARTHNET_DIR: str = "./data/bigearthnet"
    VRSBENCH_DIR: str = "./data/vrsbench"

    # Phase 2 real NDVI / vegetation analysis
    # 'sample'    = bundled real Sentinel-2 cutout (offline, deterministic)
    # 'sentinel2' = live Earth Search STAC COG fetch (free, no key, needs network)
    IMAGERY_PROVIDER: str = "sample"
    SENTINEL2_LOOKBACK_DAYS: int = 120
    SENTINEL2_MAX_CLOUD_PERCENT: float = 60.0

    model_config = SettingsConfigDict(case_sensitive=True, env_file=".env", extra="allow")

settings = Settings()
