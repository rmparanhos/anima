"""
CLI do Anima.

Disponível como comando após `pip install -e backend/`:
    anima start     — valida tudo e sobe o projeto
    anima stop      — para backend e frontend
    anima setup     — só configura, não sobe
    anima backend   — só o backend
    anima frontend  — só o frontend
    anima model     — troca o modelo Ollama
"""
import argparse
import os
import platform
import shutil
import signal
import subprocess
import sys
import time
from pathlib import Path

ROOT = Path(__file__).parent.parent.parent  # raiz do repositório
BACKEND = ROOT / "backend"
FRONTEND = ROOT / "frontend"

# ─── terminal colors ──────────────────────────────────────────────────────────
_NO_COLOR = not sys.stdout.isatty() or os.environ.get("NO_COLOR")


def _c(code: str, text: str) -> str:
    return text if _NO_COLOR else f"\033[{code}m{text}\033[0m"


def ok(msg: str)   -> None: print(_c("92", f"✓ {msg}"))
def warn(msg: str) -> None: print(_c("93", f"⚠ {msg}"))
def info(msg: str) -> None: print(_c("94", f"→ {msg}"))
def fail(msg: str) -> None: print(_c("91", f"✗ {msg}")); sys.exit(1)
def header(msg: str) -> None: print(_c("94", f"\n╔{'═' * (len(msg) + 2)}╗\n║ {msg} ║\n╚{'═' * (len(msg) + 2)}╝\n"))


# ─── helpers ─────────────────────────────────────────────────────────────────
def run(cmd: list[str], **kwargs) -> subprocess.CompletedProcess:
    return subprocess.run(cmd, **kwargs)


def capture(cmd: list[str]) -> str:
    r = subprocess.run(cmd, capture_output=True, text=True)
    return r.stdout.strip()


def detect_ram_gb() -> int:
    try:
        if platform.system() == "Darwin":
            out = capture(["sysctl", "-n", "hw.memsize"])
            return int(out) // (1024 ** 3)
        elif platform.system() == "Linux":
            for line in Path("/proc/meminfo").read_text().splitlines():
                if line.startswith("MemTotal"):
                    return int(line.split()[1]) // (1024 ** 2)
        elif platform.system() == "Windows":
            import ctypes
            class _MEM(ctypes.Structure):
                _fields_ = [("dwLength", ctypes.c_ulong),
                             ("dwMemoryLoad", ctypes.c_ulong),
                             ("ullTotalPhys", ctypes.c_ulonglong),
                             *[(f"_r{i}", ctypes.c_ulonglong) for i in range(6)]]
            m = _MEM(); m.dwLength = ctypes.sizeof(_MEM)
            ctypes.windll.kernel32.GlobalMemoryStatusEx(ctypes.byref(m))
            return m.ullTotalPhys // (1024 ** 3)
    except Exception:
        pass
    return 0


def recommended_model(ram_gb: int) -> str:
    if ram_gb >= 16:
        return "qwen2.5:7b"   # melhor qualidade + bom em português
    return "qwen2.5:3b"       # mais leve, ainda bom


def ollama_running() -> bool:
    try:
        import urllib.request
        urllib.request.urlopen("http://localhost:11434", timeout=2)
        return True
    except Exception:
        return False


def ollama_has_model(model: str) -> bool:
    r = subprocess.run(["ollama", "list"], capture_output=True, text=True)
    base = model.split(":")[0]
    return base in r.stdout


# ─── steps ───────────────────────────────────────────────────────────────────
def check_python() -> None:
    info("Verificando Python...")
    ok(f"Python {sys.version.split()[0]}")


def check_node() -> None:
    info("Verificando Node.js...")
    if not shutil.which("node"):
        fail("Node.js 18+ não encontrado. Instale em https://nodejs.org")
    version = capture(["node", "-e", "process.stdout.write(process.version)"])
    major = int(version.lstrip("v").split(".")[0])
    if major < 18:
        fail(f"Node.js 18+ necessário (encontrado: {version})")
    ok(f"Node.js {version}")


def check_ollama() -> None:
    info("Verificando Ollama...")
    if shutil.which("ollama"):
        ok("Ollama instalado")
        return

    warn("Ollama não encontrado. Instalando...")
    system = platform.system()

    if system in ("Darwin", "Linux"):
        run(["sh", "-c", "curl -fsSL https://ollama.com/install.sh | sh"], check=True)
    elif system == "Windows":
        # winget (Windows 10+)
        if shutil.which("winget"):
            run(["winget", "install", "Ollama.Ollama", "-e", "--silent"], check=True)
        else:
            fail(
                "Instale o Ollama manualmente: https://ollama.com/download/windows\n"
                "  Depois rode 'anima start' novamente."
            )
    ok("Ollama instalado")


