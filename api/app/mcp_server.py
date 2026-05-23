"""MCP server exposing Anima knowledge base to Claude Code and GitHub Copilot."""
import asyncio
import json
import sys
import os

sys.path.insert(0, os.path.dirname(os.path.dirname(__file__)))

try:
    from mcp.server import Server
    from mcp.server.stdio import stdio_server
    from mcp.types import Tool, TextContent
except ImportError:
    print("MCP package not installed. Run: pip install 'anima[mcp]'", file=sys.stderr)
    sys.exit(1)

from app.config import settings
from app.core.ai.embedder import embedder
from app.core.knowledge.search import semantic_search
from app.dependencies import AsyncSessionLocal
from app.services.question_service import create_pending_question
from app.models.user import User
from sqlalchemy import select

app_server = Server("anima")

MCP_USER_HANDLE = "mcp-bot"


async def _get_or_create_mcp_user():
    async with AsyncSessionLocal() as db:
        result = await db.execute(select(User).where(User.handle == MCP_USER_HANDLE))
        user = result.scalar_one_or_none()
        if not user:
            user = User(handle=MCP_USER_HANDLE)
            db.add(user)
            await db.commit()
            await db.refresh(user)
        return user.id


@app_server.list_tools()
async def list_tools() -> list[Tool]:
    return [
        Tool(
            name="search_knowledge",
            description="Search the Anima knowledge base using semantic search.",
            inputSchema={
                "type": "object",
                "properties": {
                    "query": {"type": "string", "description": "Question or term to search for"}
                },
                "required": ["query"],
            },
        ),
        Tool(
            name="ask_question",
            description=(
                "Ask Anima a question. Returns what it knows; "
                "if it doesn't know, registers the question as pending for the community to answer."
            ),
            inputSchema={
                "type": "object",
                "properties": {
                    "question": {"type": "string", "description": "Question to be answered"}
                },
                "required": ["question"],
            },
        ),
    ]


@app_server.call_tool()
async def call_tool(name: str, arguments: dict) -> list[TextContent]:
    if name == "search_knowledge":
        query = arguments["query"]
        embedding = await embedder.embed(query)
        chunks = await semantic_search(embedding)

        if not chunks:
            return [TextContent(type="text", text="No results found in the knowledge base.")]

        results = []
        for i, chunk in enumerate(chunks, 1):
            results.append(f"[{i}] (score: {chunk.score:.2f})\n{chunk.content}")

        return [TextContent(type="text", text="\n\n".join(results))]

    elif name == "ask_question":
        from app.core.ai.rag import build_messages
        from app.core.ai.claude import complete
        from app.core.ai.confidence import evaluate, INSUFFICIENT_MARKER

        question = arguments["question"]
        embedding = await embedder.embed(question)
        chunks = await semantic_search(embedding)

        messages = build_messages(question, chunks, [])
        response = await complete(messages)
        confidence = evaluate(chunks, response)

        if confidence.is_confident:
            return [TextContent(type="text", text=response)]

        user_id = await _get_or_create_mcp_user()
        async with AsyncSessionLocal() as db:
            q = await create_pending_question(question, user_id, None, embedding, db)

        return [TextContent(
            type="text",
            text=(
                f"I couldn't find this information in the knowledge base. "
                f"Your question has been registered (ID: {q.id}). "
                f"Visit /pending in Anima to view and answer it."
            ),
        )]

    return [TextContent(type="text", text=f"Tool '{name}' not found")]


async def main():
    async with stdio_server() as (read_stream, write_stream):
        await app_server.run(read_stream, write_stream, app_server.create_initialization_options())


if __name__ == "__main__":
    asyncio.run(main())
