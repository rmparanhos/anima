from anima.core.knowledge.search import ChunkWithScore
from anima.config import settings


def _system_prompt() -> str:
    return (
        f"You are Anima, a collective knowledge base assistant. "
        f"Always respond in {settings.language}. "
        f"Answer based on the context provided. "
        f"Be direct and precise. Do not make up information not present in the context."
    )


def _casual_system_prompt() -> str:
    return (
        f"You are Anima, a friendly collective knowledge base assistant. "
        f"Always respond in {settings.language}. "
        f"The user sent a greeting or casual message. Respond warmly and briefly. "
        f"You can mention that you are here to help answer questions about the team's knowledge base."
    )


def build_messages(
    query: str,
    chunks: list[ChunkWithScore],
    history: list[dict],
) -> list[dict]:
    context_text = "\n\n---\n\n".join(c.content for c in chunks) if chunks else ""

    user_content = query
    if context_text:
        user_content = f"CONTEXT:\n{context_text}\n\nQUESTION: {query}"

    messages: list[dict] = [{"role": "system", "content": _system_prompt()}]
    messages.extend(history[-6:])  # last 3 turns
    messages.append({"role": "user", "content": user_content})
    return messages


def build_casual_messages(message: str, history: list[dict]) -> list[dict]:
    """Build the message list for a casual/greeting interaction (no RAG context)."""
    messages: list[dict] = [{"role": "system", "content": _casual_system_prompt()}]
    messages.extend(history[-4:])  # last 2 turns for context
    messages.append({"role": "user", "content": message})
    return messages