def start_ollama() -> None:
    info("Verificando serviço Ollama...")
    if ollama_running():
        ok("Ollama já está rodando")
        return
    warn("Ollama não está rodando. Iniciando em segundo plano...")
    subprocess.Popen(
        ["ollama", "serve"],
        stdout=subprocess.DEVNULL,
        stderr=subprocess.DEVNULL,
    )
    for _ in range(10):
        time.sleep(1)
        if ollama_running():
            ok("Ollama iniciado")
            return
    fail("Não foi possível iniciar o Ollama. Tente rodar 'ollama serve' manualmente.")


def pull_model(model: str) -> None:
    info(f"Verificando modelo {model}...")
    if ollama_has_model(model):
        ok(f"Modelo {model} disponível")
        return
    warn(f"Baixando {model} (pode demorar alguns minutos na primeira vez)...")
    run(["ollama", "pull", model], check=True)
    ok(f"Modelo {model} pronto")


def install_python_deps() -> None:
    info("Verificando dependências Python...")
    try:
        import fastapi  # noqa: F401
        ok("Dependências Python OK")
    except ImportError:
        warn("Instalando dependências Python...")
        run([sys.executable, "-m", "pip", "install", "-e", str(BACKEND / "[dev]"), "-q"], check=True)
        ok("Dependências Python instaladas")


def setup_env(model: str) -> None:
    env_path = BACKEND / ".env"
    if not env_path.exists():
        warn(".env não encontrado. Criando...")
        content = (BACKEND / ".env.example").read_text()
        content = "\n".join(
            f"OLLAMA_MODEL={model}" if line.startswith("OLLAMA_MODEL=") else line
            for line in content.splitlines()
        )
        env_path.write_text(content)
        ok(f".env criado com OLLAMA_MODEL={model}")
    else:
        ok(".env encontrado")

    env_local = FRONTEND / ".env.local"
    if not env_local.exists():
        shutil.copy(FRONTEND / ".env.local.example", env_local)
        ok(".env.local criado")


def run_migrations() -> None:
    info("Verificando banco de dados...")
    db_path = BACKEND / "anima.db"
    if db_path.exists():
        ok("Banco OK")
        return
    warn("Criando banco de dados...")
    run(["alembic", "upgrade", "head", "-q"], cwd=BACKEND, check=True)
    ok("Banco criado")


def install_node_deps() -> None:
    info("Verificando dependências Node.js...")
    if (FRONTEND / "node_modules").exists():
        ok("Dependências Node.js OK")
        return
    warn("Instalando dependências Node.js...")
    run(["npm", "install", "--silent"], cwd=FRONTEND, check=True)
    ok("Dependências Node.js instaladas")


# ─── comandos ────────────────────────────────────────────────────────────────
def cmd_setup(args) -> None:
    """Valida e configura tudo, sem subir os servidores."""
    header("anima setup")

    check_python()
    check_node()
    check_ollama()

    ram = detect_ram_gb()
    model = args.model or recommended_model(ram)
    label = f"{ram}GB" if ram else "desconhecida"
    print(f"   RAM detectada: {label} → modelo: {_c('93', model)}")

    start_ollama()
    pull_model(model)
    install_python_deps()
    setup_env(model)
    run_migrations()
    install_node_deps()

    print()
    ok("Setup completo! Rode 'anima start' para subir o projeto.")


