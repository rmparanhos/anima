from pydantic import AliasChoices, Field
from pydantic_settings import BaseSettings, SettingsConfigDict


class Settings(BaseSettings):
    model_config = SettingsConfigDict(env_file=".env", env_file_encoding="utf-8")

    database_url: str = "sqlite+aiosqlite:///./anima.db"
    chroma_path: str = "./chroma_db"

    # Ollama — runs locally, no API key needed
    ollama_base_url: str = "http://localhost:11434/v1"
    ollama_model: str = "qwen2.5:7b"

    # Language for all AI-generated content (docs titles, topics, answers).
    # Set ANIMA_LANGUAGE in .env — e.g. "Portuguese", "English", "Spanish"
    # AliasChoices accepts both ANIMA_LANGUAGE (preferred) and LANGUAGE (fallback)
    language: str = Field(
        default="English",
        validation_alias=AliasChoices("ANIMA_LANGUAGE", "LANGUAGE"),
    )

    # RAG — threshold lowered from 0.72; all-MiniLM-L6-v2 cosine similarity
    # for semantically related sentences typically falls between 0.50–0.70,
    # so 0.72 caused the system to always say it didn't know.
    rag_confidence_threshold: float = 0.60
    rag_top_k: int = 5
    question_dedup_threshold: float = 0.90

    # Web search — enriches generated documentation with public web context.
    # Provider priority: Brave (if BRAVE_API_KEY set) → ddgs (no key needed).
    # Set WEB_SEARCH_ENABLED=false to disable entirely.
    # Brave free tier: 2 000 queries/month — https://brave.com/search/api/
    web_search_enabled: bool = True
    brave_api_key: str = ""


settings = Settings()
