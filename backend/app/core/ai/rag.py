from app.core.knowledge.search import ChunkWithScore
from app.core.ai.confidence import INSUFFICIENT_MARKER

SYSTEM_PROMPT = f"""Você é Anima, um assistente de base de conhecimento coletiva.
Responda APENAS com base no contexto fornecido abaixo.
Se o contexto não for suficiente ou não existir, responda exatamente: {INSUFFICIENT_MARKER}
Seja direto e preciso. Não invente informações."""


def build_messages(
    query: str,
    chunks: list[ChunkWithScore],
    history: list[dict],
) -> list[dict]:
    context_text = "\n\n---\n\n".join(c.content for c in chunks) if chunks else ""

    user_content = query
    if context_text:
        user_content = f"CONTEXTO:\n{context_text}\n\nPERGUNTA: {query}"

    messages: list[dict] = [{"role": "system", "content": SYSTEM_PROMPT}]
    messages.extend(history[-6:])  # last 3 turns
    messages.append({"role": "user", "content": user_content})
    return messages