def cmd_start(args) -> None:
    """Valida tudo e sobe backend + frontend."""
    header("anima start")

    check_python()
    check_node()
    check_ollama()

    ram = detect_ram_gb()
    model = args.model or recommended_model(ram)
    label = f"{ram}GB" if ram else "desconhecida"
    print(f"   RAM detectada: {label} → modelo: {_c('93', model)}")

    start_ollama()
    pull_model(model)
    install_python_deps()
    setup_env(model)
    run_migrations()
    install_node_deps()

    print()
    print(_c("92", "✓ Tudo pronto! Iniciando Anima...\n"))
    print(f"   {_c('94', 'Backend')}  → http://localhost:8000")
    print(f"   {_c('94', 'Swagger')}  → http://localhost:8000/docs")
    print(f"   {_c('94', 'Frontend')} → http://localhost:3000")
    print(f"\n   Pressione {_c('93', 'Ctrl+C')} para parar tudo.\n")

    procs: list[subprocess.Popen] = []

    def shutdown(sig=None, frame=None):
        print("\n→ Encerrando Anima...")
        for p in procs:
            p.terminate()
        sys.exit(0)

    signal.signal(signal.SIGINT, shutdown)
    signal.signal(signal.SIGTERM, shutdown)

    backend_cmd = [sys.executable, "-m", "uvicorn", "app.main:app", "--host", "0.0.0.0", "--port", "8000", "--reload"]
    frontend_cmd = ["npm", "run", "dev"]

    procs.append(subprocess.Popen(backend_cmd, cwd=BACKEND))
    procs.append(subprocess.Popen(frontend_cmd, cwd=FRONTEND))

    for p in procs:
        p.wait()


def cmd_stop(args) -> None:
    """Para backend e frontend."""
    info("Parando Anima...")
    killed = 0
    for name, pattern in [("backend", "uvicorn"), ("frontend", "next")]:
        r = subprocess.run(["pkill", "-f", pattern], capture_output=True)
        if r.returncode == 0:
            ok(f"{name} parado")
            killed += 1
    if killed == 0:
        warn("Nenhum processo encontrado.")


def cmd_backend(args) -> None:
    """Sobe só o backend."""
    run_migrations()
    run([sys.executable, "-m", "uvicorn", "app.main:app", "--reload"], cwd=BACKEND)


def cmd_frontend(args) -> None:
    """Sobe só o frontend."""
    run(["npm", "run", "dev"], cwd=FRONTEND)


def cmd_model(args) -> None:
    """Lista ou troca o modelo Ollama."""
    if args.name:
        env_path = BACKEND / ".env"
        if env_path.exists():
            lines = env_path.read_text().splitlines()
            new_lines = [
                f"OLLAMA_MODEL={args.name}" if l.startswith("OLLAMA_MODEL=") else l
                for l in lines
            ]
            env_path.write_text("\n".join(new_lines) + "\n")
            ok(f"Modelo alterado para {args.name}")
            info("Baixando modelo se necessário...")
            start_ollama()
            pull_model(args.name)
        else:
            fail(".env não encontrado. Rode 'anima setup' primeiro.")
    else:
        info("Modelos disponíveis no Ollama:")
        run(["ollama", "list"])
        print()
        ram = detect_ram_gb()
        print(f"   Recomendado para sua máquina ({ram}GB RAM): {_c('93', recommended_model(ram))}")


# ─── entry point ─────────────────────────────────────────────────────────────
def main() -> None:
    # Ajusta sys.path para encontrar o pacote quando rodado via python start.py
    if str(BACKEND) not in sys.path:
        sys.path.insert(0, str(BACKEND))

    parser = argparse.ArgumentParser(
        prog="anima",
        description="Anima — base de conhecimento coletiva com IA",
    )
    sub = parser.add_subparsers(dest="command", metavar="COMANDO")

    # start
    p_start = sub.add_parser("start", help="valida tudo e sobe o projeto")
    p_start.add_argument("--model", help="força um modelo Ollama específico")
    p_start.set_defaults(func=cmd_start)

    # setup
    p_setup = sub.add_parser("setup", help="configura sem subir os servidores")
    p_setup.add_argument("--model", help="força um modelo Ollama específico")
    p_setup.set_defaults(func=cmd_setup)

    # stop
    p_stop = sub.add_parser("stop", help="para backend e frontend")
    p_stop.set_defaults(func=cmd_stop)

    # backend
    p_be = sub.add_parser("backend", help="sobe só o backend")
    p_be.set_defaults(func=cmd_backend)

    # frontend
    p_fe = sub.add_parser("frontend", help="sobe só o frontend")
    p_fe.set_defaults(func=cmd_frontend)

    # model
    p_model = sub.add_parser("model", help="lista ou troca o modelo Ollama")
    p_model.add_argument("name", nargs="?", help="nome do modelo (ex: qwen2.5:7b)")
    p_model.set_defaults(func=cmd_model)

    args = parser.parse_args()

    if not args.command:
        # sem subcomando → comportamento padrão é start
        args = parser.parse_args(["start"])

    args.func(args)


if __name__ == "__main__":
    main()
