#!/usr/bin/env node
/**
 * Validates and configures all Anima components.
 * Called by: npm run setup  or  npm start (automatically)
 */
import { execSync, spawn } from "node:child_process"
import { existsSync, readFileSync, writeFileSync } from "node:fs"
import { join, dirname } from "node:path"
import { fileURLToPath } from "node:url"
import { platform, totalmem } from "node:os"

const ROOT = dirname(dirname(fileURLToPath(import.meta.url)))
const API  = join(ROOT, "api")
const WEB  = join(ROOT, "web")

// ─── colors ──────────────────────────────────────────────────────────────────
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
  info("Checking Python...")
  if (!has("python3") && !has("python"))
    fail("Python 3.12+ not found. Install it at https://python.org")

  const py = has("python3") ? "python3" : "python"
  const ver = execSync(`${py} --version`, { encoding: "utf8" }).trim()
  const [, major, minor] = ver.match(/(\d+)\.(\d+)/) ?? []

  if (Number(major) < 3 || (Number(major) === 3 && Number(minor) < 12))
    fail(`Python 3.12+ required (found: ${ver})`)

  ok(ver)
  return py
}

// ─── 2. Node ─────────────────────────────────────────────────────────────────
export function checkNode() {
  info("Checking Node.js...")
  const ver = process.version
  const major = Number(ver.slice(1).split(".")[0])
  if (major < 18) fail(`Node.js 18+ required (found: ${ver})`)
  ok(`Node.js ${ver}`)
}

// ─── 3. Ollama ───────────────────────────────────────────────────────────────
export function checkOllama() {
  info("Checking Ollama...")
  if (has("ollama")) { ok("Ollama installed"); return }

  warn("Ollama not found. Installing...")
  const sys = platform()

  if (sys === "darwin" || sys === "linux") {
    run("curl -fsSL https://ollama.com/install.sh | sh")
  } else if (sys === "win32") {
    if (has("winget")) run("winget install Ollama.Ollama -e --silent")
    else fail("Install Ollama from https://ollama.com/download/windows and run again.")
  }
  ok("Ollama installed")
}

// ─── 4. RAM + model ──────────────────────────────────────────────────────────
export function detectModel(forcedModel) {
  if (forcedModel) return forcedModel
  const ramGb = Math.round(totalmem() / 1024 ** 3)
  const model = ramGb >= 16 ? "qwen2.5:7b" : "qwen2.5:3b"
  console.log(`   RAM detected: ${ramGb}GB → model: ${c(93, model)}`)
  return model
}

// ─── 5. Start Ollama if needed ───────────────────────────────────────────────
export async function startOllama() {
  info("Checking Ollama service...")
  const running = await fetch("http://localhost:11434").then(() => true).catch(() => false)
  if (running) { ok("Ollama already running"); return }

  warn("Starting Ollama in background...")
  const proc = spawn("ollama", ["serve"], { stdio: "ignore", detached: true })
  proc.on("error", () => fail("Ollama not found. Install it at https://ollama.com and run again."))
  proc.unref()

  for (let i = 0; i < 10; i++) {
    await new Promise(r => setTimeout(r, 1000))
    const up = await fetch("http://localhost:11434").then(() => true).catch(() => false)
    if (up) { ok("Ollama started"); return }
  }
  fail("Could not start Ollama. Try running 'ollama serve' manually.")
}

// ─── 6. Pull model ───────────────────────────────────────────────────────────
export function pullModel(model) {
  info(`Checking model ${model}...`)
  const list = execSync("ollama list", { encoding: "utf8" })
  if (list.includes(model.split(":")[0])) { ok(`Model ${model} available`); return }

  warn(`Downloading ${model} (this may take a few minutes)...`)
  run(`ollama pull ${model}`)
  ok(`Model ${model} ready`)
}

// ─── 7. Python dependencies ──────────────────────────────────────────────────
export function installPythonDeps(py) {
  info("Installing Python dependencies...")
  run(`${py} -m pip install "${API}" --upgrade -q`)
  ok("Python dependencies OK")
}

// ─── 8. .env ─────────────────────────────────────────────────────────────────
export function setupEnv(model) {
  const envPath = join(API, ".env")
  if (!existsSync(envPath)) {
    warn(".env not found. Creating...")
    let content = readFileSync(join(API, ".env.example"), "utf8")
    content = content.replace(/^OLLAMA_MODEL=.*/m, `OLLAMA_MODEL=${model}`)
    writeFileSync(envPath, content)
    ok(`.env created with OLLAMA_MODEL=${model}`)
  } else {
    ok(".env found")
  }

  const envLocal = join(WEB, ".env.local")
  if (!existsSync(envLocal)) {
    writeFileSync(envLocal, "NEXT_PUBLIC_API_URL=http://localhost:8000\n")
    ok(".env.local created")
  }
}

// ─── 9. Migrations ───────────────────────────────────────────────────────────
export function runMigrations(py) {
  info("Checking database...")
  if (existsSync(join(API, "anima.db"))) { ok("Database OK"); return }
  warn("Creating database...")
  run(`${py} -m alembic upgrade head`, { cwd: API })
  ok("Database created")
}

// ─── 10. Node deps ───────────────────────────────────────────────────────────
export function installNodeDeps() {
  info("Checking Node.js dependencies (web)...")
  if (existsSync(join(WEB, "node_modules"))) { ok("Node.js dependencies OK"); return }
  warn("Installing Node.js dependencies...")
  run("npm install --silent", { cwd: WEB })
  ok("Node.js dependencies installed")
}

// ─── export default (used by anima CLI) ──────────────────────────────────────
export default async function setup() {
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
  ok("Setup complete! Run 'anima start' to launch.")
}

// ─── direct call (npm run setup) ─────────────────────────────────────────────
if (process.argv[1] === fileURLToPath(import.meta.url)) {
  await setup()
}
