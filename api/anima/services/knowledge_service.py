import asyncio
import json
import numpy as np
from collections import defaultdict
from datetime import datetime, timezone
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select, func
from anima.models.knowledge_chunk import KnowledgeChunk

GRAPH_EDGE_THRESHOLD = 0.40  # cosine similarity between entity centroids


async def update_chunk(
    db: AsyncSession,
    chunk_id: str,
    content: str,
    title: str,
    entity: str,
) -> KnowledgeChunk:
    """Update a knowledge chunk's content, title and entity; re-embeds in ChromaDB."""
    from anima.core.ai.embedder import embedder
    from anima.core.knowledge.search import update_chunk_async

    chunk = await db.get(KnowledgeChunk, chunk_id)
    if not chunk:
        raise ValueError(f"Chunk {chunk_id!r} not found")

    # Preserve existing metadata fields (topic, source_type, etc.)
    meta: dict = {}
    try:
        meta = json.loads(chunk.metadata_json or "{}")
    except Exception:
        pass

    meta["title"]  = title.strip()
    meta["entity"] = entity.strip()

    embedding = await embedder.embed(content)
    await update_chunk_async(chunk_id, content, embedding, meta)

    chunk.content       = content
    chunk.metadata_json = json.dumps(meta)
    chunk.updated_at    = datetime.now(timezone.utc)
    await db.commit()
    await db.refresh(chunk)
    return chunk


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


def _extract_meta(chunk: KnowledgeChunk) -> tuple[str, str, str]:
    """Return (entity, title, topic) from a chunk's metadata_json."""
    try:
        meta = json.loads(chunk.metadata_json or "{}")
        entity = meta.get("entity") or ""
        title  = meta.get("title")  or ""
        topic  = meta.get("topic")  or ""
    except Exception:
        entity, title, topic = "", "", ""

    if not title:
        words = chunk.content.split()
        title = " ".join(words[:6]) + ("…" if len(words) > 6 else "")
    if not topic:
        topic = "General"
    if not entity:
        entity = title  # pre-entity chunks: entity = title

    return entity, title, topic


async def get_knowledge_graph(db: AsyncSession) -> dict:
    """Build an entity-based knowledge graph.

    Nodes  = entities (distinct named products / features / concepts).
             Each node carries the list of associated chunks for the detail panel.
    Edges  = pairs of entities whose embedding centroids have cosine similarity
             above GRAPH_EDGE_THRESHOLD — so related entities cluster together.
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
    embeddings_raw: list   = result["embeddings"]

    if not present_ids:
        return {"nodes": [], "links": []}

    # Build lookup: chunk_id → (embedding, chunk)
    chunk_by_id = {c.id: c for c in chunks}
    emb_by_id: dict[str, np.ndarray] = {
        cid: np.array(emb, dtype=np.float32)
        for cid, emb in zip(present_ids, embeddings_raw)
        if cid in chunk_by_id
    }

    # ── Group chunks by entity ────────────────────────────────────────────────
    entity_chunks: dict[str, list[tuple[KnowledgeChunk, np.ndarray]]] = defaultdict(list)
    entity_topic:  dict[str, str] = {}

    for cid, emb in emb_by_id.items():
        chunk = chunk_by_id[cid]
        entity, _title, topic = _extract_meta(chunk)
        entity_chunks[entity].append((chunk, emb))
        entity_topic.setdefault(entity, topic)

    entities = list(entity_chunks.keys())
    if not entities:
        return {"nodes": [], "links": []}

    # ── Compute centroid embedding per entity ─────────────────────────────────
    def _centroid(pairs: list[tuple[KnowledgeChunk, np.ndarray]]) -> np.ndarray:
        mat  = np.stack([e for _, e in pairs])
        c    = mat.mean(axis=0)
        norm = np.linalg.norm(c)
        return c / norm if norm > 0 else c

    centroids = {e: _centroid(entity_chunks[e]) for e in entities}

    # ── Build nodes ───────────────────────────────────────────────────────────
    nodes = []
    for entity in entities:
        pairs = entity_chunks[entity]
        chunk_previews = [
            {
                "id":      c.id,
                "title":   _extract_meta(c)[1],
                "content": c.content,
            }
            for c, _ in sorted(pairs, key=lambda x: x[0].created_at)
        ]
        # Short preview for the tooltip (first chunk, first 200 chars)
        preview = pairs[0][0].content
        nodes.append({
            "id":          entity,
            "entity":      entity,
            "topic":       entity_topic[entity],
            "chunk_count": len(pairs),
            "chunks":      chunk_previews,
            "content":     preview[:200] + ("…" if len(preview) > 200 else ""),
        })

    # ── Build edges via centroid cosine similarity ────────────────────────────
    n = len(entities)
    links = []
    if n > 1:
        mat = np.stack([centroids[e] for e in entities])  # (n, d)
        sim = mat @ mat.T                                  # (n, n)

        for i in range(n):
            for j in range(i + 1, n):
                score = float(sim[i, j])
                if score >= GRAPH_EDGE_THRESHOLD:
                    links.append({
                        "source": entities[i],
                        "target": entities[j],
                        "value":  round(score, 3),
                    })

    return {"nodes": nodes, "links": links}
