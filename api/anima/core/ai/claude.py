import logging
from collections.abc import AsyncGenerator
from openai import AsyncOpenAI
from anima.config import settings

logger = logging.getLogger(__name__)

_client = AsyncOpenAI(
    base_url=settings.ollama_base_url,
    api_key="ollama",  # Ollama doesn't require a key; the SDK requires a non-empty value
)


def _build_messages(messages: list[dict]) -> list[dict]:
    """Normalise the message list: ensure system prompt is always first."""
    system = next((m["content"] for m in messages if m["role"] == "system"), None)
    rest = [m for m in messages if m["role"] != "system"]
    return ([{"role": "system", "content": system}] if system else []) + rest


async def complete(messages: list[dict]) -> str:
    """Non-streaming LLM call.  Raises on network/API errors."""
    built = _build_messages(messages)
    try:
        response = await _client.chat.completions.create(
            model=settings.ollama_model,
            messages=built,
            max_tokens=2048,
        )
        return response.choices[0].message.content or ""
    except Exception as exc:
        logger.error("LLM completion error (model=%s): %s", settings.ollama_model, exc)
        raise


async def stream_complete(messages: list[dict]) -> AsyncGenerator[str, None]:
    """Streaming LLM call.  Raises on network/API errors."""
    built = _build_messages(messages)
    try:
        stream = await _client.chat.completions.create(
            model=settings.ollama_model,
            messages=built,
            max_tokens=2048,
            stream=True,
        )
        async for chunk in stream:
            delta = chunk.choices[0].delta.content
            if delta:
                yield delta
    except Exception as exc:
        logger.error("LLM stream error (model=%s): %s", settings.ollama_model, exc)
        raise
