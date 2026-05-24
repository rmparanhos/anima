import json
import logging
from datetime import datetime, timezone
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select
from anima.models.conversation import Conversation
from anima.models.message import Message
from anima.core.ai.embedder import embedder
from anima.core.knowledge.search import semantic_search
from anima.core.ai.rag import build_messages
from anima.core.ai.claude import complete
from anima.core.ai.confidence import evaluate
from anima.services.question_service import create_pending_question
from anima.config import settings

logger = logging.getLogger(__name__)

_NOT_FOUND: dict[str, str] = {
    "portuguese": (
        "Não encontrei essa informação na base de conhecimento. "
        "Sua pergunta foi registrada — qualquer pessoa pode respondê-la em /pending."
    ),
    "english": (
        "I couldn't find this information in the knowledge base. "
        "Your question has been registered — anyone can answer it at /pending."
    ),
    "spanish": (
        "No encontré esta información en la base de conocimiento. "
        "Tu pregunta fue registrada — cualquiera puede responderla en /pending."
    ),
}


def _not_found_msg() -> str:
    key = settings.language.lower()
    # Fuzzy match: "Portuguese" → "portuguese", "pt-BR" → "portuguese" (first word)
    for lang in _NOT_FOUND:
        if lang in key:
            return _NOT_FOUND[lang]
    return _NOT_FOUND["english"]


async def process_message(
    content: str,
    user_id: str,
    conversation_id: str | None,
    db: AsyncSession,
) -> dict:
    if conversation_id:
        conv = await db.get(Conversation, conversation_id)
        if not conv:
            raise ValueError(f"Conversation {conversation_id!r} not found")
    else:
        conv = Conversation(user_id=user_id)
        db.add(conv)
        await db.flush()

    user_msg = Message(conversation_id=conv.id, role="user", content=content)
    db.add(user_msg)
    await db.flush()

    query_embedding = await embedder.embed(content)
    chunks = await semantic_search(query_embedding)

    # Check vector confidence BEFORE calling the LLM.
    # If no good chunks exist, skip the LLM call entirely and queue the question.
    confidence = evaluate(chunks)

    question_id = None
    final_content: str

    if confidence.is_confident:
        history = await _load_history(conv.id, db)
        messages = build_messages(content, chunks, history)
        try:
            final_content = await complete(messages)
        except Exception as exc:
            logger.error("LLM call failed: %s", exc)
            # Treat LLM failure the same as no knowledge
            confidence.is_confident = False
            final_content = _not_found_msg()
            question = await create_pending_question(content, user_id, user_msg.id, query_embedding, db)
            question_id = question.id
    else:
        final_content = _not_found_msg()
        question = await create_pending_question(content, user_id, user_msg.id, query_embedding, db)
        question_id = question.id

    assistant_msg = Message(
        conversation_id=conv.id,
        role="assistant",
        content=final_content,
        rag_chunks_used=json.dumps([c.id for c in chunks]),
        confidence_score=confidence.score,
        triggered_question_id=question_id,
    )
    db.add(assistant_msg)

    conv.last_active_at = datetime.now(timezone.utc)
    await db.commit()
    await db.refresh(assistant_msg)

    return {
        "message_id": assistant_msg.id,
        "conversation_id": conv.id,
        "content": final_content,
        "confidence_score": confidence.score,
        "status": "answered" if confidence.is_confident else "pending",
        "question_id": question_id,
    }


async def get_history(conversation_id: str, db: AsyncSession) -> list[Message]:
    result = await db.execute(
        select(Message).where(Message.conversation_id == conversation_id).order_by(Message.created_at)
    )
    return list(result.scalars().all())


async def _load_history(conversation_id: str, db: AsyncSession) -> list[dict]:
    messages = await get_history(conversation_id, db)
    return [{"role": m.role, "content": m.content} for m in messages if m.role in ("user", "assistant")]
