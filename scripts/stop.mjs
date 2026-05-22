#!/usr/bin/env node
import { execSync } from "node:child_process"
import { fileURLToPath } from "node:url"

const c    = (code, txt) => process.stdout.isTTY ? `\x1b[${code}m${txt}\x1b[0m` : txt
const ok   = (msg) => console.log(c(92, `✓ ${msg}`))
const warn = (msg) => console.log(c(93, `⚠ ${msg}`))

export default function stop() {
  console.log(c(94, "→ Parando Anima..."))
  let killed = 0
  for (const [name, pattern] of [["api", "uvicorn"], ["web", "next"]]) {
    try {
      execSync(`pkill -f ${pattern}`, { stdio: "pipe" })
      ok(`${name} parado`)
      killed++
    } catch { /* já parado */ }
  }
  if (killed === 0) warn("Nenhum processo encontrado.")
}

if (process.argv[1] === fileURLToPath(import.meta.url)) {
  stop()
}
