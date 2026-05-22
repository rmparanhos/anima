#!/usr/bin/env bash
set -euo pipefail

# ─── cores ───────────────────────────────────────────────────────────────────
RED='\033[0;31m'; GREEN='\033[0;32m'; YELLOW='\033[1;33m'; BLUE='\033[0;34m'; NC='\033[0m'
ok()   { echo -e "${GREEN}✓ $1${NC}"; }
warn() { echo -e "${YELLOW}⚠ $1${NC}"; }
info() { echo -e "${BLUE}→ $1${NC}"; }
fail() { echo -e "${RED}✗ $1${NC}"; exit 1; }

echo ""
echo -e "${BLUE}╔══════════════════════════════╗"
echo -e "║          anima start         ║"
echo -e "╚══════════════════════════════╝${NC}"
echo ""

# ─── 1. Python ───────────────────────────────────────────────────────────────
info "Verificando Python..."
if ! command -v python3 &>/dev/null; then
  fail "Python 3.11+ não encontrado. Instale em https://python.org"
fi

PY_MINOR=$(python3 -c "import sys; print(sys.version_info.minor)")
PY_MAJOR=$(python3 -c "import sys; print(sys.version_info.major)")
if [ "$PY_MAJOR" -lt 3 ] || [ "$PY_MINOR" -lt 11 ]; then
  fail "Python 3.11+ necessário (encontrado: $(python3 --version))"
fi
ok "Python $(python3 --version | cut -d' ' -f2)"

# ─── 2. Node.js ──────────────────────────────────────────────────────────────
info "Verificando Node.js..."
if ! command -v node &>/dev/null; then
  fail "Node.js 18+ não encontrado. Instale em https://nodejs.org"
fi

NODE_MAJOR=$(node -e "process.stdout.write(process.version.slice(1).split('.')[0])")
if [ "$NODE_MAJOR" -lt 18 ]; then
  fail "Node.js 18+ necessário (encontrado: $(node --version))"
fi
ok "Node.js $(node --version)"

# ─── 3. Ollama ───────────────────────────────────────────────────────────────
info "Verificando Ollama..."
if ! command -v ollama &>/dev/null; then
  warn "Ollama não encontrado. Instalando..."
  if [[ "$OSTYPE" == "darwin"* ]]; then
    if command -v brew &>/dev/null; then
      brew install ollama
    else
      curl -fsSL https://ollama.com/install.sh | sh
    fi
  else
    curl -fsSL https://ollama.com/install.sh | sh
  fi
  ok "Ollama instalado"
else
  ok "Ollama $(ollama --version 2>/dev/null || echo 'instalado')"
fi

# ─── 4. Detecta RAM e escolhe modelo ─────────────────────────────────────────
info "Detectando hardware..."

RECOMMENDED_MODEL="${OLLAMA_MODEL:-}"

if [ -z "$RECOMMENDED_MODEL" ]; then
  if [[ "$OSTYPE" == "darwin"* ]]; then
    RAM_BYTES=$(sysctl -n hw.memsize 2>/dev/null || echo 0)
    RAM_GB=$(( RAM_BYTES / 1024 / 1024 / 1024 ))
  else
    RAM_KB=$(grep MemTotal /proc/meminfo 2>/dev/null | awk '{print $2}' || echo 0)
    RAM_GB=$(( RAM_KB / 1024 / 1024 ))
  fi

  if [ "$RAM_GB" -ge 16 ]; then
    RECOMMENDED_MODEL="llama3.1:8b"
    echo -e "   RAM detectada: ${RAM_GB}GB → modelo recomendado: ${RECOMMENDED_MODEL}"
  else
    RECOMMENDED_MODEL="phi3:mini"
    echo -e "   RAM detectada: ${RAM_GB}GB → modelo recomendado: ${RECOMMENDED_MODEL}"
  fi
fi

ok "Modelo: $RECOMMENDED_MODEL"

# ─── 5. Sobe Ollama se não estiver rodando ────────────────────────────────────
info "Verificando serviço Ollama..."
if ! curl -s http://localhost:11434 &>/dev/null; then
  warn "Ollama não está rodando. Iniciando..."
  ollama serve &>/dev/null &
  OLLAMA_PID=$!
  sleep 2
  ok "Ollama iniciado (PID $OLLAMA_PID)"
