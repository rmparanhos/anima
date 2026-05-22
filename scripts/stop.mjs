#!/usr/bin/env node
import { execSync } from "node:child_process"

const c    = (code, txt) => `\x1b[${code}m${txt}\x1b[0m`
const ok   = (msg) => console.log(c(92, `✓ ${msg}`))
const warn = (msg) => console.log(c(93, `⚠ ${msg}`))

console.log("→ Parando Anima...")

let killed = 0
for (const [name, pattern] of [["api", "uvicorn"], ["web", "next"]]) {
  try {
    execSync(`pkill -f ${pattern}`, { stdio: "pipe" })
    ok(`${name} parado`)
    killed++
  } catch { /* processo já parado */ }
}

if (killed === 0) warn("Nenhum processo encontrado.")
