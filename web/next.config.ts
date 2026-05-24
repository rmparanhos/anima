import type { NextConfig } from "next"

// turbopack.root pins the workspace root to the web/ directory.
// Without this, Turbopack walks up to the monorepo root and tries to
// process api/ and scripts/ as part of the bundle (causes Mac freeze on
// first compile).  process.cwd() is always absolute — next dev is run
// from web/, so cwd() resolves to the web/ directory.
const nextConfig: NextConfig = {
  turbopack: {
    root: process.cwd(),
  },
}

export default nextConfig
