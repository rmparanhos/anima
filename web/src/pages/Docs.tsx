import { useState, useRef, useCallback } from "react"
import { useQuery } from "@tanstack/react-query"
import ForceGraph2D from "react-force-graph-2d"
import { api, type KnowledgeChunk, type GraphNode, type ChunkPreview } from "@/lib/api"

// ── helpers ──────────────────────────────────────────────────────────────────

function slugify(s: string) {
  return s.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/(^-|-$)/g, "")
}

type GroupedByEntity = Record<string, { topic: string; chunks: KnowledgeChunk[] }>

function groupByEntity(chunks: KnowledgeChunk[]): GroupedByEntity {
  return chunks.reduce<GroupedByEntity>((acc, c) => {
    const entity = c.entity || c.title || "General"
    if (!acc[entity]) acc[entity] = { topic: c.topic, chunks: [] }
    acc[entity].chunks.push(c)
    return acc
  }, {})
}

const PALETTE = [
  "#5b5bd6", "#e04a6a", "#1fa67a", "#d97b27",
  "#8e45c9", "#2090d4", "#c9882a", "#3aaa7a",
  "#b84dc7", "#1cb8b8",
]

function entityColor(entity: string, entities: string[]): string {
  const idx = entities.indexOf(entity)
  return PALETTE[idx % PALETTE.length]
}

// ── ListView ─────────────────────────────────────────────────────────────────

