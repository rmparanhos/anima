#!/usr/bin/env python3
"""
Ponto de entrada do Anima antes de qualquer instalação.

    python start.py           → inicia tudo
    python start.py setup     → só configura
    python start.py --help    → ajuda

Após 'pip install -e backend/', o comando 'anima' fica disponível
diretamente no terminal sem precisar do python start.py.
"""
import sys
import os
from pathlib import Path

if sys.version_info < (3, 11):
    print(f"✗ Python 3.11+ necessário (encontrado: {sys.version.split()[0]})")
    sys.exit(1)

# Adiciona o backend ao path para encontrar app.cli antes do pip install
BACKEND = Path(__file__).parent / "backend"
sys.path.insert(0, str(BACKEND))

from app.cli import main  # noqa: E402

if __name__ == "__main__":
    main()
