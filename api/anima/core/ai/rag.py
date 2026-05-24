from anima.core.knowledge.search import ChunkWithScore
from anima.core.ai.confidence import INSUFFICIENT_MARKER

SYSTEM_PROMPT = f"""You are Anima, a collective knowledge base assistant.
Answer ONLY based on the context provided below.
If the context is insufficient or missing, respond exactly: {INSUFFICIENT_MARKER}
Be direct and precise. Do not make up information."""


def build_messages(
    query: str,
    chunks: list[ChunkWithScore],
    history: list[dict],
) -> list[dict]:
    context_text = "\n\n---\n\n".join(c.content for c in chunks) if chunks else ""

    user_content = query
    if context_text:
        user_content = f"CONTEXT:\n{context_text}\n\nQUESTION: {query}"

    messages: list[dict] = [{"role": "system", "content": SYSTEM_PROMPT}]
    messages.extend(history[-6:])  # last 3 turns
    messages.append({"role": "user", "content": user_content})
    return messages
