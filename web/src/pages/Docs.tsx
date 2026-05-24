import { useState } from "react"
import { useQuery } from "@tanstack/react-query"
import { api, type KnowledgeChunk } from "@/lib/api"

function slugify(s: string) {
  return s.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/(^-|-$)/g, "")
}

type Grouped = Record<string, KnowledgeChunk[]>

function groupByTopic(chunks: KnowledgeChunk[]): Grouped {
  return chunks.reduce<Grouped>((acc, c) => {
    const topic = c.topic || "General"
    ;(acc[topic] ??= []).push(c)
    return acc
  }, {})
}

export default function DocsPage() {
  const [search, setSearch] = useState("")

  const { data, isLoading } = useQuery({
    queryKey: ["knowledge"],
    queryFn: () => api.getKnowledge(1, 200),
  })

  const filtered: KnowledgeChunk[] = (data?.chunks ?? []).filter((c) =>
    search
      ? c.topic.toLowerCase().includes(search.toLowerCase()) ||
        c.title.toLowerCase().includes(search.toLowerCase()) ||
        c.content.toLowerCase().includes(search.toLowerCase())
      : true
  )

  const grouped = groupByTopic(filtered)
  const topics = Object.keys(grouped).sort()
  const isEmpty = !isLoading && filtered.length === 0

  return (
    <div style={{ display: "flex", minHeight: "calc(100vh - 48px)" }}>

      {/* ── Sidebar TOC (2-level) ──────────────────────────────────── */}
      {topics.length > 0 && (
        <aside style={{
          width: "220px",
          flexShrink: 0,
          borderRight: "1px solid #1e1e2e",
          padding: "28px 12px 28px 16px",
          position: "sticky",
          top: 0,
          height: "calc(100vh - 48px)",
          overflowY: "auto",
        }}>
          <p style={{ fontSize: "11px", fontWeight: 600, color: "#555570", textTransform: "uppercase", letterSpacing: "0.08em", margin: "0 0 12px 8px" }}>
            Contents
          </p>
          {topics.map((topic) => (
            <div key={topic} style={{ marginBottom: "12px" }}>
              {/* Topic header link */}
              <a
                href={`#topic-${slugify(topic)}`}
                style={{ display: "block", fontSize: "12px", fontWeight: 600, color: "#8888aa", textDecoration: "none", padding: "3px 8px", borderRadius: "4px" }}
                onMouseEnter={(e) => { e.currentTarget.style.color = "#e2e2e9"; e.currentTarget.style.background = "#1e1e2e" }}
                onMouseLeave={(e) => { e.currentTarget.style.color = "#8888aa"; e.currentTarget.style.background = "transparent" }}
              >
                {topic}
              </a>
              {/* Entry links (indented) */}
              {grouped[topic].map((chunk) => (
                <a
                  key={chunk.id}
                  href={`#${slugify(chunk.title)}`}
                  style={{ display: "block", fontSize: "12px", color: "#555570", textDecoration: "none", padding: "2px 8px 2px 16px", borderRadius: "4px", lineHeight: 1.4 }}
                  onMouseEnter={(e) => { e.currentTarget.style.color = "#8888aa"; e.currentTarget.style.background = "#1e1e2e" }}
                  onMouseLeave={(e) => { e.currentTarget.style.color = "#555570"; e.currentTarget.style.background = "transparent" }}
                >
                  {chunk.title}
                </a>
              ))}
            </div>
          ))}
        </aside>
      )}

      {/* ── Main content ─────────────────────────────────────────────── */}
      <main style={{ flex: 1, padding: "40px 48px", maxWidth: "760px", minWidth: 0 }}>

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
            width: "100%", background: "#1e1e2e", border: "1px solid #2a2a3a",
            borderRadius: "6px", padding: "8px 12px", fontSize: "14px",
            color: "#e2e2e9", outline: "none", marginBottom: "40px",
          }}
          placeholder="Search documentation…"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          onFocus={(e) => { e.currentTarget.style.borderColor = "#5b5bd6" }}
          onBlur={(e) => { e.currentTarget.style.borderColor = "#2a2a3a" }}
        />

        {isLoading && <p style={{ color: "#555570", fontSize: "14px" }}>Loading…</p>}
        {isEmpty && (
          <p style={{ color: "#555570", fontSize: "14px" }}>
            {search
              ? "No results."
              : "The knowledge base is empty. Answer pending questions to populate it."}
          </p>
        )}

        {/* Topics → entries (2-level hierarchy) */}
        {topics.map((topic, ti) => (
          <section
            key={topic}
            id={`topic-${slugify(topic)}`}
            style={{
              marginBottom: ti < topics.length - 1 ? "48px" : 0,
              scrollMarginTop: "24px",
            }}
          >
            {/* Topic heading */}
            <h2 style={{
              fontSize: "13px", fontWeight: 700, color: "#5b5bd6",
              textTransform: "uppercase", letterSpacing: "0.07em",
              margin: "0 0 20px 0", paddingBottom: "8px",
              borderBottom: "1px solid #2a2a3a",
            }}>
              {topic}
            </h2>

            {/* Entries within this topic */}
            {grouped[topic].map((chunk, ci) => (
              <article
                key={chunk.id}
                id={slugify(chunk.title)}
                style={{
                  paddingBottom: "28px",
                  marginBottom: ci < grouped[topic].length - 1 ? "28px" : 0,
                  borderBottom: ci < grouped[topic].length - 1 ? "1px solid #1e1e2e" : "none",
                  scrollMarginTop: "24px",
                }}
              >
                <h3 style={{
                  fontSize: "15px", fontWeight: 600, color: "#e2e2e9",
                  margin: "0 0 10px 0", display: "flex", alignItems: "center", gap: "8px",
                }}>
                  <span style={{ width: "3px", height: "15px", background: "#5b5bd6", borderRadius: "2px", flexShrink: 0, display: "inline-block" }} />
                  {chunk.title}
                </h3>
                <p style={{ fontSize: "14px", color: "#c4c4d4", lineHeight: 1.8, margin: 0 }}>
                  {chunk.content}
                </p>
                <p style={{ fontSize: "11px", color: "#333345", margin: "10px 0 0 0" }}>
                  {new Date(chunk.created_at).toLocaleDateString("en-US", { year: "numeric", month: "short", day: "numeric" })}
                </p>
              </article>
            ))}
          </section>
        ))}
      </main>
    </div>
  )
}
