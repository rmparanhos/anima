import { useState, useCallback } from "react"
import { useNavigate } from "react-router-dom"
import { useQuery } from "@tanstack/react-query"
import ForceGraph2D from "react-force-graph-2d"
import { api, type KnowledgeChunk, type GraphNode } from "@/lib/api"

// ── helpers ──────────────────────────────────────────────────────────────────

type EntityGroup = { topic: string; chunks: KnowledgeChunk[] }

function groupByEntity(chunks: KnowledgeChunk[]): Record<string, EntityGroup> {
  return chunks.reduce<Record<string, EntityGroup>>((acc, c) => {
    const e = c.entity || c.title || "General"
    if (!acc[e]) acc[e] = { topic: c.topic, chunks: [] }
    acc[e].chunks.push(c)
    return acc
  }, {})
}

const PALETTE = [
  "#5b5bd6", "#e04a6a", "#1fa67a", "#d97b27",
  "#8e45c9", "#2090d4", "#c9882a", "#3aaa7a",
  "#b84dc7", "#1cb8b8",
]

function entityColor(entity: string, entities: string[]) {
  return PALETTE[entities.indexOf(entity) % PALETTE.length]
}

// ── IndexView — entity cards ──────────────────────────────────────────────────

function IndexView({ chunks, search, setSearch, isLoading }: {
  chunks: KnowledgeChunk[]
  search: string
  setSearch: (s: string) => void
  isLoading: boolean
}) {
  const navigate = useNavigate()
  const grouped  = groupByEntity(chunks)
  const entities = Object.keys(grouped).sort()
  const allEntities = entities  // for colour palette (stable index)

  return (
    <div style={{ flex: 1, padding: "32px 40px", overflowY: "auto" }}>
      <input
        style={{
          width: "100%", maxWidth: "480px", background: "#1e1e2e",
          border: "1px solid #2a2a3a", borderRadius: "6px",
          padding: "8px 12px", fontSize: "14px", color: "#e2e2e9",
          outline: "none", marginBottom: "32px", boxSizing: "border-box",
        }}
        placeholder="Buscar entidade…"
        value={search}
        onChange={(e) => setSearch(e.target.value)}
        onFocus={(e) => { e.currentTarget.style.borderColor = "#5b5bd6" }}
        onBlur={(e)  => { e.currentTarget.style.borderColor = "#2a2a3a" }}
      />

      {isLoading && <p style={{ color: "#555570", fontSize: "14px" }}>Carregando…</p>}

      {!isLoading && entities.length === 0 && (
        <p style={{ color: "#555570", fontSize: "14px" }}>
          {search
            ? "Nenhuma entidade encontrada."
            : "Base de conhecimento vazia. Responda perguntas em /pending para populá-la."}
        </p>
      )}

      {/* Grid of entity cards */}
      <div style={{
        display: "grid",
        gridTemplateColumns: "repeat(auto-fill, minmax(280px, 1fr))",
        gap: "16px",
      }}>
        {entities.map((entity) => {
          const { topic, chunks: entityChunks } = grouped[entity]
          const color   = entityColor(entity, allEntities)
          const preview = entityChunks[0]?.content ?? ""

          return (
            <button
              key={entity}
              onClick={() => navigate(`/docs/${encodeURIComponent(entity)}`)}
              style={{
                background: "#13131f", border: `1px solid #1e1e2e`,
                borderRadius: "10px", padding: "20px 22px",
                textAlign: "left", cursor: "pointer",
                transition: "border-color 0.15s, transform 0.1s",
                display: "flex", flexDirection: "column", gap: "10px",
              }}
              onMouseEnter={(e) => {
                e.currentTarget.style.borderColor = color
                e.currentTarget.style.transform = "translateY(-2px)"
              }}
              onMouseLeave={(e) => {
                e.currentTarget.style.borderColor = "#1e1e2e"
                e.currentTarget.style.transform = "translateY(0)"
              }}
            >
              {/* Top row: colour dot + topic badge */}
              <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between" }}>
                <span style={{
                  width: "10px", height: "10px", borderRadius: "50%",
                  background: color, flexShrink: 0, display: "inline-block",
                }} />
                <span style={{
                  fontSize: "10px", fontWeight: 700, textTransform: "uppercase",
                  letterSpacing: "0.07em", color: color,
                  background: color + "22", padding: "2px 7px", borderRadius: "4px",
                }}>
                  {topic}
                </span>
              </div>

              {/* Entity name */}
              <h3 style={{ fontSize: "15px", fontWeight: 700, color: "#e2e2e9", margin: 0, lineHeight: 1.3 }}>
                {entity}
              </h3>

              {/* Preview */}
              <p style={{
                fontSize: "12px", color: "#666680", lineHeight: 1.6, margin: 0,
                display: "-webkit-box", WebkitLineClamp: 3,
                WebkitBoxOrient: "vertical", overflow: "hidden",
              }}>
                {preview}
              </p>

              {/* Footer: chunk count */}
              <p style={{ fontSize: "11px", color: "#333345", margin: 0 }}>
                {entityChunks.length} {entityChunks.length === 1 ? "registro" : "registros"}
              </p>
            </button>
          )
        })}
      </div>
    </div>
  )
}

