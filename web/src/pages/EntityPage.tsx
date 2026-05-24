import { useState } from "react"
import { useParams, Link } from "react-router-dom"
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query"
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

// ── Inline chunk editor ───────────────────────────────────────────────────────

function ChunkEditor({
  chunk,
  onCancel,
  onSaved,
}: {
  chunk: KnowledgeChunk
  onCancel: () => void
  onSaved: (updated: KnowledgeChunk) => void
}) {
  const [title,   setTitle]   = useState(chunk.title)
  const [entity,  setEntity]  = useState(chunk.entity)
  const [content, setContent] = useState(chunk.content)

  const mutation = useMutation({
    mutationFn: () => api.updateChunk(chunk.id, { content, title, entity }),
    onSuccess:  (updated) => onSaved(updated),
  })

  const isDirty =
    title.trim()   !== chunk.title   ||
    entity.trim()  !== chunk.entity  ||
    content.trim() !== chunk.content

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: "12px" }}>

      {/* Entity field */}
      <label style={{ display: "flex", flexDirection: "column", gap: "4px" }}>
        <span style={{ fontSize: "11px", fontWeight: 600, color: "#555570", textTransform: "uppercase", letterSpacing: "0.07em" }}>
          Entidade
        </span>
        <input
          value={entity}
          onChange={(e) => setEntity(e.target.value)}
          style={{
            background: "#1a1a2a", border: "1px solid #2a2a3a", borderRadius: "6px",
            padding: "7px 10px", fontSize: "14px", color: "#e2e2e9", outline: "none",
          }}
          onFocus={(e)  => { e.currentTarget.style.borderColor = "#5b5bd6" }}
          onBlur={(e)   => { e.currentTarget.style.borderColor = "#2a2a3a" }}
        />
      </label>

      {/* Title field */}
      <label style={{ display: "flex", flexDirection: "column", gap: "4px" }}>
        <span style={{ fontSize: "11px", fontWeight: 600, color: "#555570", textTransform: "uppercase", letterSpacing: "0.07em" }}>
          Título
        </span>
        <input
          value={title}
          onChange={(e) => setTitle(e.target.value)}
          style={{
            background: "#1a1a2a", border: "1px solid #2a2a3a", borderRadius: "6px",
            padding: "7px 10px", fontSize: "14px", color: "#e2e2e9", outline: "none",
          }}
          onFocus={(e)  => { e.currentTarget.style.borderColor = "#5b5bd6" }}
          onBlur={(e)   => { e.currentTarget.style.borderColor = "#2a2a3a" }}
        />
      </label>

      {/* Content field */}
      <label style={{ display: "flex", flexDirection: "column", gap: "4px" }}>
        <span style={{ fontSize: "11px", fontWeight: 600, color: "#555570", textTransform: "uppercase", letterSpacing: "0.07em" }}>
          Conteúdo
        </span>
        <textarea
          value={content}
          rows={6}
          onChange={(e) => setContent(e.target.value)}
          style={{
            background: "#1a1a2a", border: "1px solid #2a2a3a", borderRadius: "6px",
            padding: "8px 10px", fontSize: "14px", color: "#e2e2e9",
            outline: "none", resize: "vertical", lineHeight: 1.75,
            fontFamily: "inherit",
          }}
          onFocus={(e)  => { e.currentTarget.style.borderColor = "#5b5bd6" }}
          onBlur={(e)   => { e.currentTarget.style.borderColor = "#2a2a3a" }}
        />
      </label>

      {/* Error */}
      {mutation.isError && (
        <p style={{ fontSize: "12px", color: "#e04a6a", margin: 0 }}>
          ✗ {(mutation.error as Error)?.message ?? "Erro ao salvar."}
        </p>
      )}

      {/* Actions */}
      <div style={{ display: "flex", gap: "8px", alignItems: "center" }}>
        <button
          onClick={() => mutation.mutate()}
          disabled={!isDirty || mutation.isPending || !content.trim() || !title.trim()}
          style={{
            background: "#5b5bd6", color: "#fff", border: "none",
            borderRadius: "6px", padding: "7px 16px",
            fontSize: "13px", fontWeight: 600,
            cursor: (!isDirty || mutation.isPending) ? "not-allowed" : "pointer",
            opacity: (!isDirty || mutation.isPending) ? 0.5 : 1,
            display: "flex", alignItems: "center", gap: "6px",
          }}
        >
          {mutation.isPending && <Spinner />}
          {mutation.isPending ? "Salvando…" : "Salvar"}
        </button>
        <button
          onClick={onCancel}
          disabled={mutation.isPending}
          style={{ background: "transparent", border: "none", fontSize: "13px", color: "#8888aa", cursor: "pointer", padding: "7px 10px" }}
          onMouseEnter={(e) => { e.currentTarget.style.color = "#e2e2e9" }}
          onMouseLeave={(e) => { e.currentTarget.style.color = "#8888aa" }}
        >
          Cancelar
        </button>
      </div>
    </div>
  )
}

