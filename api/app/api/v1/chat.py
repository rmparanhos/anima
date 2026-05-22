from __future__ import annotations
from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.ext.asyncio import AsyncSession
from app.dependencies import get_db
from app.schemas.chat import ChatMessageRequest, ChatMessageResponse, ConversationHistory, MessageOut
from app.services import chat_service

router = APIRouter(prefix="/chat", tags=["chat"])


@router.post("/message", response_model=ChatMessageResponse)
async def send_message(body: ChatMessageRequest, db: AsyncSession = Depends(get_db)):
    result = await chat_service.process_message(
        content=body.content,
        user_id=body.user_id,
        conversation_id=body.conversation_id,
        db=db,
    )
    return result


@router.get("/{conversation_id}/history", response_model=ConversationHistory)
async def get_history(conversation_id: str, db: AsyncSession = Depends(get_db)):
    messages = await chat_service.get_history(conversation_id, db)
    return ConversationHistory(
        conversation_id=conversation_id,
        messages=[MessageOut.model_validate(m) for m in messages],
    )
