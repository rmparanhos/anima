from __future__ import annotations
from dataclasses import dataclass
from app.core.knowledge.search import ChunkWithScore
from app.config import settings

INSUFFICIENT_MARKER = "[INSUFFICIENT_CONTEXT]"


@dataclass
class ConfidenceResult:
    score: float
    is_confident: bool
    chunks_used: list[ChunkWithScore]


def evaluate(chunks: list[ChunkWithScore], llm_response: str) -> ConfidenceResult:
    if not chunks:
        return ConfidenceResult(score=0.0, is_confident=False, chunks_used=[])

    max_score = max(c.score for c in chunks)
    vector_confident = max_score >= settings.rag_confidence_threshold
    llm_confident = INSUFFICIENT_MARKER not in llm_response

    return ConfidenceResult(
        score=max_score,
        is_confident=vector_confident and llm_confident,
        chunks_used=chunks,
    )