// ── Page ──────────────────────────────────────────────────────────────────────

export default function EntityPage() {
  const { entity: entityParam } = useParams<{ entity: string }>()
  const entityName   = decodeURIComponent(entityParam ?? "")
  const queryClient  = useQueryClient()

  const [editingId, setEditingId] = useState<string | null>(null)
  // Local overrides after edits (before full query refetch settles)
  const [localEdits, setLocalEdits] = useState<Record<string, KnowledgeChunk>>({})

  const { data, isLoading } = useQuery({
    queryKey:  ["knowledge"],
    queryFn:   () => api.getKnowledge(1, 200),
    staleTime: 60_000,
  })

  const allChunks = data?.chunks ?? []
  const grouped   = groupByEntity(allChunks)

  // The entity might have changed name after an edit — find by current param
  // but also watch localEdits for entity renames
  const rawChunks = grouped[entityName] ?? []
  const chunks = rawChunks.map((c) => localEdits[c.id] ?? c)

  // Related entities (same topic)
  const topic        = chunks[0]?.topic ?? ""
  const relatedNames = topic
    ? Object.entries(grouped)
        .filter(([name, cs]) => name !== entityName && cs[0]?.topic === topic)
        .map(([name]) => name)
        .slice(0, 5)
    : []

  function handleSaved(updated: KnowledgeChunk, chunkId: string) {
    setLocalEdits((prev) => ({ ...prev, [chunkId]: updated }))
    setEditingId(null)
    // Invalidate in background so next visit is fresh
    queryClient.invalidateQueries({ queryKey: ["knowledge"] })
    queryClient.invalidateQueries({ queryKey: ["knowledge-graph"] })
  }

  if (isLoading) {
    return <div style={{ padding: "48px", color: "#555570", fontSize: "14px" }}>Carregando…</div>
  }

  if (chunks.length === 0) {
    return (
      <div style={{ padding: "48px" }}>
        <Link to="/docs" style={{ fontSize: "13px", color: "#5b5bd6", textDecoration: "none" }}>
          ← Documentação
        </Link>
        <p style={{ marginTop: "32px", color: "#555570", fontSize: "14px" }}>Entidade não encontrada.</p>
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
        <div style={{ display: "flex", flexDirection: "column" }}>
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
              {editingId === chunk.id ? (
                <ChunkEditor
                  chunk={chunk}
                  onCancel={() => setEditingId(null)}
                  onSaved={(updated) => handleSaved(updated, chunk.id)}
                />
              ) : (
                <>
                  {/* Title row + edit button */}
                  <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: "12px", marginBottom: "12px" }}>
                    <div style={{ display: "flex", alignItems: "center", gap: "10px" }}>
                      <span style={{ width: "3px", height: "18px", background: "#5b5bd6", borderRadius: "2px", flexShrink: 0, display: "inline-block" }} />
                      <h2 style={{ fontSize: "16px", fontWeight: 600, color: "#e2e2e9", margin: 0 }}>
                        {chunk.title}
                      </h2>
                    </div>
                    <button
                      onClick={() => setEditingId(chunk.id)}
                      title="Editar"
                      style={{
                        background: "transparent", border: "1px solid transparent",
                        borderRadius: "5px", padding: "3px 8px",
                        fontSize: "12px", color: "#444460", cursor: "pointer",
                        flexShrink: 0, transition: "color 0.15s, border-color 0.15s",
                      }}
                      onMouseEnter={(e) => { e.currentTarget.style.color = "#8888aa"; e.currentTarget.style.borderColor = "#2a2a3a" }}
                      onMouseLeave={(e) => { e.currentTarget.style.color = "#444460"; e.currentTarget.style.borderColor = "transparent" }}
                    >
                      ✎ Editar
                    </button>
                  </div>

                  <p style={{ fontSize: "15px", color: "#9090a8", lineHeight: 1.85, margin: "0 0 12px 13px" }}>
                    {chunk.content}
                  </p>
                  <p style={{ fontSize: "11px", color: "#2e2e42", margin: "0 0 0 13px" }}>
                    {new Date(chunk.created_at).toLocaleDateString("pt-BR", {
                      year: "numeric", month: "long", day: "numeric",
                    })}
                  </p>
                </>
              )}
            </article>
          ))}
        </div>
      </main>
    </div>
  )
}

function Spinner() {
  return (
    <span style={{
      width: "12px", height: "12px",
      border: "2px solid #ffffff44", borderTopColor: "#fff",
      borderRadius: "50%", display: "inline-block",
      animation: "spin 0.7s linear infinite",
    }} />
  )
}
