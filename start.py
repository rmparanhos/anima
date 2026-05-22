#!/usr/bin/env python3
"""
Ponto de entrada do Anima antes de qualquer instalação.

    python start.py           → inicia tudo
    python start.py setup     → só configura
    python start.py --help    → ajuda

Após 'pipx install ./api', o comando 'anima' fica disponível
diretamente no terminal sem precisar do python start.py.
"""
import sys
from pathlib import Path

if sys.version_info < (3, 9):
    print(f"✗ Python 3.9+ necessário (encontrado: {sys.version.split()[0]})")
    sys.exit(1)

# Adiciona a api ao path para encontrar app.cli antes do pipx install
sys.path.insert(0, str(Path(__file__).parent / "api"))

from app.cli import main  # noqa: E402

if __name__ == "__main__":
    main()
