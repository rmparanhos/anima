import uuid
import json
from datetime import datetime, timezone
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select
from app.models.knowledge_chunk import KnowledgeChunk
from app.models.question import Question
from app.core.ai.embedder import embedder
from app.core.knowledge.search import add_chunk, remove_pending_question


async def ingest_answer(question: Question, db: AsyncSession) -> KnowledgeChunk:
    content = f"Pergunta: {question.normalized_text}\nResposta: {question.answer_text}"
    embedding = await embedder.embed(content)

    chunk_id = str(uuid.uuid4())
    metadata = {"source_type": "qa_answer", "question_id": question.id}

    add_chunk(chunk_id, content, embedding, metadata)
    remove_pending_question(question.id)

    chunk = KnowledgeChunk(
        id=chunk_id,
        content=content,
        source_type="qa_answer",
        source_id=question.id,
        metadata_json=json.dumps(metadata),
    )
    db.add(chunk)

    question.knowledge_chunk_id = chunk_id
    question.status = "answered"
    question.answered_at = datetime.now(timezone.utc)

    await db.commit()
    await db.refresh(chunk)
    return chunk