function ListView({ chunks, search, setSearch, isLoading }: {
  chunks: KnowledgeChunk[]
  search: string
  setSearch: (s: string) => void
  isLoading: boolean
}) {
  const grouped = groupByEntity(chunks)
  const entities = Object.keys(grouped).sort()
  const isEmpty = !isLoading && chunks.length === 0

  return (
    <div style={{ display: "flex", flex: 1, minHeight: 0 }}>
      {/* Sidebar TOC */}
      {entities.length > 0 && (
        <aside style={{
          width: "220px", flexShrink: 0,
          borderRight: "1px solid #1e1e2e",
          padding: "28px 12px 28px 16px",
          position: "sticky", top: 0,
          height: "calc(100vh - 96px)", overflowY: "auto",
        }}>
          <p style={{ fontSize: "11px", fontWeight: 600, color: "#555570", textTransform: "uppercase", letterSpacing: "0.08em", margin: "0 0 12px 8px" }}>
            Entidades
          </p>
          {entities.map((entity) => (
            <div key={entity} style={{ marginBottom: "12px" }}>
              <a
                href={`#entity-${slugify(entity)}`}
                style={{ display: "block", fontSize: "12px", fontWeight: 600, color: "#8888aa", textDecoration: "none", padding: "3px 8px", borderRadius: "4px" }}
                onMouseEnter={(e) => { e.currentTarget.style.color = "#e2e2e9"; e.currentTarget.style.background = "#1e1e2e" }}
                onMouseLeave={(e) => { e.currentTarget.style.color = "#8888aa"; e.currentTarget.style.background = "transparent" }}
              >
                {entity}
              </a>
              {grouped[entity].chunks.map((chunk) => (
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

      {/* Main */}
      <main style={{ flex: 1, padding: "32px 48px", maxWidth: "760px", minWidth: 0, overflowY: "auto" }}>
        <input
          style={{
            width: "100%", background: "#1e1e2e", border: "1px solid #2a2a3a",
            borderRadius: "6px", padding: "8px 12px", fontSize: "14px",
            color: "#e2e2e9", outline: "none", marginBottom: "36px", boxSizing: "border-box",
          }}
          placeholder="Buscar entidade, título ou conteúdo…"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          onFocus={(e) => { e.currentTarget.style.borderColor = "#5b5bd6" }}
          onBlur={(e) => { e.currentTarget.style.borderColor = "#2a2a3a" }}
        />

        {isLoading && <p style={{ color: "#555570", fontSize: "14px" }}>Carregando…</p>}
        {isEmpty && (
          <p style={{ color: "#555570", fontSize: "14px" }}>
            {search ? "Nenhum resultado." : "Base de conhecimento vazia. Responda perguntas em /pending para populá-la."}
          </p>
        )}

        {entities.map((entity, ei) => {
          const { topic, chunks: entityChunks } = grouped[entity]
          return (
            <section key={entity} id={`entity-${slugify(entity)}`} style={{ marginBottom: ei < entities.length - 1 ? "56px" : 0, scrollMarginTop: "24px" }}>
              {/* Entity header */}
              <div style={{ marginBottom: "20px" }}>
                <h2 style={{ fontSize: "20px", fontWeight: 700, color: "#e2e2e9", margin: "0 0 4px 0" }}>
                  {entity}
                </h2>
                <span style={{
                  fontSize: "11px", fontWeight: 600, textTransform: "uppercase", letterSpacing: "0.07em",
                  color: "#5b5bd6", background: "#5b5bd622", padding: "2px 8px", borderRadius: "4px",
                }}>
                  {topic}
                </span>
              </div>
              <div style={{ borderLeft: "2px solid #2a2a3a", paddingLeft: "20px" }}>
                {entityChunks.map((chunk, ci) => (
                  <article
                    key={chunk.id}
                    id={slugify(chunk.title)}
                    style={{ paddingBottom: "24px", marginBottom: ci < entityChunks.length - 1 ? "24px" : 0, borderBottom: ci < entityChunks.length - 1 ? "1px solid #1e1e2e" : "none", scrollMarginTop: "24px" }}
                  >
                    <h3 style={{ fontSize: "14px", fontWeight: 600, color: "#c4c4d4", margin: "0 0 8px 0" }}>
                      {chunk.title}
                    </h3>
                    <p style={{ fontSize: "14px", color: "#9090a8", lineHeight: 1.8, margin: 0 }}>{chunk.content}</p>
                    <p style={{ fontSize: "11px", color: "#333345", margin: "8px 0 0 0" }}>
                      {new Date(chunk.created_at).toLocaleDateString("pt-BR", { year: "numeric", month: "short", day: "numeric" })}
                    </p>
                  </article>
                ))}
              </div>
            </section>
          )
        })}
      </main>
    </div>
  )
}

// ── GraphView ────────────────────────────────────────────────────────────────

function GraphView({ allEntities }: { allEntities: string[] }) {
  const [selected, setSelected] = useState<GraphNode | null>(null)
  const [selectedChunk, setSelectedChunk] = useState<ChunkPreview | null>(null)
  const containerRef = useRef<HTMLDivElement>(null)

  const { data, isLoading, isError } = useQuery({
    queryKey: ["knowledge-graph"],
    queryFn: () => api.getKnowledgeGraph(),
    staleTime: 60_000,
  })

  const handleNodeClick = useCallback((node: object) => {
    setSelected(node as GraphNode)
    setSelectedChunk(null)
  }, [])

  const graphEntities = data?.nodes.map((n) => n.entity) ?? []

  const nodeCanvasObject = useCallback(
    (node: object, ctx: CanvasRenderingContext2D, globalScale: number) => {
      const n = node as GraphNode & { x: number; y: number }
      const color = entityColor(n.entity, graphEntities)
      // Node radius scales with chunk count (more chunks = bigger node)
      const radius = 5 + Math.min(n.chunk_count * 2, 12)

      // Glow ring if selected
      if (selected?.id === n.id) {
        ctx.beginPath()
        ctx.arc(n.x, n.y, radius + 4, 0, 2 * Math.PI)
        ctx.fillStyle = color + "44"
        ctx.fill()
      }

      ctx.beginPath()
      ctx.arc(n.x, n.y, radius, 0, 2 * Math.PI)
      ctx.fillStyle = color
      ctx.fill()

      if (globalScale >= 0.7) {
        const label = n.entity.length > 22 ? n.entity.slice(0, 20) + "…" : n.entity
        ctx.font = `${Math.min(12, 10 / globalScale * 1.5)}px sans-serif`
        ctx.fillStyle = "#c4c4d4"
        ctx.textAlign = "center"
        ctx.fillText(label, n.x, n.y + radius + 9)
        if (n.chunk_count > 1 && globalScale >= 1) {
          ctx.font = `${Math.min(10, 8 / globalScale * 1.5)}px sans-serif`
          ctx.fillStyle = color + "aa"
          ctx.fillText(`${n.chunk_count} registros`, n.x, n.y + radius + 19)
        }
      }
    },
    [selected, graphEntities]
  )

  if (isLoading) return <div style={{ flex: 1, display: "flex", alignItems: "center", justifyContent: "center", color: "#555570", fontSize: "14px" }}>Construindo grafo…</div>
  if (isError) return <div style={{ flex: 1, display: "flex", alignItems: "center", justifyContent: "center", color: "#e04a6a", fontSize: "14px" }}>Falha ao carregar grafo.</div>
  if (!data || data.nodes.length === 0) return (
    <div style={{ flex: 1, display: "flex", alignItems: "center", justifyContent: "center", color: "#555570", fontSize: "14px" }}>
      Nenhuma entidade ainda — responda perguntas em /pending para popular o grafo.
    </div>
  )

  const panelOpen = !!selected
  const graphWidth = panelOpen
    ? (containerRef.current?.clientWidth ?? 900) - 320
    : (containerRef.current?.clientWidth ?? 900)

  return (
    <div ref={containerRef} style={{ flex: 1, display: "flex", minHeight: 0, overflow: "hidden" }}>
      {/* Canvas */}
      <div style={{ flex: 1, minWidth: 0, background: "#0d0d14" }}>
        <ForceGraph2D
          graphData={data}
          width={graphWidth}
          height={window.innerHeight - 96}
          backgroundColor="#0d0d14"
          nodeRelSize={5}
          linkColor={() => "#2a2a3a"}
          linkWidth={(link) => {
            const l = link as { value: number }
            return 0.5 + l.value * 2
          }}
          onNodeClick={handleNodeClick}
          nodeCanvasObject={nodeCanvasObject}
          nodePointerAreaPaint={(node, color, ctx) => {
            const n = node as GraphNode & { x: number; y: number }
            const r = 5 + Math.min(n.chunk_count * 2, 12) + 4
            ctx.fillStyle = color
            ctx.beginPath()
            ctx.arc(n.x, n.y, r, 0, 2 * Math.PI)
            ctx.fill()
          }}
          cooldownTicks={120}
          d3AlphaDecay={0.02}
          d3VelocityDecay={0.3}
        />
      </div>

      {/* Detail panel */}
      {selected && (
        <aside style={{
          width: "300px", flexShrink: 0, background: "#13131f",
          borderLeft: "1px solid #1e1e2e", display: "flex", flexDirection: "column",
          overflow: "hidden",
        }}>
          {/* Entity header */}
          <div style={{ padding: "20px 20px 16px", borderBottom: "1px solid #1e1e2e", flexShrink: 0 }}>
            <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: "10px" }}>
              <span style={{
                fontSize: "11px", fontWeight: 700, textTransform: "uppercase", letterSpacing: "0.08em",
                color: entityColor(selected.entity, graphEntities),
                background: entityColor(selected.entity, graphEntities) + "22",
                padding: "2px 8px", borderRadius: "4px",
              }}>
                {selected.topic}
              </span>
              <button
                onClick={() => { setSelected(null); setSelectedChunk(null) }}
                style={{ background: "none", border: "none", color: "#555570", cursor: "pointer", fontSize: "16px", lineHeight: 1 }}
                title="Fechar"
              >✕</button>
            </div>
            <h3 style={{ fontSize: "16px", fontWeight: 700, color: "#e2e2e9", margin: "0 0 6px 0" }}>{selected.entity}</h3>
            <p style={{ fontSize: "12px", color: "#555570", margin: 0 }}>
              {selected.chunk_count} {selected.chunk_count === 1 ? "registro" : "registros"}
            </p>
          </div>

          {/* Chunk list */}
          <div style={{ flex: 1, overflowY: "auto", padding: "12px 0" }}>
            {selected.chunks.map((chunk) => (
              <button
                key={chunk.id}
                onClick={() => setSelectedChunk(selectedChunk?.id === chunk.id ? null : chunk)}
                style={{
                  display: "block", width: "100%", textAlign: "left",
                  background: selectedChunk?.id === chunk.id ? "#1e1e2e" : "transparent",
                  border: "none", borderBottom: "1px solid #1a1a28",
                  padding: "12px 20px", cursor: "pointer",
                }}
                onMouseEnter={(e) => { if (selectedChunk?.id !== chunk.id) e.currentTarget.style.background = "#181825" }}
                onMouseLeave={(e) => { if (selectedChunk?.id !== chunk.id) e.currentTarget.style.background = "transparent" }}
              >
                <p style={{ fontSize: "13px", fontWeight: 500, color: "#c4c4d4", margin: "0 0 4px 0" }}>{chunk.title}</p>
                {selectedChunk?.id === chunk.id && (
                  <p style={{ fontSize: "12px", color: "#8888aa", lineHeight: 1.7, margin: 0 }}>{chunk.content}</p>
                )}
                {selectedChunk?.id !== chunk.id && (
                  <p style={{ fontSize: "12px", color: "#555570", margin: 0, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
                    {chunk.content.slice(0, 80)}…
                  </p>
                )}
              </button>
            ))}
          </div>
        </aside>
      )}
    </div>
  )
}

// ── Legend ────────────────────────────────────────────────────────────────────

function Legend({ entities }: { entities: string[] }) {
  return (
    <div style={{ display: "flex", flexWrap: "wrap", gap: "8px", padding: "8px 20px", borderTop: "1px solid #1e1e2e", background: "#0d0d14" }}>
      {entities.map((e) => (
        <span key={e} style={{ display: "flex", alignItems: "center", gap: "5px", fontSize: "11px", color: "#8888aa" }}>
          <span style={{ width: "8px", height: "8px", borderRadius: "50%", background: entityColor(e, entities), display: "inline-block", flexShrink: 0 }} />
          {e}
        </span>
      ))}
    </div>
  )
}

// ── Page ──────────────────────────────────────────────────────────────────────

type View = "list" | "graph"

export default function DocsPage() {
  const [view, setView] = useState<View>("list")
  const [search, setSearch] = useState("")

  const { data, isLoading } = useQuery({
    queryKey: ["knowledge"],
    queryFn: () => api.getKnowledge(1, 200),
  })

  const filtered: KnowledgeChunk[] = (data?.chunks ?? []).filter((c) =>
    search
      ? (c.entity ?? "").toLowerCase().includes(search.toLowerCase()) ||
        c.topic.toLowerCase().includes(search.toLowerCase()) ||
        c.title.toLowerCase().includes(search.toLowerCase()) ||
        c.content.toLowerCase().includes(search.toLowerCase())
      : true
  )

  const allEntities = Object.keys(groupByEntity(data?.chunks ?? [])).sort()

  return (
    <div style={{ display: "flex", flexDirection: "column", minHeight: "calc(100vh - 48px)" }}>

      {/* ── Toolbar ──────────────────────────────────────────────────── */}
      <div style={{
        display: "flex", alignItems: "center", justifyContent: "space-between",
        padding: "12px 24px", borderBottom: "1px solid #1e1e2e",
        background: "#13131f", flexShrink: 0,
      }}>
        <div style={{ display: "flex", alignItems: "baseline", gap: "12px" }}>
          <h1 style={{ fontSize: "18px", fontWeight: 700, color: "#e2e2e9", margin: 0 }}>Documentação</h1>
          {data && data.total > 0 && (
            <span style={{ fontSize: "12px", color: "#555570" }}>
              {allEntities.length} {allEntities.length === 1 ? "entidade" : "entidades"} · {data.total} {data.total === 1 ? "registro" : "registros"}
            </span>
          )}
        </div>

        {/* Toggle */}
        <div style={{ display: "flex", background: "#1e1e2e", borderRadius: "6px", padding: "2px", gap: "2px" }}>
          {(["list", "graph"] as View[]).map((v) => (
            <button
              key={v}
              onClick={() => setView(v)}
              style={{
                padding: "5px 14px", border: "none", borderRadius: "5px", cursor: "pointer",
                fontSize: "12px", fontWeight: 500,
                background: view === v ? "#5b5bd6" : "transparent",
                color: view === v ? "#fff" : "#8888aa",
                transition: "background 0.15s, color 0.15s",
              }}
            >
              {v === "list" ? "📄 Lista" : "🕸 Grafo"}
            </button>
          ))}
        </div>
      </div>

      {/* ── Content ──────────────────────────────────────────────────── */}
      <div style={{ flex: 1, display: "flex", flexDirection: "column", minHeight: 0 }}>
        {view === "list" ? (
          <ListView
            chunks={filtered}
            search={search}
            setSearch={setSearch}
            isLoading={isLoading}
          />
        ) : (
          <>
            <GraphView allEntities={allEntities} />
            {allEntities.length > 0 && <Legend entities={allEntities} />}
          </>
        )}
      </div>
    </div>
  )
}
