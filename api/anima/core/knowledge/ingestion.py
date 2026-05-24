import uuid
import json
import logging
from datetime import datetime, timezone
from sqlalchemy.ext.asyncio import AsyncSession
from anima.models.knowledge_chunk import KnowledgeChunk
from anima.models.question import Question
from anima.core.ai.embedder import embedder
from anima.core.ai.claude import complete
from anima.core.knowledge.search import add_chunk_async, remove_pending_question_async
from anima.config import settings

logger = logging.getLogger(__name__)


def _parse_meta(raw: str) -> tuple[str, str]:
    """Extract TITLE and TOPIC from the LLM's structured response."""
    title, topic = "Knowledge Entry", "General"
    for line in raw.strip().splitlines():
        upper = line.upper()
        if upper.startswith("TITLE:"):
            v = line[6:].strip().strip("\"'")
            if v:
                title = v
        elif upper.startswith("TOPIC:"):
            v = line[6:].strip().strip("\"'")
            if v:
                topic = v
    return title, topic


async def ingest_answer(question: Question, db: AsyncSession) -> KnowledgeChunk:
    lang = settings.language

    # Step 1 — narrative prose from the Q&A pair
    content = await complete([
        {
            "role": "system",
            "content": (
                f"You are a technical writer. Write documentation in {lang}. "
                "Given a question and its answer, write clear, concise documentation. "
                "Write in the third person, present tense. "
                "No bullet points — write flowing prose. 2-4 sentences max."
            ),
        },
        {
            "role": "user",
            "content": f"Question: {question.normalized_text}\n\nAnswer: {question.answer_text}",
        },
    ])

    # Step 2 — title + topic in a single LLM call (saves one round-trip)
    raw_meta = await complete([
        {
            "role": "system",
            "content": (
                f"For the documentation text below, provide two items in {lang}.\n\n"
                "TITLE: A section heading, 4-7 words, like a chapter title in a technical manual.\n"
                "TOPIC: A broad category, 2-4 words, e.g. 'API Integration', 'Authentication', 'Data Processing'.\n\n"
                "Respond EXACTLY in this format and nothing else:\n"
                "TITLE: <title>\n"
                "TOPIC: <topic>"
            ),
        },
        {"role": "user", "content": content},
    ])
    title, topic = _parse_meta(raw_meta)
    logger.info("Ingested chunk — topic=%r title=%r", topic, title)

    embedding = await embedder.embed(content)
    chunk_id = str(uuid.uuid4())
    metadata = {
        "source_type": "qa_answer",
        "question_id": question.id,
        "title": title,
        "topic": topic,
    }

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
