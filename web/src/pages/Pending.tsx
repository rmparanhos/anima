import { useState } from "react"
import { Link } from "react-router-dom"
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query"
import { api, type Question } from "@/lib/api"
import { useUserStore } from "@/lib/store"

type ResolvedEntry = { questionId: string; error?: string }

export default function PendingPage() {
  const { userId }     = useUserStore()
  const queryClient    = useQueryClient()
  const [answering,  setAnswering]  = useState<string | null>(null)
  const [answerText, setAnswerText] = useState("")
  const [resolved,   setResolved]   = useState<ResolvedEntry[]>([])

  const { data, isLoading } = useQuery({
    queryKey: ["pending"],
    queryFn:  () => api.getPendingQuestions(),
  })

  const answerMutation = useMutation({
    mutationFn: ({ id, text }: { id: string; text: string }) =>
      api.answerQuestion(id, text, userId!),

    onSuccess: (_res, { id }) => {
      setAnswering(null)
      setAnswerText("")
      setResolved((prev) => [...prev, { questionId: id }])
      // remove banner + refresh lists after 8 s
      setTimeout(() => {
        setResolved((prev) => prev.filter((r) => r.questionId !== id))
        queryClient.invalidateQueries({ queryKey: ["pending"] })
        queryClient.invalidateQueries({ queryKey: ["knowledge"] })
        queryClient.invalidateQueries({ queryKey: ["knowledge-graph"] })
      }, 8_000)
    },

    onError: (err: unknown, { id }) => {
      const msg =
        (err as Error)?.message?.includes("500")
          ? "Falha ao processar — tente novamente."
          : (err as Error)?.message ?? "Erro desconhecido."
      setResolved((prev) => [...prev, { questionId: id, error: msg }])
    },
  })

  const voteMutation = useMutation({
    mutationFn: (id: string) => api.voteQuestion(id),
    onSuccess:  () => queryClient.invalidateQueries({ queryKey: ["pending"] }),
  })

  if (!userId) {
    return (
      <div style={{ display: "flex", alignItems: "center", justifyContent: "center", minHeight: "calc(100vh - 48px)" }}>
        <p style={{ color: "#8888aa", fontSize: "14px" }}>
          Entre pelo <Link to="/chat" style={{ color: "#5b5bd6", textDecoration: "underline" }}>chat</Link> primeiro.
        </p>
      </div>
    )
  }

  const questions: Question[] = data?.questions ?? []
  const resolvedIds = new Set(resolved.map((r) => r.questionId))

  return (
    <div style={{ maxWidth: "768px", margin: "0 auto", padding: "32px 16px" }}>
      <div style={{ display: "flex", alignItems: "baseline", gap: "12px", marginBottom: "24px" }}>
        <h1 style={{ fontSize: "20px", fontWeight: 700, color: "#e2e2e9", margin: 0 }}>
          Perguntas Pendentes
        </h1>
        {data && data.total > 0 && (
          <span style={{ fontSize: "12px", color: "#555570" }}>{data.total}</span>
        )}
      </div>

      {isLoading && <p style={{ color: "#555570", fontSize: "14px" }}>Carregando…</p>}

      {!isLoading && questions.length === 0 && resolved.length === 0 && (
        <p style={{ color: "#555570", fontSize: "14px" }}>Nenhuma pergunta pendente.</p>
      )}

      <div style={{ display: "flex", flexDirection: "column", gap: "12px" }}>

        {/* ── success / error banners for recently answered questions ── */}
        {resolved.map((r) => (
          <div
            key={r.questionId}
            style={{
              background:   r.error ? "#2a0f14"      : "#0f1f14",
              border:       `1px solid ${r.error ? "#e04a6a55" : "#1fa67a55"}`,
              borderRadius: "8px", padding: "14px 20px",
              display: "flex", alignItems: "center", justifyContent: "space-between", gap: "12px",
            }}
          >
            <span style={{ fontSize: "14px", color: r.error ? "#e04a6a" : "#1fa67a" }}>
              {r.error
                ? `✗ ${r.error}`
                : "✓ Resposta enviada — adicionada à base de conhecimento."}
            </span>
            {!r.error && (
              <Link
                to="/docs"
                style={{
                  fontSize: "12px", color: "#1fa67a", textDecoration: "none",
                  border: "1px solid #1fa67a55", borderRadius: "4px",
                  padding: "3px 10px", flexShrink: 0, whiteSpace: "nowrap",
                }}
              >
                Ver em /docs →
              </Link>
            )}
          </div>
        ))}

        {/* ── pending question cards ── */}
        {questions
          .filter((q) => !resolvedIds.has(q.id))
          .map((q) => {
            const isSubmitting = answerMutation.isPending && answering === q.id
            return (
              <div
                key={q.id}
                style={{
                  background: "#16161f", border: "1px solid #2a2a3a",
                  borderRadius: "8px", padding: "20px",
                  opacity: isSubmitting ? 0.75 : 1, transition: "opacity 0.2s",
                }}
              >
                {/* Question text + vote */}
                <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", gap: "16px", marginBottom: "12px" }}>
                  <p style={{ fontSize: "14px", color: "#e2e2e9", margin: 0, lineHeight: 1.6 }}>
                    {q.normalized_text}
                  </p>
                  <button
                    onClick={() => voteMutation.mutate(q.id)}
                    style={{ background: "#1e1e2e", border: "1px solid #2a2a3a", borderRadius: "6px", padding: "4px 10px", fontSize: "12px", color: "#8888aa", cursor: "pointer", flexShrink: 0 }}
                    onMouseEnter={(e) => { e.currentTarget.style.color = "#e2e2e9"; e.currentTarget.style.borderColor = "#5b5bd6" }}
                    onMouseLeave={(e) => { e.currentTarget.style.color = "#8888aa"; e.currentTarget.style.borderColor = "#2a2a3a" }}
                  >
                    +{q.votes}
                  </button>
                </div>

                {/* Answer form or "responder" link */}
                {answering === q.id ? (
                  <div style={{ display: "flex", flexDirection: "column", gap: "8px" }}>
                    <textarea
                      rows={4}
                      placeholder="Escreva sua resposta…"
                      value={answerText}
                      disabled={isSubmitting}
                      onChange={(e) => setAnswerText(e.target.value)}
                      onFocus={(e)  => { e.currentTarget.style.borderColor = "#5b5bd6" }}
                      onBlur={(e)   => { e.currentTarget.style.borderColor = "#2a2a3a" }}
                      style={{
                        width: "100%", boxSizing: "border-box",
                        background: "#1e1e2e", border: "1px solid #2a2a3a",
                        borderRadius: "6px", padding: "8px 12px",
                        fontSize: "14px", color: "#e2e2e9",
                        outline: "none", resize: "none", lineHeight: 1.6,
                      }}
                    />

                    <div style={{ display: "flex", gap: "8px", alignItems: "center" }}>
                      <button
                        onClick={() => answerMutation.mutate({ id: q.id, text: answerText })}
                        disabled={!answerText.trim() || isSubmitting}
                        style={{
                          background: "#5b5bd6", color: "#fff", border: "none",
                          borderRadius: "6px", padding: "7px 16px",
                          fontSize: "14px", fontWeight: 600,
                          cursor: (!answerText.trim() || isSubmitting) ? "not-allowed" : "pointer",
                          opacity: (!answerText.trim() || isSubmitting) ? 0.5 : 1,
                          display: "flex", alignItems: "center", gap: "6px",
                        }}
                      >
                        {isSubmitting && <Spinner />}
                        {isSubmitting ? "Processando…" : "Enviar"}
                      </button>

                      {!isSubmitting && (
                        <button
                          onClick={() => { setAnswering(null); setAnswerText("") }}
                          style={{ background: "transparent", border: "none", fontSize: "14px", color: "#8888aa", cursor: "pointer", padding: "7px 10px" }}
                          onMouseEnter={(e) => { e.currentTarget.style.color = "#e2e2e9" }}
                          onMouseLeave={(e) => { e.currentTarget.style.color = "#8888aa" }}
                        >
                          Cancelar
                        </button>
                      )}
                    </div>

                    {isSubmitting && (
                      <p style={{ fontSize: "12px", color: "#555570", margin: 0 }}>
                        Gerando documentação — pode levar alguns segundos…
                      </p>
                    )}
                  </div>
                ) : (
                  <button
                    onClick={() => { setAnswering(q.id); setAnswerText("") }}
                    style={{ background: "transparent", border: "none", fontSize: "13px", color: "#5b5bd6", textDecoration: "underline", cursor: "pointer", padding: 0 }}
                  >
                    responder
                  </button>
                )}
              </div>
            )
          })}
      </div>

      <style>{`@keyframes spin { to { transform: rotate(360deg) } }`}</style>
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
