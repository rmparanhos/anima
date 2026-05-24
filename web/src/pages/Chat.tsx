import { useState, useRef, useEffect } from "react"
import { Link } from "react-router-dom"
import { api, type Message } from "@/lib/api"
import { useUserStore } from "@/lib/store"

export default function ChatPage() {
  const { userId, conversationId, setUser, setConversationId } = useUserStore()
  const [messages, setMessages] = useState<(Message & { status?: string; question_id?: string })[]>([])
  const [input, setInput] = useState("")
  const [loading, setLoading] = useState(false)
  const [handle, setHandle] = useState("")
  const [signingIn, setSigningIn] = useState(false)
  const bottomRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: "smooth" })
  }, [messages])

  async function handleSignIn(e: React.FormEvent) {
    e.preventDefault()
    if (!handle.trim()) return
    setSigningIn(true)
    try {
      const user = await api.createUser(handle.trim())
      setUser(user.id, user.handle)
    } catch (err: unknown) {
      alert(err instanceof Error ? err.message : "Error signing in")
    } finally {
      setSigningIn(false)
    }
  }

  async function handleSend(e: React.FormEvent) {
    e.preventDefault()
    if (!input.trim() || loading || !userId) return

    const userMsg: Message = { id: Date.now().toString(), role: "user", content: input, created_at: new Date().toISOString() }
    setMessages((prev) => [...prev, userMsg])
    const content = input
    setInput("")
    setLoading(true)

    try {
      const res = await api.sendMessage(content, userId, conversationId ?? undefined)
      if (!conversationId) setConversationId(res.conversation_id)
      setMessages((prev) => [
        ...prev,
        {
          id: res.message_id,
          role: "assistant",
          content: res.content,
          created_at: new Date().toISOString(),
          confidence_score: res.confidence_score,
          status: res.status,
          question_id: res.question_id,
        },
      ])
    } catch {
      setMessages((prev) => [
        ...prev,
        { id: "err", role: "assistant", content: "Error processing message.", created_at: new Date().toISOString() },
      ])
    } finally {
      setLoading(false)
    }
  }

  if (!userId) {
    return (
      <div style={{ display: "flex", alignItems: "center", justifyContent: "center", minHeight: "calc(100vh - 48px)" }}>
        <form
          onSubmit={handleSignIn}
          style={{
            background: "#16161f",
            border: "1px solid #2a2a3a",
            borderRadius: "12px",
            padding: "32px",
            display: "flex",
            flexDirection: "column",
            gap: "16px",
            width: "320px",
          }}
        >
          <h1 style={{ fontSize: "18px", fontWeight: 700, color: "#e2e2e9", margin: 0 }}>Sign in to Anima</h1>
          <input
            style={{ background: "#1e1e2e", border: "1px solid #2a2a3a", borderRadius: "6px", padding: "8px 12px", fontSize: "14px", color: "#e2e2e9", outline: "none" }}
            placeholder="Choose a handle (e.g. john)"
            value={handle}
            onChange={(e) => setHandle(e.target.value)}
            onFocus={(e) => { e.currentTarget.style.borderColor = "#5b5bd6" }}
            onBlur={(e) => { e.currentTarget.style.borderColor = "#2a2a3a" }}
          />
          <button
            style={{ background: "#5b5bd6", color: "#fff", border: "none", borderRadius: "6px", padding: "9px 16px", fontSize: "14px", fontWeight: 600, cursor: signingIn ? "not-allowed" : "pointer", opacity: signingIn ? 0.7 : 1 }}
            disabled={signingIn}
          >
            {signingIn ? "Signing in..." : "Sign in"}
          </button>
        </form>
      </div>
    )
  }

  return (
    <div style={{ display: "flex", flexDirection: "column", height: "calc(100vh - 48px)" }}>
      <div style={{ flex: 1, overflowY: "auto", padding: "24px 16px", maxWidth: "768px", margin: "0 auto", width: "100%" }}>
        {messages.length === 0 && (
          <p style={{ color: "#555570", fontSize: "14px", textAlign: "center", marginTop: "80px" }}>
            Ask a question to get started.
          </p>
        )}
        <div style={{ display: "flex", flexDirection: "column", gap: "16px" }}>
          {messages.map((m) => (
            <div key={m.id} style={{ display: "flex", flexDirection: "column", gap: "4px", alignItems: m.role === "user" ? "flex-end" : "flex-start" }}>
              <div
                style={{
                  padding: "10px 16px",
                  borderRadius: "8px",
                  fontSize: "14px",
                  maxWidth: "80%",
                  whiteSpace: "pre-wrap",
                  lineHeight: 1.6,
                  ...(m.role === "user"
                    ? { background: "#1e1e2e", color: "#e2e2e9", borderLeft: "3px solid #5b5bd6" }
                    : { background: "#16161f", color: "#e2e2e9", border: "1px solid #2a2a3a" }),
                }}
              >
                {m.content}
              </div>
              {m.role === "assistant" && m.status === "pending" && m.question_id && (
                <Link to="/pending" style={{ fontSize: "12px", color: "#e8c468", textDecoration: "underline" }}>
                  view pending question
                </Link>
              )}
              {m.role === "assistant" && m.confidence_score != null && m.status === "answered" && (
                <span style={{ fontSize: "12px", background: "#2a2a3a", color: "#8888aa", padding: "2px 8px", borderRadius: "999px" }}>
                  confidence: {(m.confidence_score * 100).toFixed(0)}%
                </span>
              )}
            </div>
          ))}
          {loading && (
            <div style={{ display: "flex", alignItems: "flex-start" }}>
              <div style={{ padding: "10px 16px", borderRadius: "8px", fontSize: "14px", background: "#16161f", border: "1px solid #2a2a3a", color: "#5b5bd6" }}>
                thinking...
              </div>
            </div>
          )}
          <div ref={bottomRef} />
        </div>
      </div>

      <form
        onSubmit={handleSend}
        style={{ borderTop: "1px solid #2a2a3a", background: "#16161f", padding: "12px 16px", display: "flex", gap: "8px", maxWidth: "768px", margin: "0 auto", width: "100%" }}
      >
        <input
          style={{ flex: 1, background: "#1e1e2e", border: "1px solid #2a2a3a", borderRadius: "6px", padding: "8px 12px", fontSize: "14px", color: "#e2e2e9", outline: "none" }}
          placeholder="Ask a question..."
          value={input}
          onChange={(e) => setInput(e.target.value)}
          disabled={loading}
          onFocus={(e) => { e.currentTarget.style.borderColor = "#5b5bd6" }}
          onBlur={(e) => { e.currentTarget.style.borderColor = "#2a2a3a" }}
        />
        <button
          style={{ background: "#5b5bd6", color: "#fff", border: "none", borderRadius: "6px", padding: "8px 18px", fontSize: "14px", fontWeight: 600, cursor: loading || !input.trim() ? "not-allowed" : "pointer", opacity: loading || !input.trim() ? 0.5 : 1 }}
          disabled={loading || !input.trim()}
          onMouseEnter={(e) => { if (!loading && input.trim()) e.currentTarget.style.background = "#6e6edf" }}
          onMouseLeave={(e) => { e.currentTarget.style.background = "#5b5bd6" }}
        >
          Send
        </button>
      </form>
    </div>
  )
}
