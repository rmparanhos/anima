from fastapi import APIRouter, Depends, Query
from sqlalchemy.ext.asyncio import AsyncSession
from pydantic import BaseModel
from datetime import datetime
from app.dependencies import get_db
from app.services.knowledge_service import get_all_chunks

router = APIRouter(prefix="/knowledge", tags=["knowledge"])


class ChunkOut(BaseModel):
    id: str
    content: str
    source_type: str
    source_id: str | None
    created_at: datetime

    model_config = {"from_attributes": True}


class KnowledgeResponse(BaseModel):
    chunks: list[ChunkOut]
    total: int


@router.get("", response_model=KnowledgeResponse)
async def list_knowledge(
    page: int = Query(1, ge=1),
    limit: int = Query(50, ge=1, le=200),
    db: AsyncSession = Depends(get_db),
):
    chunks, total = await get_all_chunks(db, page, limit)
    return KnowledgeResponse(chunks=[ChunkOut.model_validate(c) for c in chunks], total=total)
