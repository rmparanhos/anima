#!/usr/bin/env node
/**
 * Valida e configura todos os componentes do Anima.
 * Chamado por: npm run setup  ou  npm start (automaticamente)
 */
import { execSync, spawn } from "node:child_process"
import { existsSync, readFileSync, writeFileSync, copyFileSync } from "node:fs"
import { join, dirname } from "node:path"
import { fileURLToPath } from "node:url"
import { platform, totalmem } from "node:os"

const ROOT = dirname(dirname(fileURLToPath(import.meta.url)))
const API  = join(ROOT, "api")
const WEB  = join(ROOT, "web")

// ─── cores ───────────────────────────────────────────────────────────────────
const NO_COLOR = !process.stdout.isTTY || process.env.NO_COLOR
const c = (code, txt) => NO_COLOR ? txt : `\x1b[${code}m${txt}\x1b[0m`

const ok   = (msg) => console.log(c(92, `✓ ${msg}`))
const warn = (msg) => console.log(c(93, `⚠ ${msg}`))
const info = (msg) => console.log(c(94, `→ ${msg}`))
const fail = (msg) => { console.error(c(91, `✗ ${msg}`)); process.exit(1) }

const run = (cmd, opts = {}) =>
  execSync(cmd, { stdio: opts.silent ? "pipe" : "inherit", ...opts })

const has = (bin) => {
  try { execSync(`which ${bin}`, { stdio: "pipe" }); return true }
  catch { return false }
}

// ─── 1. Python ───────────────────────────────────────────────────────────────
export function checkPython() {
  info("Verificando Python...")
  if (!has("python3") && !has("python"))
    fail("Python 3.9+ não encontrado. Instale em https://python.org")

  const py = has("python3") ? "python3" : "python"
  const ver = execSync(`${py} --version`, { encoding: "utf8" }).trim()
  const [, major, minor] = ver.match(/(\d+)\.(\d+)/) ?? []

  if (Number(major) < 3 || (Number(major) === 3 && Number(minor) < 9))
    fail(`Python 3.9+ necessário (encontrado: ${ver})`)

  ok(ver)
  return py
}

// ─── 2. Node ─────────────────────────────────────────────────────────────────
export function checkNode() {
  info("Verificando Node.js...")
  const ver = process.version
  const major = Number(ver.slice(1).split(".")[0])
  if (major < 18) fail(`Node.js 18+ necessário (encontrado: ${ver})`)
  ok(`Node.js ${ver}`)
}

// ─── 3. Ollama ───────────────────────────────────────────────────────────────
export function checkOllama() {
  info("Verificando Ollama...")
  if (has("ollama")) { ok("Ollama instalado"); return }

  warn("Ollama não encontrado. Instalando...")
  const sys = platform()

  if (sys === "darwin" || sys === "linux") {
    run("curl -fsSL https://ollama.com/install.sh | sh")
  } else if (sys === "win32") {
    if (has("winget")) run("winget install Ollama.Ollama -e --silent")
    else fail("Instale o Ollama em https://ollama.com/download/windows e rode novamente.")
  }
  ok("Ollama instalado")
}

// ─── 4. RAM + modelo ─────────────────────────────────────────────────────────
export function detectModel(forcedModel) {
  if (forcedModel) return forcedModel
  const ramGb = Math.round(totalmem() / 1024 ** 3)
  const model = ramGb >= 16 ? "qwen2.5:7b" : "qwen2.5:3b"
  console.log(`   RAM detectada: ${ramGb}GB → modelo: ${c(93, model)}`)
  return model
}

// ─── 5. Sobe Ollama se necessário ────────────────────────────────────────────
export async function startOllama() {
  info("Verificando serviço Ollama...")
  const running = await fetch("http://localhost:11434").then(() => true).catch(() => false)
  if (running) { ok("Ollama já está rodando"); return }

  warn("Iniciando Ollama em segundo plano...")
  const proc = spawn("ollama", ["serve"], { stdio: "ignore", detached: true })
  proc.on("error", () => fail("Ollama não encontrado. Instale em https://ollama.com e rode novamente."))
  proc.unref()

  for (let i = 0; i < 10; i++) {
    await new Promise(r => setTimeout(r, 1000))
    const up = await fetch("http://localhost:11434").then(() => true).catch(() => false)
    if (up) { ok("Ollama iniciado"); return }
  }
  fail("Não foi possível iniciar o Ollama. Tente 'ollama serve' manualmente.")
}

// ─── 6. Baixa modelo ─────────────────────────────────────────────────────────
export function pullModel(model) {
  info(`Verificando modelo ${model}...`)
  const list = execSync("ollama list", { encoding: "utf8" })
  if (list.includes(model.split(":")[0])) { ok(`Modelo ${model} disponível`); return }

  warn(`Baixando ${model} (pode demorar alguns minutos)...`)
  run(`ollama pull ${model}`)
  ok(`Modelo ${model} pronto`)
}

// ─── 7. Dependências Python ───────────────────────────────────────────────────
export function installPythonDeps(py) {
  info("Verificando dependências Python...")
  try {
    execSync(`${py} -c "import fastapi"`, { stdio: "pipe" })
    ok("Dependências Python OK")
  } catch {
    warn("Instalando dependências Python...")
    run(`${py} -m pip install -e "${API}[dev]" -q`)
    ok("Dependências Python instaladas")
  }
}

// ─── 8. .env ─────────────────────────────────────────────────────────────────
export function setupEnv(model) {
  const envPath = join(API, ".env")
  if (!existsSync(envPath)) {
    warn(".env não encontrado. Criando...")
    let content = readFileSync(join(API, ".env.example"), "utf8")
    content = content.replace(/^OLLAMA_MODEL=.*/m, `OLLAMA_MODEL=${model}`)
    writeFileSync(envPath, content)
    ok(`.env criado com OLLAMA_MODEL=${model}`)
  } else {
    ok(".env encontrado")
  }

  const envLocal = join(WEB, ".env.local")
  if (!existsSync(envLocal)) {
    copyFileSync(join(WEB, ".env.local.example"), envLocal)
    ok(".env.local criado")
  }
}

// ─── 9. Migrações ────────────────────────────────────────────────────────────
export function runMigrations(py) {
  info("Verificando banco de dados...")
  if (existsSync(join(API, "anima.db"))) { ok("Banco OK"); return }
  warn("Criando banco de dados...")
  run(`${py} -m alembic upgrade head`, { cwd: API })
  ok("Banco criado")
}

// ─── 10. Deps Node ────────────────────────────────────────────────────────────
export function installNodeDeps() {
  info("Verificando dependências Node.js (web)...")
  if (existsSync(join(WEB, "node_modules"))) { ok("Dependências Node.js OK"); return }
  warn("Instalando dependências Node.js...")
  run("npm install --silent", { cwd: WEB })
  ok("Dependências Node.js instaladas")
}

// ─── main (quando chamado direto) ─────────────────────────────────────────────
if (process.argv[1] === fileURLToPath(import.meta.url)) {
  console.log(c(94, "\n╔══════════════════╗\n║   anima setup    ║\n╚══════════════════╝\n"))

  checkNode()
  const py = checkPython()
  checkOllama()
  const model = detectModel(process.env.OLLAMA_MODEL)
  await startOllama()
  pullModel(model)
  installPythonDeps(py)
  setupEnv(model)
  runMigrations(py)
  installNodeDeps()

  console.log()
  ok("Setup completo! Rode 'npm start' para iniciar.")
}
