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

## Pré-requisito: Ollama

O Anima roda **100% local**, sem nenhuma API key.

```bash
# 1. instala o Ollama (apenas uma vez)
curl -fsSL https://ollama.com/install.sh | sh   # Linux/Mac

# 2. baixa o modelo (escolha conforme sua RAM)
ollama pull llama3.1:8b   # 16GB RAM → melhor qualidade (~5GB download)
ollama pull phi3:mini      # 8GB RAM  → mais leve (~2GB download)
ollama pull llama3.2:3b   # 8GB RAM  → alternativa ao phi3

# 3. Ollama fica rodando em http://localhost:11434
```

## Variáveis de ambiente

```bash
# backend/.env  (copie de .env.example)
DATABASE_URL=sqlite+aiosqlite:///./anima.db
CHROMA_PATH=./chroma_db

OLLAMA_BASE_URL=http://localhost:11434/v1
OLLAMA_MODEL=llama3.1:8b   # troque por phi3:mini se tiver 8GB de RAM

# ajustes opcionais
RAG_CONFIDENCE_THRESHOLD=0.72
RAG_TOP_K=5
QUESTION_DEDUP_THRESHOLD=0.90
```

> Embeddings também rodam **localmente** via `sentence-transformers` (`all-MiniLM-L6-v2`, ~90MB, baixado automaticamente). **Nenhuma API key necessária em nenhuma etapa.**

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
        "OLLAMA_BASE_URL": "http://localhost:11434/v1",
        "OLLAMA_MODEL": "llama3.1:8b"
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
| LLM | Ollama local (llama3.1, phi3, mistral…) |
| Embeddings | `sentence-transformers` local (sem API key) |
| Frontend | Next.js 14 + TypeScript + Tailwind |

Sem Docker, sem serviços externos. Tudo roda com `pip install` + `npm install`.
