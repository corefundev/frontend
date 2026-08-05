// SUP-UX #566 (п.3): переписка с ассистентом живёт ВНЕ панели виджета —
// сворачивание (панель размонтируется) и перезагрузка страницы не
// теряют диалог. sessionStorage сознательно: история умирает вместе со
// вкладкой — в браузере не копятся чужие диалоги на общем компьютере,
// и retention-вопросов (152-ФЗ) на клиенте не возникает.
import { create } from 'zustand'
import { createJSONStorage, persist } from 'zustand/middleware'

import type { Citation } from './api'

export interface Msg {
  role: 'user' | 'assistant'
  text: string
  at: string          // HH:MM локальное время постановки сообщения
  citations?: Citation[]
}

interface SupportChatState {
  msgs: Msg[]
  sessionId: string | null
  append: (m: Msg) => void
  patchLast: (patch: Partial<Msg>) => void
  appendToLastText: (delta: string) => void
  setSessionId: (id: string | null) => void
}

export const useSupportChat = create<SupportChatState>()(
  persist(
    (set) => ({
      msgs: [],
      sessionId: null,
      append: (m) => set((s) => ({ msgs: [...s.msgs, m] })),
      patchLast: (patch) => set((s) => {
        if (!s.msgs.length) return s
        const out = [...s.msgs]
        out[out.length - 1] = { ...out[out.length - 1], ...patch }
        return { msgs: out }
      }),
      appendToLastText: (delta) => set((s) => {
        if (!s.msgs.length) return s
        const out = [...s.msgs]
        const last = out[out.length - 1]
        out[out.length - 1] = { ...last, text: last.text + delta }
        return { msgs: out }
      }),
      setSessionId: (id) => set({ sessionId: id }),
    }),
    {
      name: 'sku-support-chat',
      storage: createJSONStorage(() => sessionStorage),
      // Вкладка закрылась посреди стрима → в хранилище остался пустой
      // пузырь ассистента. При восстановлении отрезаем его, чтобы не
      // показывать вечное «…».
      onRehydrateStorage: () => (state) => {
        if (!state) return
        const m = state.msgs
        if (m.length && m[m.length - 1].role === 'assistant'
            && m[m.length - 1].text === '') {
          state.msgs = m.slice(0, -1)
        }
      },
    },
  ),
)