// ── GraphView ────────────────────────────────────────────────────────────────

function GraphView({ allEntities }: { allEntities: string[] }) {
  const navigate  = useNavigate()
  const [hovered, setHovered] = useState<GraphNode | null>(null)

  const { data, isLoading, isError } = useQuery({
    queryKey: ["knowledge-graph"],
    queryFn:  () => api.getKnowledgeGraph(),
    staleTime: 60_000,
  })

  const graphEntities = data?.nodes.map((n) => n.entity) ?? []

  const nodeCanvasObject = useCallback(
    (node: object, ctx: CanvasRenderingContext2D, globalScale: number) => {
      const n      = node as GraphNode & { x: number; y: number }
      const color  = entityColor(n.entity, graphEntities)
      const radius = 6 + Math.min(n.chunk_count * 2, 14)
      const isHov  = hovered?.id === n.id

      if (isHov) {
        ctx.beginPath()
        ctx.arc(n.x, n.y, radius + 5, 0, 2 * Math.PI)
        ctx.fillStyle = color + "33"
        ctx.fill()
      }

      ctx.beginPath()
      ctx.arc(n.x, n.y, radius, 0, 2 * Math.PI)
      ctx.fillStyle = isHov ? color : color + "cc"
      ctx.fill()

      if (globalScale >= 0.65) {
        const label = n.entity.length > 22 ? n.entity.slice(0, 20) + "…" : n.entity
        const fs    = Math.min(13, 10 / globalScale * 1.5)
        ctx.font      = `${fs}px sans-serif`
        ctx.fillStyle = isHov ? "#e2e2e9" : "#9090a8"
        ctx.textAlign = "center"
        ctx.fillText(label, n.x, n.y + radius + 10)
        if (n.chunk_count > 1 && globalScale >= 1) {
          ctx.font      = `${Math.max(8, fs - 2)}px sans-serif`
          ctx.fillStyle = color + "99"
          ctx.fillText(`${n.chunk_count} registros`, n.x, n.y + radius + 21)
        }
      }
    },
    [hovered, graphEntities]
  )

  if (isLoading) return <div style={{ flex: 1, display: "flex", alignItems: "center", justifyContent: "center", color: "#555570" }}>Construindo grafo…</div>
  if (isError)   return <div style={{ flex: 1, display: "flex", alignItems: "center", justifyContent: "center", color: "#e04a6a" }}>Falha ao carregar grafo.</div>
  if (!data || data.nodes.length === 0) return (
    <div style={{ flex: 1, display: "flex", alignItems: "center", justifyContent: "center", color: "#555570" }}>
      Nenhuma entidade ainda.
    </div>
  )

  return (
    <div style={{ flex: 1, background: "#0d0d14", position: "relative" }}>
      <ForceGraph2D
        graphData={data}
        width={window.innerWidth}
        height={window.innerHeight - 96}
        backgroundColor="#0d0d14"
        linkColor={() => "#2a2a3a"}
        linkWidth={(l) => 0.5 + (l as { value: number }).value * 2}
        onNodeClick={(node) => navigate(`/docs/${encodeURIComponent((node as GraphNode).entity)}`)}
        onNodeHover={(node) => setHovered(node ? (node as GraphNode) : null)}
        nodeCanvasObject={nodeCanvasObject}
        nodePointerAreaPaint={(node, color, ctx) => {
          const n = node as GraphNode & { x: number; y: number }
          const r = 6 + Math.min(n.chunk_count * 2, 14) + 5
          ctx.fillStyle = color
          ctx.beginPath()
          ctx.arc(n.x, n.y, r, 0, 2 * Math.PI)
          ctx.fill()
        }}
        cooldownTicks={120}
        d3AlphaDecay={0.02}
        d3VelocityDecay={0.3}
      />

      {/* Hover tooltip */}
      {hovered && (
        <div style={{
          position: "absolute", bottom: "48px", left: "50%",
          transform: "translateX(-50%)",
          background: "#13131f", border: `1px solid ${entityColor(hovered.entity, graphEntities)}44`,
          borderRadius: "8px", padding: "10px 16px",
          pointerEvents: "none", maxWidth: "320px", textAlign: "center",
        }}>
          <p style={{ fontSize: "13px", fontWeight: 600, color: "#e2e2e9", margin: "0 0 4px 0" }}>
            {hovered.entity}
          </p>
          <p style={{ fontSize: "11px", color: "#555570", margin: 0 }}>
            {hovered.chunk_count} {hovered.chunk_count === 1 ? "registro" : "registros"} · clique para abrir
          </p>
        </div>
      )}
    </div>
  )
}

