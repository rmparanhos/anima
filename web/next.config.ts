import type { NextConfig } from "next"

// Keep it minimal — the turbopack.root option caused Turbopack to scan the
// entire monorepo (including api/) when resolving modules, making first-compile
// extremely slow and memory-hungry.
const nextConfig: NextConfig = {}

export default nextConfig
