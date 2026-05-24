import type { Metadata } from "next"
import "./globals.css"
import Providers from "./providers"

// Google Fonts (next/font/google) downloads font files at compile-time.
// A slow or blocked network request causes the dev "compiling" phase to hang
// indefinitely.  The font-family stack in globals.css already uses
// system-ui / -apple-system, so Inter isn't needed in dev.

export const metadata: Metadata = {
  title: "Anima — Knowledge Base",
  description: "Collective knowledge base powered by AI",
}

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <body style={{ background: "#111118", color: "#e2e2e9", minHeight: "100vh" }}>
        <Providers>
          <nav style={{ background: "#16161f", borderBottom: "1px solid #2a2a3a", padding: "0 24px", height: "48px", display: "flex", alignItems: "center", gap: "8px" }}>
            <span style={{ fontWeight: 700, color: "#fff", marginRight: "16px", fontSize: "15px" }}>anima</span>
            <a href="/chat" style={{ color: "#8888aa", textDecoration: "none", fontSize: "14px", padding: "6px 10px", borderRadius: "6px" }} className="nav-link">chat</a>
            <a href="/pending" style={{ color: "#8888aa", textDecoration: "none", fontSize: "14px", padding: "6px 10px", borderRadius: "6px" }} className="nav-link">pending</a>
            <a href="/docs" style={{ color: "#8888aa", textDecoration: "none", fontSize: "14px", padding: "6px 10px", borderRadius: "6px" }} className="nav-link">docs</a>
          </nav>
          {children}
        </Providers>
      </body>
    </html>
  )
}
