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
    topic: str
    content: str
    source_type: str
    source_id: str | None
    created_at: datetime


class KnowledgeResponse(BaseModel):
    chunks: list[ChunkOut]
    total: int


def _extract_meta(chunk) -> tuple[str, str]:
    """Extract (title, topic) from metadata_json with graceful fallbacks."""
    try:
        meta = json.loads(chunk.metadata_json or "{}")
        title = meta.get("title") or ""
        topic = meta.get("topic") or ""
    except Exception:
        title, topic = "", ""

    if not title:
        words = chunk.content.split()
        title = " ".join(words[:6]) + ("…" if len(words) > 6 else "")
    if not topic:
        topic = "General"

    return title, topic


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
                title=_extract_meta(c)[0],
                topic=_extract_meta(c)[1],
                content=c.content,
                source_type=c.source_type,
                source_id=c.source_id,
                created_at=c.created_at,
            )
            for c in chunks
        ],
        total=total,
    )
