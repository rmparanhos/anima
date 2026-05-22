from collections.abc import AsyncGenerator
from openai import AsyncOpenAI
from app.config import settings

_client = AsyncOpenAI(
    base_url=settings.ollama_base_url,
    api_key="ollama",  # Ollama não requer key, mas o SDK exige um valor qualquer
)


async def complete(messages: list[dict]) -> str:
    system = next((m["content"] for m in messages if m["role"] == "system"), None)
    user_messages = [m for m in messages if m["role"] != "system"]

    kwargs: dict = {
        "model": settings.ollama_model,
        "messages": user_messages,
        "max_tokens": 2048,
    }
    if system:
        kwargs["messages"] = [{"role": "system", "content": system}] + user_messages

    response = await _client.chat.completions.create(**kwargs)
    return response.choices[0].message.content or ""


async def stream_complete(messages: list[dict]) -> AsyncGenerator[str, None]:
    system = next((m["content"] for m in messages if m["role"] == "system"), None)
    user_messages = [m for m in messages if m["role"] != "system"]

    all_messages = ([{"role": "system", "content": system}] if system else []) + user_messages

    stream = await _client.chat.completions.create(
        model=settings.ollama_model,
        messages=all_messages,
        max_tokens=2048,
        stream=True,
    )
    async for chunk in stream:
        delta = chunk.choices[0].delta.content
        if delta:
            yield delta
