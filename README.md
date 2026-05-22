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

**Pré-requisitos:** Python 3.11+ e Node 18+. O resto é instalado automaticamente.

```bash
git clone https://github.com/rmparanhos/anima
cd anima
bash start.sh
```

O script cuida de tudo:
1. Verifica Python e Node.js
2. Instala o Ollama se não estiver instalado
3. Detecta sua RAM e baixa o modelo certo automaticamente
4. Instala dependências Python e Node.js
5. Cria os arquivos `.env` a partir dos exemplos
6. Roda as migrações do banco
7. Sobe backend + frontend

```
✓ Python 3.11.x
✓ Node.js v20.x
✓ Ollama instalado
  RAM detectada: 16GB → modelo recomendado: llama3.1:8b
✓ Modelo llama3.1:8b disponível
✓ Dependências Python OK
✓ Banco OK
✓ Dependências Node.js OK

Backend  → http://localhost:8000
Swagger  → http://localhost:8000/docs
Frontend → http://localhost:3000

Pressione Ctrl+C para parar tudo.
```

### Outros comandos

```bash
make start      # igual ao bash start.sh
make backend    # só o backend
make frontend   # só o frontend
make stop       # para tudo
```

---

## Variáveis de ambiente

Geradas automaticamente pelo `start.sh`. Para ajuste manual:

```bash
# backend/.env
DATABASE_URL=sqlite+aiosqlite:///./anima.db
CHROMA_PATH=./chroma_db
OLLAMA_BASE_URL=http://localhost:11434/v1
OLLAMA_MODEL=llama3.1:8b   # ou phi3:mini para 8GB de RAM

# frontend/.env.local
NEXT_PUBLIC_API_URL=http://localhost:8000
```

> Embeddings e LLM rodam **100% local**. Nenhuma API key necessária.

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
├── start.sh                     # ponto de entrada — valida e sobe tudo
├── Makefile                     # atalhos: make start, make stop…
├── backend/
│   ├── app/
│   │   ├── api/v1/              # endpoints (chat, questions, knowledge, users)
│   │   ├── core/
│   │   │   ├── ai/              # llm (ollama), embedder, rag, confidence
│   │   │   └── knowledge/       # search (ChromaDB), ingestion
│   │   ├── models/              # SQLAlchemy: User, Conversation, Message, Question, KnowledgeChunk
│   │   ├── services/            # chat_service, question_service, knowledge_service
│   │   └── mcp_server.py        # MCP Server para editores
│   └── alembic/                 # migrações do banco
└── frontend/
    └── src/
        ├── app/
        │   ├── chat/            # interface de chat
        │   ├── pending/         # perguntas pendentes
        │   └── docs/            # wiki da base
        └── lib/
            ├── api.ts           # cliente HTTP
            └── store.ts         # estado do usuário (Zustand)
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

Zero API keys. Zero Docker. Zero serviços externos.
