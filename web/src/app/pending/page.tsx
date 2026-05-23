"use client"
import { useState } from "react"
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query"
import { api, type Question } from "@/lib/api"
import { useUserStore } from "@/lib/store"

export default function PendingPage() {
  const { userId } = useUserStore()
  const queryClient = useQueryClient()
  const [answering, setAnswering] = useState<string | null>(null)
  const [answerText, setAnswerText] = useState("")

  const { data, isLoading } = useQuery({
    queryKey: ["pending"],
    queryFn: () => api.getPendingQuestions(),
  })

  const answerMutation = useMutation({
    mutationFn: ({ id, text }: { id: string; text: string }) =>
      api.answerQuestion(id, text, userId!),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["pending"] })
      setAnswering(null)
      setAnswerText("")
    },
  })

  const voteMutation = useMutation({
    mutationFn: (id: string) => api.voteQuestion(id),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ["pending"] }),
  })

  if (!userId) {
    return (
      <div style={{ display: "flex", alignItems: "center", justifyContent: "center", minHeight: "calc(100vh - 48px)" }}>
        <p style={{ color: "#8888aa", fontSize: "14px" }}>
          Sign in at <a href="/chat" style={{ color: "#5b5bd6", textDecoration: "underline" }}>chat</a> first.
        </p>
      </div>
    )
  }

  return (
    <div style={{ maxWidth: "768px", margin: "0 auto", padding: "32px 16px" }}>
      <h1 style={{ fontSize: "20px", fontWeight: 700, color: "#e2e2e9", marginBottom: "24px" }}>Pending Questions</h1>

      {isLoading && <p style={{ color: "#555570", fontSize: "14px" }}>Loading...</p>}
      {!isLoading && data?.questions.length === 0 && (
        <p style={{ color: "#555570", fontSize: "14px" }}>No pending questions.</p>
      )}

      <div style={{ display: "flex", flexDirection: "column", gap: "12px" }}>
        {data?.questions.map((q: Question) => (
          <div
            key={q.id}
            style={{
              background: "#16161f",
              border: "1px solid #2a2a3a",
              borderRadius: "8px",
              padding: "20px",
            }}
          >
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", gap: "16px", marginBottom: "12px" }}>
              <p style={{ fontSize: "14px", color: "#e2e2e9", margin: 0, lineHeight: 1.6 }}>{q.normalized_text}</p>
              <button
                onClick={() => voteMutation.mutate(q.id)}
                style={{
                  background: "#1e1e2e",
                  border: "1px solid #2a2a3a",
                  borderRadius: "6px",
                  padding: "4px 10px",
                  fontSize: "12px",
                  color: "#8888aa",
                  cursor: "pointer",
                  flexShrink: 0,
                  transition: "border-color 0.15s, color 0.15s",
                }}
                onMouseEnter={(e) => {
                  e.currentTarget.style.color = "#e2e2e9"
                  e.currentTarget.style.borderColor = "#5b5bd6"
                }}
                onMouseLeave={(e) => {
                  e.currentTarget.style.color = "#8888aa"
                  e.currentTarget.style.borderColor = "#2a2a3a"
                }}
              >
                +{q.votes}
              </button>
            </div>

            {answering === q.id ? (
              <div style={{ display: "flex", flexDirection: "column", gap: "8px" }}>
                <textarea
                  style={{
                    width: "100%",
                    background: "#1e1e2e",
                    border: "1px solid #2a2a3a",
                    borderRadius: "6px",
                    padding: "8px 12px",
                    fontSize: "14px",
                    color: "#e2e2e9",
                    outline: "none",
                    resize: "none",
                    lineHeight: 1.6,
                  }}
                  rows={4}
                  placeholder="Write your answer..."
                  value={answerText}
                  onChange={(e) => setAnswerText(e.target.value)}
                  onFocus={(e) => { e.currentTarget.style.borderColor = "#5b5bd6" }}
                  onBlur={(e) => { e.currentTarget.style.borderColor = "#2a2a3a" }}
                />
                <div style={{ display: "flex", gap: "8px", alignItems: "center" }}>
                  <button
                    onClick={() => answerMutation.mutate({ id: q.id, text: answerText })}
                    disabled={!answerText.trim() || answerMutation.isPending}
                    style={{
                      background: "#5b5bd6",
                      color: "#fff",
                      border: "none",
                      borderRadius: "6px",
                      padding: "7px 14px",
                      fontSize: "14px",
                      fontWeight: 600,
                      cursor: !answerText.trim() || answerMutation.isPending ? "not-allowed" : "pointer",
                      opacity: !answerText.trim() || answerMutation.isPending ? 0.5 : 1,
                    }}
                  >
                    {answerMutation.isPending ? "Submitting..." : "Submit"}
                  </button>
                  <button
                    onClick={() => setAnswering(null)}
                    style={{
                      background: "transparent",
                      border: "none",
                      fontSize: "14px",
                      color: "#8888aa",
                      cursor: "pointer",
                      padding: "7px 10px",
                    }}
                    onMouseEnter={(e) => { e.currentTarget.style.color = "#e2e2e9" }}
                    onMouseLeave={(e) => { e.currentTarget.style.color = "#8888aa" }}
                  >
                    Cancel
                  </button>
                </div>
              </div>
            ) : (
              <button
                onClick={() => setAnswering(q.id)}
                style={{
                  background: "transparent",
                  border: "none",
                  fontSize: "13px",
                  color: "#5b5bd6",
                  textDecoration: "underline",
                  cursor: "pointer",
                  padding: 0,
                }}
              >
                answer
              </button>
            )}
          </div>
        ))}
      </div>
    </div>
  )
}
