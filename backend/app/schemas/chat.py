from pydantic import BaseModel
from datetime import datetime


class ChatMessageRequest(BaseModel):
    content: str
    user_id: str
    conversation_id: str | None = None


class ChatMessageResponse(BaseModel):
    message_id: str
    conversation_id: str
    content: str
    confidence_score: float | None = None
    status: str  # answered | pending
    question_id: str | None = None


class MessageOut(BaseModel):
    id: str
    role: str
    content: str
    created_at: datetime
    confidence_score: float | None = None

    model_config = {"from_attributes": True}


class ConversationHistory(BaseModel):
    conversation_id: str
    messages: list[MessageOut]
