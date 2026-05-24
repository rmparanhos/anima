import { useState } from "react"
import { Link } from "react-router-dom"
import { useQuery } from "@tanstack/react-query"
import { api, type KnowledgeChunk } from "@/lib/api"

export default function DocsPage() {
  const [page, setPage] = useState(1)
  const [search, setSearch] = useState("")

  const { data, isLoading } = useQuery({
    queryKey: ["knowledge", page],
    queryFn: () => api.getKnowledge(page),
  })

  const filtered = data?.chunks.filter((c) =>
    search ? c.content.toLowerCase().includes(search.toLowerCase()) : true
  ) ?? []

  return (
    <div style={{ maxWidth: "896px", margin: "0 auto", padding: "32px 16px" }}>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "24px" }}>
        <h1 style={{ fontSize: "20px", fontWeight: 700, color: "#e2e2e9", margin: 0 }}>Knowledge Base</h1>
        {data && (
          <span style={{ background: "#1e1e2e", color: "#8888aa", fontSize: "12px", padding: "3px 10px", borderRadius: "999px" }}>
            {data.total} entries
          </span>
        )}
      </div>

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
          marginBottom: "24px",
        }}
        placeholder="Search the knowledge base..."
        value={search}
        onChange={(e) => setSearch(e.target.value)}
        onFocus={(e) => { e.currentTarget.style.borderColor = "#5b5bd6" }}
        onBlur={(e) => { e.currentTarget.style.borderColor = "#2a2a3a" }}
      />

      {isLoading && <p style={{ color: "#555570", fontSize: "14px" }}>Loading...</p>}
      {!isLoading && filtered.length === 0 && (
        <p style={{ color: "#555570", fontSize: "14px" }}>
          {search ? "No results for that search." : "The knowledge base is empty. Answer pending questions to populate it."}
        </p>
      )}

      <div style={{ display: "flex", flexDirection: "column", gap: "12px" }}>
        {filtered.map((chunk: KnowledgeChunk) => (
          <div
            key={chunk.id}
            style={{
              background: "#16161f",
              border: "1px solid #2a2a3a",
              borderRadius: "8px",
              padding: "20px",
            }}
          >
            <p style={{ fontSize: "14px", color: "#e2e2e9", lineHeight: 1.7, margin: "0 0 12px 0" }}>
              {chunk.content}
            </p>
            <div style={{ display: "flex", gap: "16px", fontSize: "12px", color: "#555570" }}>
              <span>{new Date(chunk.created_at).toLocaleDateString("en-US")}</span>
              {chunk.source_id && (
                <Link
                  to="/pending"
                  style={{ color: "#555570", textDecoration: "none" }}
                  onMouseEnter={(e) => { e.currentTarget.style.color = "#8888aa" }}
                  onMouseLeave={(e) => { e.currentTarget.style.color = "#555570" }}
                >
                  source: pending question
                </Link>
              )}
            </div>
          </div>
        ))}
      </div>

      {data && data.total > 50 && (
        <div style={{ display: "flex", gap: "16px", marginTop: "32px", justifyContent: "center", alignItems: "center" }}>
          <button
            onClick={() => setPage((p) => Math.max(1, p - 1))}
            disabled={page === 1}
            style={{
              background: "transparent",
              border: "none",
              fontSize: "14px",
              color: page === 1 ? "#333345" : "#8888aa",
              cursor: page === 1 ? "not-allowed" : "pointer",
              padding: "4px 8px",
            }}
            onMouseEnter={(e) => { if (page !== 1) e.currentTarget.style.color = "#e2e2e9" }}
            onMouseLeave={(e) => { if (page !== 1) e.currentTarget.style.color = "#8888aa" }}
          >
            previous
          </button>
          <span style={{ fontSize: "14px", color: "#555570" }}>page {page}</span>
          <button
            onClick={() => setPage((p) => p + 1)}
            disabled={page * 50 >= data.total}
            style={{
              background: "transparent",
              border: "none",
              fontSize: "14px",
              color: page * 50 >= data.total ? "#333345" : "#8888aa",
              cursor: page * 50 >= data.total ? "not-allowed" : "pointer",
              padding: "4px 8px",
            }}
            onMouseEnter={(e) => { if (page * 50 < data.total) e.currentTarget.style.color = "#e2e2e9" }}
            onMouseLeave={(e) => { if (page * 50 < data.total) e.currentTarget.style.color = "#8888aa" }}
          >
            next
          </button>
        </div>
      )}
    </div>
  )
}
