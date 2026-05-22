"use client"
import { useState, useRef, useEffect } from "react"
import { api, type Message } from "@/lib/api"
import { useUserStore } from "@/lib/store"

export default function ChatPage() {
  const { userId, userHandle, conversationId, setUser, setConversationId } = useUserStore()
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
      const user = await api.createUser(handle.trim()).catch(async () => {
        // if handle taken, try to fetch by re-creating returns 409 — just store locally
        throw new Error("Handle já em uso. Tente outro.")
      })
      setUser(user.id, user.handle)
    } catch (err: unknown) {
      alert(err instanceof Error ? err.message : "Erro ao criar usuário")
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

      const assistantMsg = {
        id: res.message_id,
        role: "assistant",
        content: res.content,
        created_at: new Date().toISOString(),
        confidence_score: res.confidence_score,
        status: res.status,
        question_id: res.question_id,
      }
      setMessages((prev) => [...prev, assistantMsg])
    } catch (err: unknown) {
      setMessages((prev) => [...prev, { id: "err", role: "assistant", content: "Erro ao processar mensagem.", created_at: new Date().toISOString() }])
    } finally {
      setLoading(false)
    }
  }

  if (!userId) {
    return (
      <div className="flex items-center justify-center h-[80vh]">
        <form onSubmit={handleSignIn} className="flex flex-col gap-4 w-72">
          <h1 className="text-xl font-bold">Entrar no Anima</h1>
          <input
            className="bg-zinc-800 border border-zinc-700 rounded px-3 py-2 text-sm focus:outline-none focus:border-zinc-500"
            placeholder="Escolha um handle (ex: joao)"
            value={handle}
            onChange={(e) => setHandle(e.target.value)}
          />
          <button className="bg-white text-black rounded px-4 py-2 text-sm font-semibold hover:bg-zinc-200" disabled={signingIn}>
            {signingIn ? "Entrando..." : "Entrar"}
          </button>
        </form>
      </div>
    )
  }

  return (
    <div className="flex flex-col h-[calc(100vh-49px)]">
      <div className="flex-1 overflow-y-auto px-4 py-6 space-y-4 max-w-3xl mx-auto w-full">
        {messages.length === 0 && (
          <p className="text-zinc-500 text-sm text-center mt-20">Faça uma pergunta para começar.</p>
        )}
        {messages.map((m) => (
          <div key={m.id} className={`flex flex-col gap-1 ${m.role === "user" ? "items-end" : "items-start"}`}>
            <div
              className={`px-4 py-2 rounded-lg text-sm max-w-[80%] whitespace-pre-wrap ${
                m.role === "user" ? "bg-zinc-700 text-white" : "bg-zinc-800 text-zinc-100"
              }`}
            >
              {m.content}
            </div>
            {m.role === "assistant" && m.status === "pending" && m.question_id && (
              <a href="/pending" className="text-xs text-yellow-500 hover:underline">
                ver pergunta pendente
              </a>
            )}
            {m.role === "assistant" && m.confidence_score != null && m.status === "answered" && (
              <span className="text-xs text-zinc-600">confiança: {(m.confidence_score * 100).toFixed(0)}%</span>
            )}
          </div>
        ))}
        {loading && (
          <div className="flex items-start">
            <div className="px-4 py-2 rounded-lg text-sm bg-zinc-800 text-zinc-400 animate-pulse">pensando...</div>
          </div>
        )}
        <div ref={bottomRef} />
      </div>

      <form onSubmit={handleSend} className="border-t border-zinc-800 px-4 py-3 flex gap-2 max-w-3xl mx-auto w-full">
        <input
          className="flex-1 bg-zinc-800 border border-zinc-700 rounded px-3 py-2 text-sm focus:outline-none focus:border-zinc-500"
          placeholder="Faça uma pergunta..."
          value={input}
          onChange={(e) => setInput(e.target.value)}
          disabled={loading}
        />
        <button className="bg-white text-black rounded px-4 py-2 text-sm font-semibold hover:bg-zinc-200 disabled:opacity-50" disabled={loading || !input.trim()}>
          Enviar
        </button>
      </form>
    </div>
  )
}
