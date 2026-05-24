import logging
from fastapi import APIRouter, Depends, HTTPException, Query
from sqlalchemy.ext.asyncio import AsyncSession
from anima.dependencies import get_db
from anima.schemas.question import QuestionOut, AnswerSubmit, AnswerResponse, PendingQuestionsResponse
from anima.services import question_service
from anima.core.knowledge.ingestion import ingest_answer
from anima.models.question import Question
from anima.models.user import User

logger = logging.getLogger(__name__)

router = APIRouter(prefix="/questions", tags=["questions"])


@router.get("/pending", response_model=PendingQuestionsResponse)
async def list_pending(
    page: int = Query(1, ge=1),
    limit: int = Query(20, ge=1, le=100),
    db: AsyncSession = Depends(get_db),
):
    questions, total = await question_service.get_pending_questions(db, page, limit)
    return PendingQuestionsResponse(
        questions=[QuestionOut.model_validate(q) for q in questions],
        total=total,
    )


@router.get("/{question_id}", response_model=QuestionOut)
async def get_question(question_id: str, db: AsyncSession = Depends(get_db)):
    q = await db.get(Question, question_id)
    if not q:
        raise HTTPException(status_code=404, detail="Question not found")
    return q


@router.post("/{question_id}/answer", response_model=AnswerResponse)
async def answer_question(
    question_id: str,
    body: AnswerSubmit,
    db: AsyncSession = Depends(get_db),
):
    q = await db.get(Question, question_id)
    if not q:
        raise HTTPException(status_code=404, detail="Question not found")
    if q.status != "pending":
        raise HTTPException(status_code=409, detail="Question already answered or rejected")

    # Validate that the answering user exists
    user = await db.get(User, body.user_id)
    if not user:
        raise HTTPException(status_code=404, detail="User not found")

    # Lock the question immediately — prevents two simultaneous submissions from
    # both passing the status check above and both calling ingest_answer.
    q.answer_text = body.answer_text
    q.answered_by = body.user_id
    q.status = "answered"
    await db.commit()

    try:
        chunk = await ingest_answer(q, db)
    except Exception as exc:
        logger.error("Failed to ingest answer for question %s: %s", question_id, exc)
        # Revert so the question stays answerable rather than silently stuck.
        q.status = "pending"
        q.answer_text = None
        q.answered_by = None
        await db.commit()
        raise HTTPException(status_code=500, detail="Failed to process answer — please try again")

    await db.refresh(q)
    return AnswerResponse(question=QuestionOut.model_validate(q), knowledge_chunk_id=chunk.id)


@router.post("/{question_id}/vote")
async def vote_question(question_id: str, db: AsyncSession = Depends(get_db)):
    q = await db.get(Question, question_id)
    if not q:
        raise HTTPException(status_code=404, detail="Question not found")
    q.votes += 1
    await db.commit()
    return {"votes": q.votes}
