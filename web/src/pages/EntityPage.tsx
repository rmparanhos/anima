import { useParams, Link } from "react-router-dom"
import { useQuery } from "@tanstack/react-query"
import { api, type KnowledgeChunk } from "@/lib/api"

function groupByEntity(chunks: KnowledgeChunk[]): Record<string, KnowledgeChunk[]> {
  return chunks.reduce<Record<string, KnowledgeChunk[]>>((acc, c) => {
    const e = c.entity || c.title || "General"
    ;(acc[e] ??= []).push(c)
    return acc
  }, {})
}

function slugify(s: string) {
  return s.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/(^-|-$)/g, "")
}

export default function EntityPage() {
  const { entity: entityParam } = useParams<{ entity: string }>()
  const entityName = decodeURIComponent(entityParam ?? "")

  const { data, isLoading } = useQuery({
    queryKey: ["knowledge"],
    queryFn: () => api.getKnowledge(1, 200),
    staleTime: 60_000,
  })

  const allChunks = data?.chunks ?? []
  const grouped   = groupByEntity(allChunks)
  const chunks    = grouped[entityName] ?? []

  // Discover related entities: those whose topic matches
  const topic        = chunks[0]?.topic ?? ""
  const relatedNames = topic
    ? Object.entries(grouped)
        .filter(([name, cs]) => name !== entityName && cs[0]?.topic === topic)
        .map(([name]) => name)
        .slice(0, 5)
    : []

  if (isLoading) {
    return (
      <div style={{ padding: "48px", color: "#555570", fontSize: "14px" }}>
        Carregando…
      </div>
    )
  }

  if (chunks.length === 0) {
    return (
      <div style={{ padding: "48px" }}>
        <Link to="/docs" style={{ fontSize: "13px", color: "#5b5bd6", textDecoration: "none" }}>
          ← Documentação
        </Link>
        <p style={{ marginTop: "32px", color: "#555570", fontSize: "14px" }}>
          Entidade não encontrada.
        </p>
      </div>
    )
  }

  return (
    <div style={{ display: "flex", minHeight: "calc(100vh - 48px)" }}>

      {/* ── Sidebar ────────────────────────────────────────────────── */}
      <aside style={{
        width: "220px", flexShrink: 0,
        borderRight: "1px solid #1e1e2e",
        padding: "28px 12px 28px 16px",
        position: "sticky", top: 0,
        height: "calc(100vh - 48px)", overflowY: "auto",
        background: "#13131f",
      }}>
        <Link
          to="/docs"
          style={{ display: "flex", alignItems: "center", gap: "6px", fontSize: "12px", color: "#5b5bd6", textDecoration: "none", marginBottom: "28px" }}
        >
          ← Documentação
        </Link>

        <p style={{ fontSize: "11px", fontWeight: 600, color: "#555570", textTransform: "uppercase", letterSpacing: "0.08em", margin: "0 0 10px 8px" }}>
          Nesta página
        </p>
        {chunks.map((chunk) => (
          <a
            key={chunk.id}
            href={`#${slugify(chunk.title)}`}
            style={{ display: "block", fontSize: "12px", color: "#555570", textDecoration: "none", padding: "3px 8px", borderRadius: "4px", lineHeight: 1.5 }}
            onMouseEnter={(e) => { e.currentTarget.style.color = "#8888aa"; e.currentTarget.style.background = "#1e1e2e" }}
            onMouseLeave={(e) => { e.currentTarget.style.color = "#555570"; e.currentTarget.style.background = "transparent" }}
          >
            {chunk.title}
          </a>
        ))}

        {relatedNames.length > 0 && (
          <>
            <p style={{ fontSize: "11px", fontWeight: 600, color: "#555570", textTransform: "uppercase", letterSpacing: "0.08em", margin: "28px 0 10px 8px" }}>
              Relacionadas
            </p>
            {relatedNames.map((name) => (
              <Link
                key={name}
                to={`/docs/${encodeURIComponent(name)}`}
                style={{ display: "block", fontSize: "12px", color: "#555570", textDecoration: "none", padding: "3px 8px", borderRadius: "4px", lineHeight: 1.5 }}
                onMouseEnter={(e) => { e.currentTarget.style.color = "#8888aa"; e.currentTarget.style.background = "#1e1e2e" }}
                onMouseLeave={(e) => { e.currentTarget.style.color = "#555570"; e.currentTarget.style.background = "transparent" }}
              >
                {name}
              </Link>
            ))}
          </>
        )}
      </aside>

      {/* ── Main content ───────────────────────────────────────────── */}
      <main style={{ flex: 1, maxWidth: "760px", padding: "40px 56px", overflowY: "auto" }}>

        {/* Entity header */}
        <header style={{ marginBottom: "40px" }}>
          <div style={{ marginBottom: "10px" }}>
            <span style={{
              fontSize: "11px", fontWeight: 700, textTransform: "uppercase",
              letterSpacing: "0.08em", color: "#5b5bd6",
              background: "#5b5bd622", padding: "3px 10px", borderRadius: "4px",
            }}>
              {topic}
            </span>
          </div>
          <h1 style={{ fontSize: "28px", fontWeight: 700, color: "#e2e2e9", margin: "0 0 8px 0", lineHeight: 1.2 }}>
            {entityName}
          </h1>
          <p style={{ fontSize: "13px", color: "#555570", margin: 0 }}>
            {chunks.length} {chunks.length === 1 ? "registro" : "registros"}
          </p>
        </header>

        {/* Chunks */}
        <div style={{ display: "flex", flexDirection: "column", gap: "0" }}>
          {chunks.map((chunk, i) => (
            <article
              key={chunk.id}
              id={slugify(chunk.title)}
              style={{
                paddingTop:    i === 0 ? 0 : "36px",
                paddingBottom: "36px",
                borderBottom:  i < chunks.length - 1 ? "1px solid #1e1e2e" : "none",
                scrollMarginTop: "24px",
              }}
            >
              <div style={{ display: "flex", alignItems: "center", gap: "10px", marginBottom: "12px" }}>
                <span style={{ width: "3px", height: "18px", background: "#5b5bd6", borderRadius: "2px", flexShrink: 0, display: "inline-block" }} />
                <h2 style={{ fontSize: "16px", fontWeight: 600, color: "#e2e2e9", margin: 0 }}>
                  {chunk.title}
                </h2>
              </div>
              <p style={{ fontSize: "15px", color: "#9090a8", lineHeight: 1.85, margin: "0 0 12px 13px" }}>
                {chunk.content}
              </p>
              <p style={{ fontSize: "11px", color: "#2e2e42", margin: "0 0 0 13px" }}>
                {new Date(chunk.created_at).toLocaleDateString("pt-BR", {
                  year: "numeric", month: "long", day: "numeric",
                })}
              </p>
            </article>
          ))}
        </div>

      </main>
    </div>
  )
}
