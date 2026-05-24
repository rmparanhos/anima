const BASE_URL = import.meta.env.VITE_API_URL ?? "http://localhost:8000"

async function request<T>(path: string, init?: RequestInit): Promise<T> {
  const res = await fetch(`${BASE_URL}${path}`, {
    headers: { "Content-Type": "application/json" },
    ...init,
  })
  if (!res.ok) {
    const err = await res.json().catch(() => ({ detail: res.statusText }))
    throw new Error(err.detail ?? "Request failed")
  }
  return res.json()
}

export type User = { id: string; handle: string; created_at: string }
export type Message = { id: string; role: string; content: string; created_at: string; confidence_score?: number }
export type ChatResponse = { message_id: string; conversation_id: string; content: string; confidence_score?: number; status: "answered" | "pending"; question_id?: string }
export type Question = { id: string; normalized_text: string; status: string; votes: number; created_at: string; answer_text?: string; answered_at?: string }
export type KnowledgeChunk = { id: string; entity: string; title: string; topic: string; content: string; source_type: string; source_id?: string; created_at: string }
export type ChunkPreview = { id: string; title: string; content: string }
export type GraphNode = { id: string; entity: string; topic: string; chunk_count: number; chunks: ChunkPreview[]; content: string }
export type GraphLink = { source: string; target: string; value: number }
export type GraphData = { nodes: GraphNode[]; links: GraphLink[] }

export const api = {
  createUser: (handle: string) => request<User>("/api/v1/users", { method: "POST", body: JSON.stringify({ handle }) }),
  sendMessage: (content: string, user_id: string, conversation_id?: string) =>
    request<ChatResponse>("/api/v1/chat/message", { method: "POST", body: JSON.stringify({ content, user_id, conversation_id }) }),
  getHistory: (conversation_id: string) => request<{ conversation_id: string; messages: Message[] }>(`/api/v1/chat/${conversation_id}/history`),
  getPendingQuestions: (page = 1) => request<{ questions: Question[]; total: number }>(`/api/v1/questions/pending?page=${page}`),
  answerQuestion: (question_id: string, answer_text: string, user_id: string) =>
    request(`/api/v1/questions/${question_id}/answer`, { method: "POST", body: JSON.stringify({ answer_text, user_id }) }),
  voteQuestion: (question_id: string) => request(`/api/v1/questions/${question_id}/vote`, { method: "POST" }),
  getKnowledge: (page = 1, limit = 200) => request<{ chunks: KnowledgeChunk[]; total: number }>(`/api/v1/knowledge?page=${page}&limit=${limit}`),
  getKnowledgeGraph: () => request<GraphData>("/api/v1/knowledge/graph"),
}
