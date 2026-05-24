#!/usr/bin/env bash
set -e

ROOT="$(cd "$(dirname "$0")/.." && pwd)"

echo "→ Matando processos nas portas 8000 e 3000..."
lsof -ti :8000 | xargs kill -9 2>/dev/null || true
lsof -ti :3000 | xargs kill -9 2>/dev/null || true

echo "→ Limpando bytecode Python..."
find "$ROOT/api" -name "*.pyc" -delete 2>/dev/null || true
find "$ROOT/api" -name "__pycache__" -type d -exec rm -rf {} + 2>/dev/null || true

echo "✓ Pronto! Agora rode: anima start"
