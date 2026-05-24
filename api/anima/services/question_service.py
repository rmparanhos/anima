import logging
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select, func
from anima.models.question import Question, QuestionDuplicate
from anima.core.knowledge.search import search_pending_questions, add_pending_question_async
from anima.config import settings

logger = logging.getLogger(__name__)


async def create_pending_question(
    text: str,
    user_id: str,
    message_id: str | None,
    query_embedding: list[float],
    db: AsyncSession,
) -> Question:
    normalized = text.strip().lower()

    existing_pending = await _get_pending_ids(db)
    similar = await search_pending_questions(query_embedding, existing_pending)

    for candidate in similar:
        if candidate.score >= settings.question_dedup_threshold:
            canonical = await db.get(Question, candidate.id)
            if canonical:
                # Create a Question record for this duplicate so we can reference it in
                # QuestionDuplicate.duplicate_id (requires a real FK target).
                dup_question = Question(
                    asked_by=user_id,
                    original_message_id=message_id,
                    normalized_text=normalized,
                    status="rejected",  # duplicate — never goes to pending queue
                )
                db.add(dup_question)
                await db.flush()  # assign dup_question.id

                canonical.votes += 1
                dup_record = QuestionDuplicate(
                    canonical_id=canonical.id,
                    duplicate_id=dup_question.id,  # was incorrectly canonical.id
                    similarity=candidate.score,
                )
                db.add(dup_record)
                await db.commit()
                await db.refresh(canonical)

                logger.info(
                    "Duplicate question detected (score=%.3f): %s → canonical %s",
                    candidate.score, dup_question.id, canonical.id,
                )
                return canonical

    question = Question(
        asked_by=user_id,
        original_message_id=message_id,
        normalized_text=normalized,
    )
    db.add(question)
    await db.flush()

    await add_pending_question_async(question.id, normalized, query_embedding)
    await db.commit()
    await db.refresh(question)
    return question


async def get_pending_questions(db: AsyncSession, page: int = 1, limit: int = 20) -> tuple[list[Question], int]:
    offset = (page - 1) * limit
    result = await db.execute(
        select(Question)
        .where(Question.status == "pending")
        .order_by(Question.votes.desc(), Question.created_at.desc())
        .offset(offset)
        .limit(limit)
    )
    questions = list(result.scalars().all())

    total_result = await db.execute(
        select(func.count()).select_from(Question).where(Question.status == "pending")
    )
    total = total_result.scalar_one()

    return questions, total


async def _get_pending_ids(db: AsyncSession) -> list[str]:
    result = await db.execute(select(Question.id).where(Question.status == "pending"))
    return [row[0] for row in result.all()]
