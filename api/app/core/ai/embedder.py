from __future__ import annotations
from abc import ABC, abstractmethod
import asyncio
from functools import lru_cache


class EmbedderBase(ABC):
    @abstractmethod
    async def embed(self, text: str) -> list[float]: ...

    async def embed_batch(self, texts: list[str]) -> list[list[float]]:
        return [await self.embed(t) for t in texts]


class LocalEmbedder(EmbedderBase):
    """Embeddings locais via sentence-transformers. Sem API key, sem custo."""

    MODEL_NAME = "all-MiniLM-L6-v2"  # ~90MB, dimensão 384

    @lru_cache(maxsize=1)
    def _get_model(self):
        from sentence_transformers import SentenceTransformer
        return SentenceTransformer(self.MODEL_NAME)

    async def embed(self, text: str) -> list[float]:
        loop = asyncio.get_event_loop()
        model = self._get_model()
        vector = await loop.run_in_executor(None, lambda: model.encode(text, normalize_embeddings=True))
        return vector.tolist()

    async def embed_batch(self, texts: list[str]) -> list[list[float]]:
        loop = asyncio.get_event_loop()
        model = self._get_model()
        vectors = await loop.run_in_executor(None, lambda: model.encode(texts, normalize_embeddings=True))
        return [v.tolist() for v in vectors]


embedder: EmbedderBase = LocalEmbedder()