// ── Legend ────────────────────────────────────────────────────────────────────

function Legend({ entities }: { entities: string[] }) {
  const navigate = useNavigate()
  return (
    <div style={{ display: "flex", flexWrap: "wrap", gap: "8px", padding: "8px 20px", borderTop: "1px solid #1e1e2e", background: "#0d0d14" }}>
      {entities.map((e) => (
        <button
          key={e}
          onClick={() => navigate(`/docs/${encodeURIComponent(e)}`)}
          style={{ display: "flex", alignItems: "center", gap: "5px", fontSize: "11px", color: "#8888aa", background: "none", border: "none", cursor: "pointer", padding: "2px 4px" }}
          onMouseEnter={(ev) => { ev.currentTarget.style.color = "#c4c4d4" }}
          onMouseLeave={(ev) => { ev.currentTarget.style.color = "#8888aa" }}
        >
          <span style={{ width: "8px", height: "8px", borderRadius: "50%", background: entityColor(e, entities), display: "inline-block", flexShrink: 0 }} />
          {e}
        </button>
      ))}
    </div>
  )
}

// ── Page ──────────────────────────────────────────────────────────────────────

type View = "cards" | "graph"

export default function DocsPage() {
  const [view, setView]     = useState<View>("cards")
  const [search, setSearch] = useState("")

  const { data, isLoading } = useQuery({
    queryKey:  ["knowledge"],
    queryFn:   () => api.getKnowledge(1, 200),
    staleTime: 60_000,
  })

  const filtered = (data?.chunks ?? []).filter((c) =>
    search
      ? (c.entity ?? "").toLowerCase().includes(search.toLowerCase()) ||
        c.topic.toLowerCase().includes(search.toLowerCase()) ||
        c.content.toLowerCase().includes(search.toLowerCase())
      : true
  )

  const allEntities = Object.keys(groupByEntity(data?.chunks ?? [])).sort()

  return (
    <div style={{ display: "flex", flexDirection: "column", minHeight: "calc(100vh - 48px)" }}>

      {/* Toolbar */}
      <div style={{
        display: "flex", alignItems: "center", justifyContent: "space-between",
        padding: "12px 24px", borderBottom: "1px solid #1e1e2e",
        background: "#13131f", flexShrink: 0,
      }}>
        <div style={{ display: "flex", alignItems: "baseline", gap: "12px" }}>
          <h1 style={{ fontSize: "18px", fontWeight: 700, color: "#e2e2e9", margin: 0 }}>
            Documentação
          </h1>
          {data && data.total > 0 && (
            <span style={{ fontSize: "12px", color: "#555570" }}>
              {allEntities.length} {allEntities.length === 1 ? "entidade" : "entidades"} · {data.total} {data.total === 1 ? "registro" : "registros"}
            </span>
          )}
        </div>

        <div style={{ display: "flex", background: "#1e1e2e", borderRadius: "6px", padding: "2px", gap: "2px" }}>
          {(["cards", "graph"] as View[]).map((v) => (
            <button
              key={v}
              onClick={() => setView(v)}
              style={{
                padding: "5px 14px", border: "none", borderRadius: "5px", cursor: "pointer",
                fontSize: "12px", fontWeight: 500,
                background: view === v ? "#5b5bd6" : "transparent",
                color:      view === v ? "#fff"    : "#8888aa",
                transition: "background 0.15s, color 0.15s",
              }}
            >
              {v === "cards" ? "▦ Cards" : "🕸 Grafo"}
            </button>
          ))}
        </div>
      </div>

      {/* Content */}
      <div style={{ flex: 1, display: "flex", flexDirection: "column", minHeight: 0 }}>
        {view === "cards" ? (
          <IndexView
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
