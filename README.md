# anima

Base de conhecimento coletiva com IA. A IA responde o que sabe — o que não sabe, ela pergunta para a comunidade e aprende com a resposta.

---

## Como funciona

```
Usuário pergunta
      │
      ├─ IA sabe → responde direto
      │
      └─ IA não sabe → registra como pendente
                              │
                        Alguém responde
                              │
                        Resposta entra na base
                              │
                        Próxima vez: IA já sabe
```

É como um Stack Overflow, mas o mediador principal é a IA. Qualquer pessoa pode perguntar e qualquer pessoa pode responder.

---

## Rodando localmente

**Pré-requisitos:** Python 3.11+ e Node 18+

### Backend

```bash
cd backend
pip install -e ".[dev]"

# Copie e preencha as variáveis
cp .env.example .env

# Cria o banco (SQLite local)
alembic upgrade head

# Sobe o servidor
uvicorn app.main:app --reload
# → http://localhost:8000
# → http://localhost:8000/docs  (Swagger)
```

### Frontend

```bash
cd frontend
npm install
cp .env.local.example .env.local
npm run dev
# → http://localhost:3000
```

---

## Variáveis de ambiente

```bash
# backend/.env
ANTHROPIC_API_KEY=sk-ant-...        # única API key necessária (Claude)
DATABASE_URL=sqlite+aiosqlite:///./anima.db
CHROMA_PATH=./chroma_db

# ajustes opcionais
RAG_CONFIDENCE_THRESHOLD=0.72       # abaixo disso → "não sei"
RAG_TOP_K=5                         # chunks recuperados por busca
QUESTION_DEDUP_THRESHOLD=0.90       # similaridade para agrupar duplicatas
```

> Embeddings rodam **localmente** via `sentence-transformers` (modelo `all-MiniLM-L6-v2`, ~90MB, baixado automaticamente na primeira execução). Sem OpenAI, sem custo adicional.

```bash
# frontend/.env.local
NEXT_PUBLIC_API_URL=http://localhost:8000
```

---

## Páginas

| Rota | O que é |
|------|---------|
| `/chat` | Chat com a IA |
| `/pending` | Perguntas que a IA não soube responder |
| `/docs` | Wiki gerada automaticamente pela base |

---

## Integração com Claude Code / GitHub Copilot (MCP)

Adicione ao seu `~/.claude/claude_desktop_config.json` ou `.mcp.json`:

```json
{
  "mcpServers": {
    "anima": {
      "command": "python",
      "args": ["-m", "app.mcp_server"],
      "cwd": "/caminho/para/anima/backend",
      "env": {
        "ANTHROPIC_API_KEY": "sk-ant-...",
        "OPENAI_API_KEY": "sk-..."
      }
    }
  }
}
```

Ferramentas disponíveis:
- `search_knowledge(query)` — busca semântica na base
- `ask_question(question)` — fluxo completo: responde ou registra pendente

---

## Estrutura do projeto

```
anima/
├── backend/
│   ├── app/
│   │   ├── api/v1/          # endpoints (chat, questions, knowledge, users)
│   │   ├── core/
│   │   │   ├── ai/          # claude.py, embedder.py, rag.py, confidence.py
│   │   │   └── knowledge/   # search.py (ChromaDB), ingestion.py
│   │   ├── models/          # SQLAlchemy: User, Conversation, Message, Question, KnowledgeChunk
│   │   ├── services/        # chat_service, question_service, knowledge_service
│   │   └── mcp_server.py    # MCP Server para editores
│   └── alembic/             # migrações do banco
└── frontend/
    └── src/
        ├── app/
        │   ├── chat/        # interface de chat
        │   ├── pending/     # perguntas pendentes
        │   └── docs/        # wiki da base
        └── lib/
            ├── api.ts       # cliente HTTP
            └── store.ts     # estado do usuário (Zustand)
```

---

## Stack

| Camada | Tecnologia |
|--------|------------|
| Backend | Python 3.11 + FastAPI |
| Banco | SQLite (relacional) + ChromaDB (vetores) |
| LLM | Claude via API Anthropic |
| Embeddings | `sentence-transformers` local (sem API key) |
| Frontend | Next.js 14 + TypeScript + Tailwind |

Sem Docker, sem serviços externos. Tudo roda com `pip install` + `npm install`.
