from collections.abc import AsyncGenerator
import anthropic
from app.config import settings

_client = anthropic.AsyncAnthropic(api_key=settings.anthropic_api_key)


async def complete(messages: list[dict]) -> str:
    system = next((m["content"] for m in messages if m["role"] == "system"), None)
    user_messages = [m for m in messages if m["role"] != "system"]

    kwargs: dict = {"model": settings.claude_model, "max_tokens": 2048, "messages": user_messages}
    if system:
        kwargs["system"] = system

    response = await _client.messages.create(**kwargs)
    return response.content[0].text


async def stream_complete(messages: list[dict]) -> AsyncGenerator[str, None]:
    system = next((m["content"] for m in messages if m["role"] == "system"), None)
    user_messages = [m for m in messages if m["role"] != "system"]

    kwargs: dict = {"model": settings.claude_model, "max_tokens": 2048, "messages": user_messages}
    if system:
        kwargs["system"] = system

    async with _client.messages.stream(**kwargs) as stream:
        async for text in stream.text_stream:
            yield text
