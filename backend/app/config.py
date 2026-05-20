from pydantic_settings import BaseSettings, SettingsConfigDict


class Settings(BaseSettings):
    model_config = SettingsConfigDict(env_file=".env", env_file_encoding="utf-8")

    anthropic_api_key: str
    openai_api_key: str
    database_url: str = "sqlite+aiosqlite:///./anima.db"
    chroma_path: str = "./chroma_db"

    rag_confidence_threshold: float = 0.72
    rag_top_k: int = 5
    question_dedup_threshold: float = 0.90

    claude_model: str = "claude-sonnet-4-6"
    embedding_model: str = "text-embedding-3-small"
    embedding_dimensions: int = 1536


settings = Settings()
