"use client"
import { useState } from "react"
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
    <div className="max-w-4xl mx-auto px-4 py-8">
      <div className="flex justify-between items-center mb-6">
        <h1 className="text-xl font-bold">Knowledge Base</h1>
        {data && <span className="text-xs text-zinc-500">{data.total} entries</span>}
      </div>

      <input
        className="w-full bg-zinc-800 border border-zinc-700 rounded px-3 py-2 text-sm mb-6 focus:outline-none focus:border-zinc-500"
        placeholder="Search the knowledge base..."
        value={search}
        onChange={(e) => setSearch(e.target.value)}
      />

      {isLoading && <p className="text-zinc-500 text-sm">Loading...</p>}
      {filtered.length === 0 && !isLoading && (
        <p className="text-zinc-500 text-sm">
          {search ? "No results for that search." : "The knowledge base is empty. Answer pending questions to populate it."}
        </p>
      )}

      <div className="space-y-4">
        {filtered.map((chunk: KnowledgeChunk) => (
          <div key={chunk.id} className="border border-zinc-800 rounded-lg p-4 space-y-2">
            <pre className="text-sm text-zinc-100 whitespace-pre-wrap font-mono leading-relaxed">{chunk.content}</pre>
            <div className="flex gap-4 text-xs text-zinc-600">
              <span>{new Date(chunk.created_at).toLocaleDateString("en-US")}</span>
              {chunk.source_id && (
                <a href={`/pending`} className="hover:text-zinc-400">
                  source: pending question
                </a>
              )}
            </div>
          </div>
        ))}
      </div>

      {data && data.total > 50 && (
        <div className="flex gap-4 mt-8 justify-center">
          <button onClick={() => setPage((p) => Math.max(1, p - 1))} disabled={page === 1} className="text-sm text-zinc-400 hover:text-white disabled:opacity-30">previous</button>
          <span className="text-sm text-zinc-500">page {page}</span>
          <button onClick={() => setPage((p) => p + 1)} disabled={page * 50 >= data.total} className="text-sm text-zinc-400 hover:text-white disabled:opacity-30">next</button>
        </div>
      )}
    </div>
  )
}
