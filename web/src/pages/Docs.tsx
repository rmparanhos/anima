import { useState, useRef, useCallback } from "react"
import { useQuery } from "@tanstack/react-query"
import ForceGraph2D from "react-force-graph-2d"
import { api, type KnowledgeChunk, type GraphNode } from "@/lib/api"

// ── helpers ──────────────────────────────────────────────────────────────────

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

// Deterministic colour per topic (same topic → same colour across renders)
const PALETTE = [
  "#5b5bd6", "#e04a6a", "#1fa67a", "#d97b27",
  "#8e45c9", "#2090d4", "#c9882a", "#3aaa7a",
]
function topicColor(topic: string, topics: string[]): string {
  const idx = topics.indexOf(topic)
  return PALETTE[idx % PALETTE.length]
}

// ── ListView ─────────────────────────────────────────────────────────────────

function ListView({ chunks, search, setSearch, total, isLoading }: {
  chunks: KnowledgeChunk[]
  search: string
  setSearch: (s: string) => void
  total: number
  isLoading: boolean
}) {
  const grouped = groupByTopic(chunks)
  const topics = Object.keys(grouped).sort()
  const isEmpty = !isLoading && chunks.length === 0

  return (
    <div style={{ display: "flex", flex: 1, minHeight: 0 }}>
      {/* Sidebar TOC */}
      {topics.length > 0 && (
        <aside style={{
          width: "220px", flexShrink: 0,
          borderRight: "1px solid #1e1e2e",
          padding: "28px 12px 28px 16px",
          position: "sticky", top: 0,
          height: "calc(100vh - 96px)", overflowY: "auto",
        }}>
          <p style={{ fontSize: "11px", fontWeight: 600, color: "#555570", textTransform: "uppercase", letterSpacing: "0.08em", margin: "0 0 12px 8px" }}>
            Contents
          </p>
          {topics.map((topic) => (
            <div key={topic} style={{ marginBottom: "12px" }}>
              <a
                href={`#topic-${slugify(topic)}`}
                style={{ display: "block", fontSize: "12px", fontWeight: 600, color: "#8888aa", textDecoration: "none", padding: "3px 8px", borderRadius: "4px" }}
                onMouseEnter={(e) => { e.currentTarget.style.color = "#e2e2e9"; e.currentTarget.style.background = "#1e1e2e" }}
                onMouseLeave={(e) => { e.currentTarget.style.color = "#8888aa"; e.currentTarget.style.background = "transparent" }}
              >
                {topic}
              </a>
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

      {/* Main */}
      <main style={{ flex: 1, padding: "32px 48px", maxWidth: "760px", minWidth: 0, overflowY: "auto" }}>
        <input
          style={{
            width: "100%", background: "#1e1e2e", border: "1px solid #2a2a3a",
            borderRadius: "6px", padding: "8px 12px", fontSize: "14px",
            color: "#e2e2e9", outline: "none", marginBottom: "36px", boxSizing: "border-box",
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
            {search ? "No results." : "The knowledge base is empty. Answer pending questions to populate it."}
          </p>
        )}

        {topics.map((topic, ti) => (
          <section key={topic} id={`topic-${slugify(topic)}`} style={{ marginBottom: ti < topics.length - 1 ? "48px" : 0, scrollMarginTop: "24px" }}>
            <h2 style={{ fontSize: "13px", fontWeight: 700, color: "#5b5bd6", textTransform: "uppercase", letterSpacing: "0.07em", margin: "0 0 20px 0", paddingBottom: "8px", borderBottom: "1px solid #2a2a3a" }}>
              {topic}
            </h2>
            {grouped[topic].map((chunk, ci) => (
              <article
                key={chunk.id}
                id={slugify(chunk.title)}
                style={{ paddingBottom: "28px", marginBottom: ci < grouped[topic].length - 1 ? "28px" : 0, borderBottom: ci < grouped[topic].length - 1 ? "1px solid #1e1e2e" : "none", scrollMarginTop: "24px" }}
              >
                <h3 style={{ fontSize: "15px", fontWeight: 600, color: "#e2e2e9", margin: "0 0 10px 0", display: "flex", alignItems: "center", gap: "8px" }}>
                  <span style={{ width: "3px", height: "15px", background: "#5b5bd6", borderRadius: "2px", flexShrink: 0, display: "inline-block" }} />
                  {chunk.title}
                </h3>
                <p style={{ fontSize: "14px", color: "#c4c4d4", lineHeight: 1.8, margin: 0 }}>{chunk.content}</p>
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

// ── GraphView ────────────────────────────────────────────────────────────────

function GraphView({ topics: allTopics }: { topics: string[] }) {
  const [selected, setSelected] = useState<GraphNode | null>(null)
  const containerRef = useRef<HTMLDivElement>(null)

  const { data, isLoading, isError } = useQuery({
    queryKey: ["knowledge-graph"],
    queryFn: () => api.getKnowledgeGraph(),
    staleTime: 60_000,
  })

  const handleNodeClick = useCallback((node: object) => {
    setSelected(node as GraphNode)
  }, [])

  const nodeCanvasObject = useCallback(
    (node: object, ctx: CanvasRenderingContext2D, globalScale: number) => {
      const n = node as GraphNode & { x: number; y: number }
      const color = topicColor(n.topic, allTopics)
      const radius = 5 + (1 / globalScale) * 2

      // Glow ring if selected
      if (selected?.id === n.id) {
        ctx.beginPath()
        ctx.arc(n.x, n.y, radius + 3, 0, 2 * Math.PI)
        ctx.fillStyle = color + "44"
        ctx.fill()
      }

      // Node circle
      ctx.beginPath()
      ctx.arc(n.x, n.y, radius, 0, 2 * Math.PI)
      ctx.fillStyle = color
      ctx.fill()

      // Label (only show at a reasonable zoom)
      if (globalScale >= 0.8) {
        const label = n.title.length > 22 ? n.title.slice(0, 20) + "…" : n.title
        ctx.font = `${Math.min(12, 10 / globalScale * 1.5)}px sans-serif`
        ctx.fillStyle = "#c4c4d4"
        ctx.textAlign = "center"
        ctx.fillText(label, n.x, n.y + radius + 8)
      }
    },
    [selected, allTopics]
  )

  if (isLoading) return <div style={{ flex: 1, display: "flex", alignItems: "center", justifyContent: "center", color: "#555570", fontSize: "14px" }}>Building graph…</div>
  if (isError) return <div style={{ flex: 1, display: "flex", alignItems: "center", justifyContent: "center", color: "#e04a6a", fontSize: "14px" }}>Failed to load graph.</div>
  if (!data || data.nodes.length === 0) return (
    <div style={{ flex: 1, display: "flex", alignItems: "center", justifyContent: "center", color: "#555570", fontSize: "14px" }}>
      No knowledge chunks yet — answer pending questions to populate the graph.
    </div>
  )

  const width = selected
    ? (containerRef.current?.clientWidth ?? 900) - 320
    : (containerRef.current?.clientWidth ?? 900)

  return (
    <div ref={containerRef} style={{ flex: 1, display: "flex", minHeight: 0, overflow: "hidden" }}>
      {/* Canvas */}
      <div style={{ flex: 1, minWidth: 0, background: "#0d0d14" }}>
        <ForceGraph2D
          graphData={data}
          width={width}
          height={window.innerHeight - 96}
          backgroundColor="#0d0d14"
          nodeRelSize={5}
          linkColor={() => "#2a2a3a"}
          linkWidth={(link) => {
            const l = link as { value: number }
            return 0.5 + l.value * 1.5
          }}
          onNodeClick={handleNodeClick}
          nodeCanvasObject={nodeCanvasObject}
          nodePointerAreaPaint={(node, color, ctx) => {
            const n = node as { x: number; y: number }
            ctx.fillStyle = color
            ctx.beginPath()
            ctx.arc(n.x, n.y, 8, 0, 2 * Math.PI)
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
          borderLeft: "1px solid #1e1e2e", padding: "24px 20px",
          overflowY: "auto", display: "flex", flexDirection: "column", gap: "12px",
        }}>
          <button
            onClick={() => setSelected(null)}
            style={{ alignSelf: "flex-end", background: "none", border: "none", color: "#555570", cursor: "pointer", fontSize: "16px", lineHeight: 1 }}
            title="Close"
          >✕</button>

          <span style={{
            fontSize: "11px", fontWeight: 700, textTransform: "uppercase", letterSpacing: "0.08em",
            color: topicColor(selected.topic, allTopics), background: topicColor(selected.topic, allTopics) + "22",
            padding: "2px 8px", borderRadius: "4px", alignSelf: "flex-start",
          }}>
            {selected.topic}
          </span>

          <h3 style={{ fontSize: "15px", fontWeight: 600, color: "#e2e2e9", margin: 0 }}>{selected.title}</h3>

          <p style={{ fontSize: "13px", color: "#9090a8", lineHeight: 1.75, margin: 0 }}>{selected.content}</p>
        </aside>
      )}
    </div>
  )
}

// ── Legend ────────────────────────────────────────────────────────────────────

function Legend({ topics }: { topics: string[] }) {
  return (
    <div style={{ display: "flex", flexWrap: "wrap", gap: "8px", padding: "8px 20px", borderTop: "1px solid #1e1e2e", background: "#0d0d14" }}>
      {topics.map((t) => (
        <span key={t} style={{ display: "flex", alignItems: "center", gap: "5px", fontSize: "11px", color: "#8888aa" }}>
          <span style={{ width: "8px", height: "8px", borderRadius: "50%", background: topicColor(t, topics), display: "inline-block", flexShrink: 0 }} />
          {t}
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
      ? c.topic.toLowerCase().includes(search.toLowerCase()) ||
        c.title.toLowerCase().includes(search.toLowerCase()) ||
        c.content.toLowerCase().includes(search.toLowerCase())
      : true
  )

  const allTopics = Object.keys(groupByTopic(data?.chunks ?? [])).sort()

  return (
    <div style={{ display: "flex", flexDirection: "column", minHeight: "calc(100vh - 48px)" }}>

      {/* ── Toolbar ──────────────────────────────────────────────────── */}
      <div style={{
        display: "flex", alignItems: "center", justifyContent: "space-between",
        padding: "12px 24px", borderBottom: "1px solid #1e1e2e",
        background: "#13131f", flexShrink: 0,
      }}>
        <div style={{ display: "flex", alignItems: "baseline", gap: "12px" }}>
          <h1 style={{ fontSize: "18px", fontWeight: 700, color: "#e2e2e9", margin: 0 }}>Documentation</h1>
          {data && data.total > 0 && (
            <span style={{ fontSize: "12px", color: "#555570" }}>
              {data.total} {data.total === 1 ? "entry" : "entries"}
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
              {v === "list" ? "📄 List" : "🕸 Graph"}
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
            total={data?.total ?? 0}
            isLoading={isLoading}
          />
        ) : (
          <>
            <GraphView topics={allTopics} />
            {allTopics.length > 0 && <Legend topics={allTopics} />}
          </>
        )}
      </div>
    </div>
  )
}
