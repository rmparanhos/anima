import type { NextConfig } from "next"

// turbopack.root tells Turbopack where the workspace root is.
// Without it, Turbopack walks up and finds the monorepo's package-lock.json,
// then scans the entire monorepo (api/, scripts/, …) during compilation.
// Setting it to "." pins the root to the web/ directory itself.
const nextConfig: NextConfig = {
  turbopack: {
    root: ".",
  },
}

export default nextConfig
