import asyncio
from abc import ABC, abstractmethod


class EmbedderBase(ABC):
    @abstractmethod
    async def embed(self, text: str) -> list[float]: ...

    async def embed_batch(self, texts: list[str]) -> list[list[float]]:
        return [await self.embed(t) for t in texts]


class LocalEmbedder(EmbedderBase):
    """Local embeddings via sentence-transformers. No API key, no cost."""

    MODEL_NAME = "all-MiniLM-L6-v2"  # ~90MB, 384 dimensions
    _model = None

    def _get_model(self):
        """Load model synchronously. MUST be called from a thread, never the event loop."""
        if self._model is None:
            from sentence_transformers import SentenceTransformer
            self._model = SentenceTransformer(self.MODEL_NAME)
        return self._model

    async def embed(self, text: str) -> list[float]:
        # Run everything in a thread: model load (first time) + encode
        def _run():
            return self._get_model().encode(text, normalize_embeddings=True)
        vector = await asyncio.to_thread(_run)
        return vector.tolist()

    async def embed_batch(self, texts: list[str]) -> list[list[float]]:
        def _run():
            return self._get_model().encode(texts, normalize_embeddings=True)
        vectors = await asyncio.to_thread(_run)
        return [v.tolist() for v in vectors]


embedder: EmbedderBase = LocalEmbedder()
