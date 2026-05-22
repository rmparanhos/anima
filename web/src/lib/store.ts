import { create } from "zustand"
import { persist } from "zustand/middleware"

interface UserStore {
  userId: string | null
  userHandle: string | null
  conversationId: string | null
  setUser: (id: string, handle: string) => void
  setConversationId: (id: string) => void
  reset: () => void
}

export const useUserStore = create<UserStore>()(
  persist(
    (set) => ({
      userId: null,
      userHandle: null,
      conversationId: null,
      setUser: (id, handle) => set({ userId: id, userHandle: handle }),
      setConversationId: (id) => set({ conversationId: id }),
      reset: () => set({ userId: null, userHandle: null, conversationId: null }),
    }),
    { name: "anima-user" }
  )
)
