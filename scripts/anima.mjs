#!/usr/bin/env node
/**
 * anima CLI — entry point
 *
 * Usage:
 *   anima start          → validates everything and starts the project
 *   anima setup          → validates and configures without starting
 *   anima stop           → stops api and web
 *   anima api            → api only
 *   anima web            → web only
 *   anima model          → lists available Ollama models
 *   anima model <name>   → switches the model (e.g. anima model qwen2.5:7b)
 */
import { execSync, spawn } from "node:child_process"
import { existsSync, readFileSync, writeFileSync } from "node:fs"
import { dirname, join } from "node:path"
import { fileURLToPath } from "node:url"

const resolvePythonPath = () => {
  if (existsSync("./api/.venv/bin/python")) return "./api/.venv/bin/python"
  if (existsSync("/opt/homebrew/bin/python3.12")) return "/opt/homebrew/bin/python3.12"
  if (existsSync("/usr/bin/python3")) return "python3"
  return "python"
}

const ROOT = dirname(dirname(fileURLToPath(import.meta.url)))
const API  = join(ROOT, "api")
const WEB  = join(ROOT, "web")

const c    = (code, txt) => process.stdout.isTTY ? `\x1b[${code}m${txt}\x1b[0m` : txt
const ok   = (msg) => console.log(c(92, `✓ ${msg}`))
const warn = (msg) => console.log(c(93, `⚠ ${msg}`))
const info = (msg) => console.log(c(94, `→ ${msg}`))
const fail = (msg) => { console.error(c(91, `✗ ${msg}`)); process.exit(1) }

const has = (bin) => {
  try { execSync(`which ${bin}`, { stdio: "pipe" }); return true }
  catch { return false }
}

const [,, command, ...args] = process.argv

// ─── help ─────────────────────────────────────────────────────────────────────
if (!command || command === "--help" || command === "-h") {
  console.log(`
${c(94, "anima")} — collective knowledge base powered by AI

${c(93, "Usage:")}
  anima start              start the full project
  anima setup              configure without starting services
  anima stop               stop api and web
  anima api                start api only (Python/FastAPI)
  anima web                start web only (Next.js)
  anima model              list available Ollama models
  anima model <name>       switch model (e.g. qwen2.5:7b)
  anima reset              wipe all knowledge chunks and questions
`)
  process.exit(0)
}

// ─── commands ────────────────────────────────────────────────────────────────
switch (command) {
  case "start": {
    const { default: start } = await import("./start.mjs")
    await start()
    break
  }

  case "setup": {
    const { default: setup } = await import("./setup.mjs")
    await setup()
    break
  }

  case "stop": {
    const { default: stop } = await import("./stop.mjs")
    stop()
    break
  }

  case "api": {
    const py = resolvePythonPath()
    spawn(py, ["-m", "uvicorn", "anima.main:app", "--reload", "--reload-dir", "anima"],
      { cwd: API, stdio: "inherit" })
    break
  }

  case "web": {
    spawn("npm", ["run", "dev"], { cwd: WEB, stdio: "inherit", shell: true })
    break
  }

  case "model": {
    const name = args[0]
    if (!name) {
      info("Available models:")
      execSync("ollama list", { stdio: "inherit" })
    } else {
      const envPath = join(API, ".env")
      if (!existsSync(envPath)) fail(".env not found. Run 'anima setup' first.")
      const content = readFileSync(envPath, "utf8")
        .replace(/^OLLAMA_MODEL=.*/m, `OLLAMA_MODEL=${name}`)
      writeFileSync(envPath, content)
      ok(`Model switched to ${name}`)
      info("Pulling if needed...")
      execSync(`ollama pull ${name}`, { stdio: "inherit" })
    }
    break
  }

  case "reset": {
    const py = resolvePythonPath()
    const resetScript = join(API, "reset_knowledge.py")
    spawn(py, [resetScript], { cwd: API, stdio: "inherit" })
    break
  }

  default:
    fail(`Unknown command: "${command}". Use 'anima --help' to see available commands.`)
}
