#!/usr/bin/env node
/**
 * anima CLI — entry point
 *
 * Uso:
 *   anima start          → valida tudo e sobe o projeto
 *   anima setup          → só configura, sem subir
 *   anima stop           → para api e web
 *   anima api            → só a api
 *   anima web            → só o web
 *   anima model          → lista modelos Ollama disponíveis
 *   anima model <nome>   → troca o modelo (ex: anima model qwen2.5:7b)
 */
import { execSync, spawn } from "node:child_process"
import { existsSync, readFileSync, writeFileSync } from "node:fs"
import { dirname, join } from "node:path"
import { fileURLToPath } from "node:url"

const ROOT = dirname(dirname(fileURLToPath(import.meta.url)))
const API  = join(ROOT, "api")
const WEB  = join(ROOT, "web")

const c    = (code, txt) => process.stdout.isTTY ? `\x1b[${code}m${txt}\x1b[0m` : txt
const ok   = (msg) => console.log(c(92, `✓ ${msg}`))
const warn = (msg) => console.log(c(93, `⚠ ${msg}`))
const info = (msg) => console.log(c(94, `→ ${msg}`))
const fail = (msg) => { console.error(c(91, `✗ ${msg}`)); process.exit(1) }

const [,, command, ...args] = process.argv

// ─── help ─────────────────────────────────────────────────────────────────────
if (!command || command === "--help" || command === "-h") {
  console.log(`
${c(94, "anima")} — base de conhecimento coletiva com IA

${c(93, "Uso:")}
  anima start              inicia o projeto completo
  anima setup              configura sem subir os serviços
  anima stop               para api e web
  anima api                sobe só a api (Python/FastAPI)
  anima web                sobe só o web (Next.js)
  anima model              lista modelos Ollama disponíveis
  anima model <nome>       troca o modelo (ex: qwen2.5:7b)
`)
  process.exit(0)
}

// ─── comandos ────────────────────────────────────────────────────────────────
switch (command) {
  case "start": {
    const { default: start } = await import("./start.mjs")
    break
  }

  case "setup": {
    const { default: setup } = await import("./setup.mjs")
    break
  }

  case "stop": {
    const { default: stop } = await import("./stop.mjs")
    break
  }

  case "api": {
    const py = existsSync("/usr/bin/python3") ? "python3" : "python"
    spawn(py, ["-m", "uvicorn", "app.main:app", "--reload"],
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
      info("Modelos disponíveis:")
      execSync("ollama list", { stdio: "inherit" })
    } else {
      const envPath = join(API, ".env")
      if (!existsSync(envPath)) fail(".env não encontrado. Rode 'anima setup' primeiro.")
      const content = readFileSync(envPath, "utf8")
        .replace(/^OLLAMA_MODEL=.*/m, `OLLAMA_MODEL=${name}`)
      writeFileSync(envPath, content)
      ok(`Modelo alterado para ${name}`)
      info("Baixando se necessário...")
      execSync(`ollama pull ${name}`, { stdio: "inherit" })
    }
    break
  }

  default:
    fail(`Comando desconhecido: "${command}". Use 'anima --help' para ver os comandos.`)
}
