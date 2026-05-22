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
      <div className="flex items-center justify-center h-[80vh]">
        <p className="text-zinc-400 text-sm">Faça login no <a href="/chat" className="underline">chat</a> primeiro.</p>
      </div>
    )
  }

  return (
    <div className="max-w-3xl mx-auto px-4 py-8">
      <h1 className="text-xl font-bold mb-6">Perguntas Pendentes</h1>

      {isLoading && <p className="text-zinc-500 text-sm">Carregando...</p>}
      {data?.questions.length === 0 && <p className="text-zinc-500 text-sm">Nenhuma pergunta pendente.</p>}

      <div className="space-y-4">
        {data?.questions.map((q: Question) => (
          <div key={q.id} className="border border-zinc-800 rounded-lg p-4 space-y-3">
            <div className="flex justify-between items-start gap-4">
              <p className="text-sm text-zinc-100">{q.normalized_text}</p>
              <button
                onClick={() => voteMutation.mutate(q.id)}
                className="text-xs text-zinc-500 hover:text-white border border-zinc-700 rounded px-2 py-1 shrink-0"
              >
                +{q.votes}
              </button>
            </div>

            {answering === q.id ? (
              <div className="space-y-2">
                <textarea
                  className="w-full bg-zinc-800 border border-zinc-700 rounded px-3 py-2 text-sm focus:outline-none focus:border-zinc-500 resize-none"
                  rows={4}
                  placeholder="Escreva sua resposta..."
                  value={answerText}
                  onChange={(e) => setAnswerText(e.target.value)}
                />
                <div className="flex gap-2">
                  <button
                    onClick={() => answerMutation.mutate({ id: q.id, text: answerText })}
                    disabled={!answerText.trim() || answerMutation.isPending}
                    className="bg-white text-black rounded px-3 py-1.5 text-sm font-semibold hover:bg-zinc-200 disabled:opacity-50"
                  >
                    {answerMutation.isPending ? "Enviando..." : "Responder"}
                  </button>
                  <button onClick={() => setAnswering(null)} className="text-sm text-zinc-500 hover:text-white">Cancelar</button>
                </div>
              </div>
            ) : (
              <button
                onClick={() => setAnswering(q.id)}
                className="text-xs text-zinc-400 hover:text-white underline"
              >
                responder
              </button>
            )}
          </div>
        ))}
      </div>
    </div>
  )
}
