import json
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select
from anima.models.knowledge_chunk import KnowledgeChunk


async def get_all_chunks(db: AsyncSession, page: int = 1, limit: int = 50) -> tuple[list[KnowledgeChunk], int]:
    from sqlalchemy import func
    offset = (page - 1) * limit
    result = await db.execute(
        select(KnowledgeChunk)
        .where(KnowledgeChunk.is_active == True)
        .order_by(KnowledgeChunk.created_at.desc())
        .offset(offset)
        .limit(limit)
    )
    chunks = list(result.scalars().all())

    total_result = await db.execute(
        select(func.count()).select_from(KnowledgeChunk).where(KnowledgeChunk.is_active == True)
    )
    total = total_result.scalar_one()
    return chunks, total
