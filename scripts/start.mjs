#!/usr/bin/env node
import { spawn } from "node:child_process"
import { dirname, join } from "node:path"
import { fileURLToPath } from "node:url"

const ROOT = dirname(dirname(fileURLToPath(import.meta.url)))
const API  = join(ROOT, "api")
const WEB  = join(ROOT, "web")

const c    = (code, txt) => process.stdout.isTTY ? `\x1b[${code}m${txt}\x1b[0m` : txt
const ok   = (msg) => console.log(c(92, `✓ ${msg}`))
const info = (msg) => console.log(c(94, `→ ${msg}`))

export default async function start() {
  console.log(c(94, "\n╔══════════════════╗\n║   anima start    ║\n╚══════════════════╝\n"))

  const { checkNode, checkPython, checkOllama, detectModel,
          startOllama, pullModel, installPythonDeps,
          setupEnv, runMigrations, installNodeDeps } = await import("./setup.mjs")

  checkNode()
  const basePy = checkPython()
  checkOllama()
  const model = detectModel(process.env.OLLAMA_MODEL)
  await startOllama()
  await pullModel(model)
  const py = installPythonDeps(basePy)
  setupEnv(model, process.env.ANIMA_LANGUAGE)
  runMigrations(py)
  installNodeDeps()

  console.log()
  ok("All good! Starting Anima...\n")
  console.log(`   ${c(94, "API")}     → http://localhost:8000`)
  console.log(`   ${c(94, "Swagger")} → http://localhost:8000/docs`)
  console.log(`   ${c(94, "Web")}     → http://localhost:3000`)
  console.log(`\n   Press ${c(93, "Ctrl+C")} to stop.\n`)

  const procs = [
    spawn(py, ["-m", "uvicorn", "anima.main:app", "--host", "0.0.0.0", "--port", "8000", "--reload", "--reload-dir", "anima"],
      { cwd: API, stdio: "inherit" }),
    spawn("npm", ["run", "dev"], { cwd: WEB, stdio: "inherit", shell: true }),
  ]

  const shutdown = () => {
    info("Shutting down Anima...")
    procs.forEach(p => p.kill())
    process.exit(0)
  }

  process.on("SIGINT",  shutdown)
  process.on("SIGTERM", shutdown)
  procs.forEach(p => p.on("exit", shutdown))
}

// direct call (npm start)
if (process.argv[1] === fileURLToPath(import.meta.url)) {
  await start()
}
