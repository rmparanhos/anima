from dataclasses import dataclass
from anima.core.knowledge.search import ChunkWithScore
from anima.config import settings

# Kept for backward compatibility — no longer used in evaluate().
# Small local models (qwen2.5:3b/7b) don't reliably produce this marker:
# they either ignore it and hallucinate, or emit it even when context is good.
INSUFFICIENT_MARKER = "[INSUFFICIENT_CONTEXT]"


@dataclass
class ConfidenceResult:
    score: float
    is_confident: bool
    chunks_used: list[ChunkWithScore]


def evaluate(chunks: list[ChunkWithScore]) -> ConfidenceResult:
    """Confidence is based solely on the vector similarity score.

    The LLM self-check (INSUFFICIENT_MARKER) was removed because small local
    models don't follow that instruction reliably — leading to every question
    being routed to pending even when good context exists.
    """
    if not chunks:
        return ConfidenceResult(score=0.0, is_confident=False, chunks_used=[])

    max_score = max(c.score for c in chunks)
    return ConfidenceResult(
        score=max_score,
        is_confident=max_score >= settings.rag_confidence_threshold,
        chunks_used=chunks,
    )