else
  ok "Ollama já está rodando"
fi

# ─── 6. Baixa modelo se necessário ───────────────────────────────────────────
info "Verificando modelo $RECOMMENDED_MODEL..."
if ! ollama list 2>/dev/null | grep -q "^${RECOMMENDED_MODEL%:*}"; then
  warn "Modelo $RECOMMENDED_MODEL não encontrado. Baixando (pode demorar alguns minutos)..."
  ollama pull "$RECOMMENDED_MODEL"
  ok "Modelo baixado"
else
  ok "Modelo $RECOMMENDED_MODEL disponível"
fi

# ─── 7. Dependências Python ───────────────────────────────────────────────────
info "Verificando dependências Python..."
cd "$(dirname "$0")/backend"

if ! python3 -c "import fastapi" &>/dev/null; then
  warn "Instalando dependências Python..."
  pip install -e ".[dev]" -q
  ok "Dependências Python instaladas"
else
  ok "Dependências Python OK"
fi

# ─── 8. Cria .env se não existir ─────────────────────────────────────────────
if [ ! -f ".env" ]; then
  warn ".env não encontrado. Criando a partir do .env.example..."
  cp .env.example .env
  # injeta o modelo detectado
  sed -i.bak "s/OLLAMA_MODEL=.*/OLLAMA_MODEL=$RECOMMENDED_MODEL/" .env && rm -f .env.bak
  ok ".env criado com OLLAMA_MODEL=$RECOMMENDED_MODEL"
else
  ok ".env encontrado"
fi

# ─── 9. Migração do banco ─────────────────────────────────────────────────────
info "Verificando banco de dados..."
if ! python3 -c "
import asyncio, sys
from sqlalchemy.ext.asyncio import create_async_engine
async def check():
    engine = create_async_engine('sqlite+aiosqlite:///./anima.db')
    async with engine.connect() as conn:
        result = await conn.run_sync(lambda c: c.execute(__import__('sqlalchemy').text(\"SELECT name FROM sqlite_master WHERE type='table' AND name='users'\")))
        return result.fetchone() is not None
sys.exit(0 if asyncio.run(check()) else 1)
" &>/dev/null; then
  warn "Banco não inicializado. Rodando migrações..."
  alembic upgrade head -q
  ok "Banco criado"
else
  ok "Banco OK"
fi

cd ..

# ─── 10. Dependências Node ────────────────────────────────────────────────────
info "Verificando dependências Node.js..."
cd frontend

if [ ! -d "node_modules" ]; then
  warn "Instalando dependências Node.js..."
  npm install --silent
  ok "Dependências Node.js instaladas"
else
  ok "Dependências Node.js OK"
fi

# ─── 11. Cria .env.local se não existir ──────────────────────────────────────
if [ ! -f ".env.local" ]; then
  cp .env.local.example .env.local
  ok ".env.local criado"
fi

cd ..

# ─── 12. Inicia backend e frontend ───────────────────────────────────────────
echo ""
echo -e "${GREEN}✓ Tudo pronto! Iniciando Anima...${NC}"
echo ""
echo -e "   ${BLUE}Backend${NC}  → http://localhost:8000"
echo -e "   ${BLUE}Swagger${NC}  → http://localhost:8000/docs"
echo -e "   ${BLUE}Frontend${NC} → http://localhost:3000"
echo ""
echo -e "   Pressione ${YELLOW}Ctrl+C${NC} para parar tudo."
echo ""

# trap pra matar filhos quando Ctrl+C
cleanup() {
  echo ""
  info "Encerrando Anima..."
  kill "$BACKEND_PID" "$FRONTEND_PID" 2>/dev/null || true
  exit 0
}
trap cleanup SIGINT SIGTERM

cd backend
uvicorn app.main:app --host 0.0.0.0 --port 8000 --reload 2>&1 | sed 's/^/[backend] /' &
BACKEND_PID=$!

cd ../frontend
npm run dev 2>&1 | sed 's/^/[frontend] /' &
FRONTEND_PID=$!

wait
