from __future__ import annotations
from typing import Optional, List
from pydantic import BaseModel
from datetime import datetime


class QuestionOut(BaseModel):
    id: str
    normalized_text: str
    status: str
    votes: int
    created_at: datetime
    answer_text: Optional[str] = None
    answered_at: Optional[datetime] = None

    model_config = {"from_attributes": True}


class AnswerSubmit(BaseModel):
    answer_text: str
    user_id: str


class AnswerResponse(BaseModel):
    question: QuestionOut
    knowledge_chunk_id: str


class PendingQuestionsResponse(BaseModel):
    questions: List[QuestionOut]
    total: int
