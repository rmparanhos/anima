from dataclasses import dataclass
import chromadb
from app.config import settings

_client: chromadb.ClientAPI | None = None
COLLECTION_NAME = "knowledge"


def get_chroma_client() -> chromadb.ClientAPI:
    global _client
    if _client is None:
        _client = chromadb.PersistentClient(path=settings.chroma_path)
    return _client


def get_collection() -> chromadb.Collection:
    client = get_chroma_client()
    return client.get_or_create_collection(COLLECTION_NAME, metadata={"hnsw:space": "cosine"})


@dataclass
class ChunkWithScore:
    id: str
    content: str
    score: float
    metadata: dict


async def semantic_search(query_embedding: list[float], limit: int | None = None) -> list[ChunkWithScore]:
    k = limit or settings.rag_top_k
    collection = get_collection()

    if collection.count() == 0:
        return []

    results = collection.query(
        query_embeddings=[query_embedding],
        n_results=min(k, collection.count()),
        include=["documents", "distances", "metadatas"],
    )

    chunks = []
    for doc, dist, meta, cid in zip(
        results["documents"][0],
        results["distances"][0],
        results["metadatas"][0],
        results["ids"][0],
    ):
        # ChromaDB cosine distance: 0 = identical, 2 = opposite → score = 1 - distance
        score = 1.0 - dist
        chunks.append(ChunkWithScore(id=cid, content=doc, score=score, metadata=meta or {}))

    return chunks


def add_chunk(chunk_id: str, content: str, embedding: list[float], metadata: dict) -> None:
    collection = get_collection()
    collection.add(ids=[chunk_id], documents=[content], embeddings=[embedding], metadatas=[metadata])


def deactivate_chunk(chunk_id: str) -> None:
    collection = get_collection()
    collection.delete(ids=[chunk_id])


async def search_pending_questions(query_embedding: list[float], pending_ids: list[str]) -> list[ChunkWithScore]:
    """Search among a set of question embeddings to detect duplicates."""
    if not pending_ids:
        return []

    pq_collection_name = "pending_questions"
    client = get_chroma_client()
    pq_collection = client.get_or_create_collection(pq_collection_name, metadata={"hnsw:space": "cosine"})

    if pq_collection.count() == 0:
        return []

    results = pq_collection.query(
        query_embeddings=[query_embedding],
        n_results=min(5, pq_collection.count()),
        include=["documents", "distances", "metadatas"],
        where={"question_id": {"$in": pending_ids}} if pending_ids else None,
    )

    chunks = []
    for doc, dist, meta, cid in zip(
        results["documents"][0],
        results["distances"][0],
        results["metadatas"][0],
        results["ids"][0],
    ):
        chunks.append(ChunkWithScore(id=cid, content=doc, score=1.0 - dist, metadata=meta or {}))

    return chunks


def add_pending_question(question_id: str, text: str, embedding: list[float]) -> None:
    client = get_chroma_client()
    pq_collection = client.get_or_create_collection("pending_questions", metadata={"hnsw:space": "cosine"})
    pq_collection.add(ids=[question_id], documents=[text], embeddings=[embedding], metadatas=[{"question_id": question_id}])


def remove_pending_question(question_id: str) -> None:
    client = get_chroma_client()
    pq_collection = client.get_or_create_collection("pending_questions", metadata={"hnsw:space": "cosine"})
    try:
        pq_collection.delete(ids=[question_id])
    except Exception:
        pass
