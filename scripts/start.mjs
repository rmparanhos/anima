#!/usr/bin/env node
/**
 * Valida, configura e sobe o Anima completo.
 * Chamado por: npm start
 */
import { spawn } from "node:child_process"
import { dirname, join } from "node:path"
import { fileURLToPath } from "node:url"

const ROOT = dirname(dirname(fileURLToPath(import.meta.url)))
const API  = join(ROOT, "api")
const WEB  = join(ROOT, "web")

const c    = (code, txt) => `\x1b[${code}m${txt}\x1b[0m`
const ok   = (msg) => console.log(c(92, `✓ ${msg}`))
const info = (msg) => console.log(c(94, `→ ${msg}`))

// ─── setup ───────────────────────────────────────────────────────────────────
console.log(c(94, "\n╔══════════════════╗\n║   anima start    ║\n╚══════════════════╝\n"))

const { checkNode, checkPython, checkOllama, detectModel,
        startOllama, pullModel, installPythonDeps,
        setupEnv, runMigrations, installNodeDeps } = await import("./setup.mjs")

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

// ─── start ───────────────────────────────────────────────────────────────────
console.log()
ok("Tudo pronto! Iniciando Anima...\n")
console.log(`   ${c(94, "API")}     → http://localhost:8000`)
console.log(`   ${c(94, "Swagger")} → http://localhost:8000/docs`)
console.log(`   ${c(94, "Web")}     → http://localhost:3000`)
console.log(`\n   Pressione ${c(93, "Ctrl+C")} para parar tudo.\n`)

const procs = [
  spawn(py, ["-m", "uvicorn", "app.main:app", "--host", "0.0.0.0", "--port", "8000", "--reload"],
    { cwd: API, stdio: "inherit" }),
  spawn("npm", ["run", "dev"], { cwd: WEB, stdio: "inherit", shell: true }),
]

const shutdown = () => {
  info("Encerrando Anima...")
  procs.forEach(p => p.kill())
  process.exit(0)
}

process.on("SIGINT",  shutdown)
process.on("SIGTERM", shutdown)
procs.forEach(p => p.on("exit", shutdown))
