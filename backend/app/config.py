from pydantic_settings import BaseSettings, SettingsConfigDict


class Settings(BaseSettings):
    model_config = SettingsConfigDict(env_file=".env", env_file_encoding="utf-8")

    database_url: str = "sqlite+aiosqlite:///./anima.db"
    chroma_path: str = "./chroma_db"

    # Ollama — roda localmente, sem API key
    # 16GB RAM → llama3.1:8b  |  8GB RAM → phi3:mini ou llama3.2:3b
    ollama_base_url: str = "http://localhost:11434/v1"
    ollama_model: str = "qwen2.5:7b"

    rag_confidence_threshold: float = 0.72
    rag_top_k: int = 5
    question_dedup_threshold: float = 0.90
    # embeddings: sentence-transformers local (all-MiniLM-L6-v2, ~90MB)


settings = Settings()
