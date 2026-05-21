from pydantic_settings import BaseSettings, SettingsConfigDict


class Settings(BaseSettings):
    model_config = SettingsConfigDict(env_file=".env", env_file_encoding="utf-8")

    anthropic_api_key: str
    database_url: str = "sqlite+aiosqlite:///./anima.db"
    chroma_path: str = "./chroma_db"

    rag_confidence_threshold: float = 0.72
    rag_top_k: int = 5
    question_dedup_threshold: float = 0.90

    claude_model: str = "claude-sonnet-4-6"
    # embeddings rodando localmente via sentence-transformers (all-MiniLM-L6-v2, dimensão 384)


settings = Settings()
