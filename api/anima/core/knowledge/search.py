import asyncio
from dataclasses import dataclass
import chromadb
from anima.config import settings

_client: chromadb.ClientAPI | None = None
COLLECTION_NAME = "knowledge"


def _get_client() -> chromadb.ClientAPI:
    global _client
    if _client is None:
        _client = chromadb.PersistentClient(path=settings.chroma_path)
    return _client


def _get_collection() -> chromadb.Collection:
    return _get_client().get_or_create_collection(COLLECTION_NAME, metadata={"hnsw:space": "cosine"})


def get_chroma_client() -> chromadb.ClientAPI:
    return _get_client()


def get_collection() -> chromadb.Collection:
    return _get_collection()


@dataclass
class ChunkWithScore:
    id: str
    content: str
    score: float
    metadata: dict


async def semantic_search(query_embedding: list[float], limit: int | None = None) -> list[ChunkWithScore]:
    k = limit or settings.rag_top_k

    def _run():
        collection = _get_collection()
        if collection.count() == 0:
            return None
        return collection.query(
            query_embeddings=[query_embedding],
            n_results=min(k, collection.count()),
            include=["documents", "distances", "metadatas"],
        )

    results = await asyncio.to_thread(_run)
    if results is None:
        return []

    chunks = []
    for doc, dist, meta, cid in zip(
        results["documents"][0],
        results["distances"][0],
        results["metadatas"][0],
        results["ids"][0],
    ):
        chunks.append(ChunkWithScore(id=cid, content=doc, score=1.0 - dist, metadata=meta or {}))

    return chunks


async def add_chunk_async(chunk_id: str, content: str, embedding: list[float], metadata: dict) -> None:
    await asyncio.to_thread(lambda: _get_collection().add(ids=[chunk_id], documents=[content], embeddings=[embedding], metadatas=[metadata]))


def add_chunk(chunk_id: str, content: str, embedding: list[float], metadata: dict) -> None:
    _get_collection().add(ids=[chunk_id], documents=[content], embeddings=[embedding], metadatas=[metadata])


async def remove_pending_question_async(question_id: str) -> None:
    def _run():
        try:
            _get_client().get_or_create_collection("pending_questions", metadata={"hnsw:space": "cosine"}).delete(ids=[question_id])
        except Exception:
            pass
    await asyncio.to_thread(_run)


def remove_pending_question(question_id: str) -> None:
    try:
        _get_client().get_or_create_collection("pending_questions", metadata={"hnsw:space": "cosine"}).delete(ids=[question_id])
    except Exception:
        pass


async def search_pending_questions(query_embedding: list[float], pending_ids: list[str]) -> list[ChunkWithScore]:
    if not pending_ids:
        return []

    def _run():
        pq = _get_client().get_or_create_collection("pending_questions", metadata={"hnsw:space": "cosine"})
        if pq.count() == 0:
            return None
        return pq.query(
            query_embeddings=[query_embedding],
            n_results=min(5, pq.count()),
            include=["documents", "distances", "metadatas"],
            where={"question_id": {"$in": pending_ids}},
        )

    results = await asyncio.to_thread(_run)
    if results is None:
        return []

    chunks = []
    for doc, dist, meta, cid in zip(
        results["documents"][0],
        results["distances"][0],
        results["metadatas"][0],
        results["ids"][0],
    ):
        chunks.append(ChunkWithScore(id=cid, content=doc, score=1.0 - dist, metadata=meta or {}))
    return chunks


async def add_pending_question_async(question_id: str, text: str, embedding: list[float]) -> None:
    def _run():
        pq = _get_client().get_or_create_collection("pending_questions", metadata={"hnsw:space": "cosine"})
        pq.add(ids=[question_id], documents=[text], embeddings=[embedding], metadatas=[{"question_id": question_id}])
    await asyncio.to_thread(_run)


def add_pending_question(question_id: str, text: str, embedding: list[float]) -> None:
    pq = _get_client().get_or_create_collection("pending_questions", metadata={"hnsw:space": "cosine"})
    pq.add(ids=[question_id], documents=[text], embeddings=[embedding], metadatas=[{"question_id": question_id}])
