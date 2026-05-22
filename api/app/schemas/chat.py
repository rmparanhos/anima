from __future__ import annotations
from typing import Optional, List
from pydantic import BaseModel
from datetime import datetime


class ChatMessageRequest(BaseModel):
    content: str
    user_id: str
    conversation_id: Optional[str] = None


class ChatMessageResponse(BaseModel):
    message_id: str
    conversation_id: str
    content: str
    confidence_score: Optional[float] = None
    status: str  # answered | pending
    question_id: Optional[str] = None


class MessageOut(BaseModel):
    id: str
    role: str
    content: str
    created_at: datetime
    confidence_score: Optional[float] = None

    model_config = {"from_attributes": True}


class ConversationHistory(BaseModel):
    conversation_id: str
    messages: List[MessageOut]
