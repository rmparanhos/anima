import json
from fastapi import APIRouter, Depends, HTTPException, Query
from sqlalchemy.ext.asyncio import AsyncSession
from pydantic import BaseModel
from datetime import datetime
from anima.dependencies import get_db
from anima.services.knowledge_service import get_all_chunks, get_knowledge_graph, update_chunk, _extract_meta

router = APIRouter(prefix="/knowledge", tags=["knowledge"])


class ChunkOut(BaseModel):
    id: str
    entity: str
    title: str
    topic: str
    content: str
    source_type: str
    source_id: str | None
    created_at: datetime


class KnowledgeResponse(BaseModel):
    chunks: list[ChunkOut]
    total: int


class ChunkPreview(BaseModel):
    id: str
    title: str
    content: str


class GraphNode(BaseModel):
    id: str
    entity: str
    topic: str
    chunk_count: int
    chunks: list[ChunkPreview]
    content: str  # short preview for tooltip


class GraphLink(BaseModel):
    source: str
    target: str
    value: float


class GraphResponse(BaseModel):
    nodes: list[GraphNode]
    links: list[GraphLink]


class ChunkUpdate(BaseModel):
    content: str
    title: str
    entity: str


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
                entity=_extract_meta(c)[0],
                title=_extract_meta(c)[1],
                topic=_extract_meta(c)[2],
                content=c.content,
                source_type=c.source_type,
                source_id=c.source_id,
                created_at=c.created_at,
            )
            for c in chunks
        ],
        total=total,
    )


@router.patch("/{chunk_id}", response_model=ChunkOut)
async def patch_chunk(
    chunk_id: str,
    body: ChunkUpdate,
    db: AsyncSession = Depends(get_db),
):
    """Update a knowledge chunk's content, title and entity (re-embeds in ChromaDB)."""
    try:
        c = await update_chunk(db, chunk_id, body.content, body.title, body.entity)
    except ValueError as exc:
        raise HTTPException(status_code=404, detail=str(exc))
    return ChunkOut(
        id=c.id,
        entity=_extract_meta(c)[0],
        title=_extract_meta(c)[1],
        topic=_extract_meta(c)[2],
        content=c.content,
        source_type=c.source_type,
        source_id=c.source_id,
        created_at=c.created_at,
    )


@router.get("/graph", response_model=GraphResponse)
async def knowledge_graph(db: AsyncSession = Depends(get_db)):
    """Return entity nodes + links for the force-directed knowledge graph.

    Nodes are entities (products, features, systems). Each entity carries all
    its associated chunks so the detail panel can list them without an extra request.
    Edges connect entities whose embedding centroids exceed the similarity threshold.
    """
    data = await get_knowledge_graph(db)
    return GraphResponse(
        nodes=[GraphNode(**n) for n in data["nodes"]],
        links=[GraphLink(**l) for l in data["links"]],
    )
