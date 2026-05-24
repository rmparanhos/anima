import uuid
import json
import logging
from datetime import datetime, timezone
from sqlalchemy.ext.asyncio import AsyncSession
from anima.models.knowledge_chunk import KnowledgeChunk
from anima.models.question import Question
from anima.core.ai.embedder import embedder
from anima.core.ai.claude import complete
from anima.core.ai.web_search import search_web
from anima.core.knowledge.search import add_chunk_async, remove_pending_question_async
from anima.config import settings

logger = logging.getLogger(__name__)


def _parse_meta(raw: str) -> tuple[str, str, str]:
    """Extract ENTITY, TITLE and TOPIC from the LLM's structured response."""
    entity, title, topic = "", "Knowledge Entry", "General"
    for line in raw.strip().splitlines():
        upper = line.upper()
        if upper.startswith("ENTITY:"):
            v = line[7:].strip().strip("\"'")
            if v:
                entity = v
        elif upper.startswith("TITLE:"):
            v = line[6:].strip().strip("\"'")
            if v:
                title = v
        elif upper.startswith("TOPIC:"):
            v = line[6:].strip().strip("\"'")
            if v:
                topic = v
    if not entity:
        entity = title
    return entity, title, topic


def _build_prose_user_message(question: Question, web_results: list[dict]) -> str:
    """Combine the Q&A pair with optional web snippets into a user message."""
    parts = [
        f"Question: {question.normalized_text}",
        f"Answer: {question.answer_text}",
    ]
    if web_results:
        snippets = "\n".join(
            f"- {r['title']}: {r['body']}"
            for r in web_results
            if r.get("title") or r.get("body")
        )
        if snippets:
            parts.append(f"\nAdditional context (web):\n{snippets}")
    return "\n\n".join(parts)


async def ingest_answer(question: Question, db: AsyncSession) -> KnowledgeChunk:
    lang = settings.language

    # Step 1 — optional web search to enrich the documentation
    web_results: list[dict] = []
    if settings.web_search_enabled:
        web_results = await search_web(question.normalized_text, max_results=3)
        if web_results:
            logger.info("Web search returned %d snippets for %r", len(web_results), question.normalized_text)
        else:
            logger.debug("Web search returned no results — continuing without enrichment")

    # Step 2 — narrative prose from Q&A + web context
    prose_system = (
        f"You are a technical writer. Write documentation in {lang}. "
        "Given a question, its answer, and optional web context, write clear, "
        "concise documentation. Prioritize the provided answer as the authoritative "
        "source. Use web context only to add relevant technical terms or background. "
        "Write in the third person, present tense. "
        "No bullet points — write flowing prose. 2-4 sentences max. "
        "CRITICAL: Never translate technical terms, product names, brand names, "
        "acronyms, system names, or domain jargon — keep them exactly as they appear "
        "in the question and answer. Only the surrounding prose should be in the target language."
    )
    content = await complete([
        {"role": "system", "content": prose_system},
        {"role": "user",   "content": _build_prose_user_message(question, web_results)},
    ])

    # Step 3 — entity + title + topic in a single LLM call
    raw_meta = await complete([
        {
            "role": "system",
            "content": (
                f"For the documentation text below, provide three items in {lang}.\n\n"
                "ENTITY: The specific product, feature, system, or named concept this text is about.\n"
                "  Use the exact name as it appears in the text — do NOT translate it.\n"
                "  Examples: 'Addin do Novo Pricing', 'Pipeline de Deploy', 'Auth Service', 'Relatório de Vendas'.\n"
                "TITLE: A section heading for this specific piece of information, 4-7 words.\n"
                "  Keep any technical terms or product names untranslated in the title.\n"
                "TOPIC: A broad category, 2-4 words, e.g. 'API Integration', 'Financeiro', 'Infraestrutura'.\n\n"
                "Respond EXACTLY in this format and nothing else:\n"
                "ENTITY: <entity name>\n"
                "TITLE: <title>\n"
                "TOPIC: <topic>"
            ),
        },
        {"role": "user", "content": content},
    ])
    entity, title, topic = _parse_meta(raw_meta)
    logger.info("Ingested chunk — entity=%r topic=%r title=%r web_enriched=%s",
                entity, topic, title, bool(web_results))

    embedding = await embedder.embed(content)
    chunk_id = str(uuid.uuid4())
    metadata = {
        "source_type":  "qa_answer",
        "question_id":  question.id,
        "entity":       entity,
        "title":        title,
        "topic":        topic,
        "web_enriched": bool(web_results),
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
