import json
from fastapi import APIRouter, Depends, Query
from sqlalchemy.ext.asyncio import AsyncSession
from pydantic import BaseModel
from datetime import datetime
from anima.dependencies import get_db
from anima.services.knowledge_service import get_all_chunks

router = APIRouter(prefix="/knowledge", tags=["knowledge"])


class ChunkOut(BaseModel):
    id: str
    title: str
    content: str
    source_type: str
    source_id: str | None
    created_at: datetime


class KnowledgeResponse(BaseModel):
    chunks: list[ChunkOut]
    total: int


def _extract_title(chunk) -> str:
    """Extract title from metadata_json; fall back to first words of content."""
    try:
        meta = json.loads(chunk.metadata_json or "{}")
        if meta.get("title"):
            return meta["title"]
    except Exception:
        pass
    # Fallback: first 6 words of content (for chunks ingested before this change)
    words = chunk.content.split()
    return " ".join(words[:6]) + ("…" if len(words) > 6 else "")


@router.get("", response_model=KnowledgeResponse)
async def list_knowledge(
    page: int = Query(1, ge=1),
    limit: int = Query(50, ge=1, le=200),
    db: AsyncSession = Depends(get_db),
):
    chunks, total = await get_all_chunks(db, page, limit)
    return KnowledgeResponse(
        chunks=[
            ChunkOut(
                id=c.id,
                title=_extract_title(c),
                content=c.content,
                source_type=c.source_type,
                source_id=c.source_id,
                created_at=c.created_at,
            )
            for c in chunks
        ],
        total=total,
    )
