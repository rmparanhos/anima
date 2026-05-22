# anima

A collective knowledge base powered by AI. The AI answers what it knows — what it doesn't know, it asks the community and learns from the response.

---

## How it works

```
User asks a question
      │
      ├─ AI knows → answers directly
      │
      └─ AI doesn't know → creates a pending question
                              │
                        Someone answers
                              │
                        Answer is added to the knowledge base
                              │
                        Next time: AI already knows
```

Like Stack Overflow, but with AI as the main mediator. Anyone can ask and anyone can answer.

---

## Running locally

**Requirements:** Python 3.9+ and Node 18+.

```bash
git clone https://github.com/rmparanhos/anima
cd anima

# install the anima command (one time)
pipx install ./api

# start everything
anima start
```

> Don't have pipx? Install it with `brew install pipx` (macOS) or `pip install pipx`.

`anima start` handles everything automatically:
1. Checks Python and Node.js
2. Installs Ollama if not present (Mac, Linux, Windows)
3. Detects your RAM and downloads the right model automatically
4. Installs Node.js dependencies
5. Creates `.env` files from the examples
6. Runs database migrations
7. Starts api + web

```
✓ Python 3.9.x
✓ Node.js v20.x
✓ Ollama installed
  RAM detected: 16GB → model: qwen2.5:7b
✓ Model qwen2.5:7b available
✓ Database OK
✓ Node.js dependencies OK

API     → http://localhost:8000
Swagger → http://localhost:8000/docs
Web     → http://localhost:3000

Press Ctrl+C to stop everything.
```

### Available commands

```bash
anima start                  # validates everything and starts the project
anima setup                  # validates and configures without starting
anima stop                   # stops api and web
anima api                    # api only
anima web                    # web only
anima model                  # lists available Ollama models
anima model qwen2.5:7b       # switches the model
```

> **No pipx?** Fallback: `python start.py` works without any prior installation.

---

## Environment variables

Generated automatically by `start.py`. For manual adjustment:

```bash
# api/.env
DATABASE_URL=sqlite+aiosqlite:///./anima.db
CHROMA_PATH=./chroma_db
OLLAMA_BASE_URL=http://localhost:11434/v1
OLLAMA_MODEL=qwen2.5:7b    # or qwen2.5:3b for 8GB RAM

# web/.env.local
NEXT_PUBLIC_API_URL=http://localhost:8000
```

> Embeddings and LLM run **100% locally**. No API keys required.

---

## Pages

| Route | Description |
|-------|-------------|
| `/chat` | Chat with the AI |
| `/pending` | Questions the AI couldn't answer |
| `/docs` | Wiki auto-generated from the knowledge base |

---

## Integration with Claude Code / GitHub Copilot (MCP)

Add to your `~/.claude/claude_desktop_config.json` or `.mcp.json`:

```json
{
  "mcpServers": {
    "anima": {
      "command": "python",
      "args": ["-m", "app.mcp_server"],
      "cwd": "/path/to/anima/api",
      "env": {
        "OLLAMA_BASE_URL": "http://localhost:11434/v1",
        "OLLAMA_MODEL": "llama3.1:8b"
      }
    }
  }
}
```

Available tools:
- `search_knowledge(query)` — semantic search over the knowledge base
- `ask_question(question)` — full flow: answers or creates a pending question

---

## Project structure

```
anima/
├── start.py                     # entry point — validates and starts everything
├── Makefile                     # shortcuts: make start, make stop…
├── api/
│   ├── app/
│   │   ├── api/v1/              # endpoints (chat, questions, knowledge, users)
│   │   ├── core/
│   │   │   ├── ai/              # llm (ollama), embedder, rag, confidence
│   │   │   └── knowledge/       # search (ChromaDB), ingestion
│   │   ├── models/              # SQLAlchemy: User, Conversation, Message, Question, KnowledgeChunk
│   │   ├── services/            # chat_service, question_service, knowledge_service
│   │   └── mcp_server.py        # MCP Server for editors
│   └── alembic/                 # database migrations
└── web/
    └── src/
        ├── app/
        │   ├── chat/            # chat interface
        │   ├── pending/         # pending questions
        │   └── docs/            # knowledge base wiki
        └── lib/
            ├── api.ts           # HTTP client
            └── store.ts         # user state (Zustand)
```

---

## Stack

| Layer | Technology |
|-------|------------|
| API | Python 3.9 + FastAPI |
| Database | SQLite (relational) + ChromaDB (vectors) |
| LLM | Ollama local (llama3.1, phi3, mistral…) |
| Embeddings | `sentence-transformers` local (no API key) |
| Web | Next.js 14 + TypeScript + Tailwind |

Zero API keys. Zero Docker. Zero external services.
