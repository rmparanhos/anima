#!/usr/bin/env python
"""
Reset the Anima knowledge base.

Clears:
  - knowledge_chunks table
  - questions + question_duplicates tables
  - messages.triggered_question_id (nulled) and rag_chunks_used (cleared)
  - ChromaDB collections (knowledge + pending_questions)

Keeps:
  - users, conversations, messages (content preserved)
"""
import asyncio
import shutil
import sys
from pathlib import Path

# Allow running from the api/ directory or from the repo root
sys.path.insert(0, str(Path(__file__).parent))

from sqlalchemy.ext.asyncio import create_async_engine, AsyncSession
from sqlalchemy import text


async def reset():
    from anima.config import settings

    print("This will permanently delete all knowledge chunks and questions.")
    answer = input("Type 'yes' to confirm: ").strip().lower()
    if answer != "yes":
        print("Aborted.")
        return

    engine = create_async_engine(settings.database_url)

    async with AsyncSession(engine) as db:
        # 1. Remove question references from messages (nullable FK)
        await db.execute(text(
            "UPDATE messages SET triggered_question_id = NULL, rag_chunks_used = '[]'"
        ))
        # 2. Delete junction table first (references questions)
        await db.execute(text("DELETE FROM question_duplicates"))
        # 3. Delete questions (knowledge_chunk_id FK is gone once chunks are deleted)
        await db.execute(text("DELETE FROM questions"))
        # 4. Delete knowledge chunks
        await db.execute(text("DELETE FROM knowledge_chunks"))
        await db.commit()
        print("✓ Database cleared")

    await engine.dispose()

    # 5. Delete ChromaDB files
    chroma = Path(settings.chroma_path)
    if chroma.exists():
        shutil.rmtree(chroma)
        print(f"✓ ChromaDB deleted ({chroma})")
    else:
        print(f"  ChromaDB folder not found ({chroma}) — skipping")

    print("✓ Knowledge base reset complete")


if __name__ == "__main__":
    asyncio.run(reset())
