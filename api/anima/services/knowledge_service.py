import asyncio
import json
import numpy as np
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select, func
from anima.models.knowledge_chunk import KnowledgeChunk

GRAPH_EDGE_THRESHOLD = 0.42  # cosine similarity above which two chunks are "related"


async def get_all_chunks(db: AsyncSession, page: int = 1, limit: int = 50) -> tuple[list[KnowledgeChunk], int]:
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


async def get_knowledge_graph(db: AsyncSession) -> dict:
    """Build a knowledge graph from stored chunks and their ChromaDB embeddings.

    Nodes  = knowledge chunks (title, topic, short content preview)
    Edges  = pairs whose cosine similarity exceeds GRAPH_EDGE_THRESHOLD —
             semantically related concepts naturally cluster together via the
             force-directed layout in the frontend.
    """
    chunks, _ = await get_all_chunks(db, page=1, limit=500)
    if not chunks:
        return {"nodes": [], "links": []}

    chunk_ids = [c.id for c in chunks]

    # Fetch embeddings from ChromaDB (blocking I/O → thread)
    def _fetch_embeddings():
        from anima.core.knowledge.search import _get_collection
        coll = _get_collection()
        return coll.get(ids=chunk_ids, include=["embeddings"])

    result = await asyncio.to_thread(_fetch_embeddings)

    present_ids: list[str] = result["ids"]
    embeddings_raw: list[list[float]] = result["embeddings"]

    if not present_ids:
        return {"nodes": [], "links": []}

    # Build a quick lookup so we can skip chunks missing from ChromaDB
    chunk_by_id = {c.id: c for c in chunks}
    present_set = set(present_ids)

    nodes = []
    for cid, emb in zip(present_ids, embeddings_raw):
        c = chunk_by_id.get(cid)
        if not c:
            continue
        meta = {}
        try:
            meta = json.loads(c.metadata_json or "{}")
        except Exception:
            pass
        nodes.append({
            "id": cid,
            "title": meta.get("title") or c.content[:50],
            "topic": meta.get("topic") or "General",
            "content": c.content[:300],
        })

    if len(nodes) < 2:
        return {"nodes": nodes, "links": []}

    # Cosine similarity matrix (numpy, fast even for 500×500)
    matrix = np.array(embeddings_raw, dtype=np.float32)
    norms = np.linalg.norm(matrix, axis=1, keepdims=True)
    matrix /= np.maximum(norms, 1e-10)
    sim = matrix @ matrix.T  # shape (n, n)

    links = []
    n = len(present_ids)
    for i in range(n):
        for j in range(i + 1, n):
            score = float(sim[i, j])
            if score >= GRAPH_EDGE_THRESHOLD:
                links.append({
                    "source": present_ids[i],
                    "target": present_ids[j],
                    "value": round(score, 3),
                })

    return {"nodes": nodes, "links": links}
