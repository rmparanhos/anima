import { useState } from "react"
import { useQuery } from "@tanstack/react-query"
import { api, type KnowledgeChunk } from "@/lib/api"

function slugify(title: string) {
  return title.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/(^-|-$)/g, "")
}

export default function DocsPage() {
  const [search, setSearch] = useState("")

  // Load all entries (docs are meant to be read, not paginated)
  const { data, isLoading } = useQuery({
    queryKey: ["knowledge"],
    queryFn: () => api.getKnowledge(1, 200),
  })

  const filtered: KnowledgeChunk[] = (data?.chunks ?? []).filter((c) =>
    search
      ? c.title.toLowerCase().includes(search.toLowerCase()) ||
        c.content.toLowerCase().includes(search.toLowerCase())
      : true
  )

  const isEmpty = !isLoading && filtered.length === 0

  return (
    <div style={{ display: "flex", minHeight: "calc(100vh - 48px)" }}>

      {/* ── Sidebar TOC ─────────────────────────────────────────────── */}
      <aside
        style={{
          width: "220px",
          flexShrink: 0,
          borderRight: "1px solid #1e1e2e",
          padding: "32px 16px",
          position: "sticky",
          top: 0,
          height: "calc(100vh - 48px)",
          overflowY: "auto",
          display: filtered.length === 0 ? "none" : "block",
        }}
      >
        <p style={{ fontSize: "11px", fontWeight: 600, color: "#555570", textTransform: "uppercase", letterSpacing: "0.08em", marginBottom: "12px" }}>
          Contents
        </p>
        <nav style={{ display: "flex", flexDirection: "column", gap: "2px" }}>
          {filtered.map((chunk) => {
            const slug = slugify(chunk.title)
            return (
              <a
                key={chunk.id}
                href={`#${slug}`}
                style={{
                  fontSize: "13px",
                  color: "#8888aa",
                  textDecoration: "none",
                  padding: "4px 8px",
                  borderRadius: "4px",
                  lineHeight: 1.4,
                  display: "block",
                }}
                onMouseEnter={(e) => {
                  e.currentTarget.style.color = "#e2e2e9"
                  e.currentTarget.style.background = "#1e1e2e"
                }}
                onMouseLeave={(e) => {
                  e.currentTarget.style.color = "#8888aa"
                  e.currentTarget.style.background = "transparent"
                }}
              >
                {chunk.title}
              </a>
            )
          })}
        </nav>
      </aside>

      {/* ── Main content ────────────────────────────────────────────── */}
      <main style={{ flex: 1, padding: "40px 48px", maxWidth: "760px" }}>

        {/* Header */}
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "baseline", marginBottom: "28px" }}>
          <h1 style={{ fontSize: "22px", fontWeight: 700, color: "#e2e2e9", margin: 0 }}>
            Documentation
          </h1>
          {data && data.total > 0 && (
            <span style={{ fontSize: "12px", color: "#555570" }}>
              {data.total} {data.total === 1 ? "entry" : "entries"}
            </span>
          )}
        </div>

        {/* Search */}
        <input
          style={{
            width: "100%",
            background: "#1e1e2e",
            border: "1px solid #2a2a3a",
            borderRadius: "6px",
            padding: "8px 12px",
            fontSize: "14px",
            color: "#e2e2e9",
            outline: "none",
            marginBottom: "40px",
          }}
          placeholder="Search documentation…"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          onFocus={(e) => { e.currentTarget.style.borderColor = "#5b5bd6" }}
          onBlur={(e) => { e.currentTarget.style.borderColor = "#2a2a3a" }}
        />

        {/* States */}
        {isLoading && (
          <p style={{ color: "#555570", fontSize: "14px" }}>Loading…</p>
        )}
        {isEmpty && (
          <p style={{ color: "#555570", fontSize: "14px" }}>
            {search
              ? "No results."
              : "The knowledge base is empty. Answer pending questions to populate it."}
          </p>
        )}

        {/* Sections — no cards, just document sections */}
        <div>
          {filtered.map((chunk, i) => {
            const slug = slugify(chunk.title)
            return (
              <section
                key={chunk.id}
                id={slug}
                style={{
                  paddingTop: "8px",
                  paddingBottom: "36px",
                  borderBottom: i < filtered.length - 1 ? "1px solid #1e1e2e" : "none",
                  marginBottom: i < filtered.length - 1 ? "36px" : 0,
                  scrollMarginTop: "24px",
                }}
              >
                <h2
                  style={{
                    fontSize: "16px",
                    fontWeight: 600,
                    color: "#e2e2e9",
                    margin: "0 0 12px 0",
                    display: "flex",
                    alignItems: "center",
                    gap: "10px",
                  }}
                >
                  <span
                    style={{
                      width: "3px",
                      height: "16px",
                      background: "#5b5bd6",
                      borderRadius: "2px",
                      flexShrink: 0,
                      display: "inline-block",
                    }}
                  />
                  {chunk.title}
                </h2>
                <p
                  style={{
                    fontSize: "14px",
                    color: "#c4c4d4",
                    lineHeight: 1.8,
                    margin: 0,
                  }}
                >
                  {chunk.content}
                </p>
                <p style={{ fontSize: "12px", color: "#333345", margin: "12px 0 0 0" }}>
                  {new Date(chunk.created_at).toLocaleDateString("en-US", {
                    year: "numeric", month: "short", day: "numeric",
                  })}
                </p>
              </section>
            )
          })}
        </div>
      </main>
    </div>
  )
}
