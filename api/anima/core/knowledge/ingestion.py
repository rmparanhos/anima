import uuid
import json
from datetime import datetime, timezone
from sqlalchemy.ext.asyncio import AsyncSession
from anima.models.knowledge_chunk import KnowledgeChunk
from anima.models.question import Question
from anima.core.ai.embedder import embedder
from anima.core.ai.claude import complete
from anima.core.knowledge.search import add_chunk_async, remove_pending_question_async


async def ingest_answer(question: Question, db: AsyncSession) -> KnowledgeChunk:
    messages = [
        {
            "role": "system",
            "content": (
                "You are a technical writer. Given a question and its answer, write clear, "
                "concise documentation in plain English. Write in the third person, present tense. "
                "No bullet points — write flowing prose. 2-4 sentences max."
            ),
        },
        {
            "role": "user",
            "content": f"Question: {question.normalized_text}\n\nAnswer: {question.answer_text}",
        },
    ]
    content = await complete(messages)

    embedding = await embedder.embed(content)

    chunk_id = str(uuid.uuid4())
    metadata = {"source_type": "qa_answer", "question_id": question.id}

    await add_chunk_async(chunk_id, content, embedding, metadata)
    await remove_pending_question_async(question.id)

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
