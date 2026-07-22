// SUP-5 (#508, эпик #503): админ-контракт раздела «Ассистент» консоли.
// Прод проксирует в изолированный бот (X-Supbot-Admin секрет + приватная
// сеть). Метрики — обзор диалогов за окно; «Обновить знания» собирает
// свежий снапшот корпуса in-process (Помощь+Новости+Тарифы) и переинжест.
import { apiClient } from '../../shared/api/client'

export interface SupportQuestion { question: string; count: number }
export interface SupportRecent {
  ts: string
  surface: string
  question: string
  answer: string
  escalated: boolean
}
export interface SupportMetrics {
  window_days: number
  total: number
  sessions: number
  escalated: number
  escalation_rate: number
  top_questions: SupportQuestion[]
  unanswered: SupportQuestion[]
  recent: SupportRecent[]
  retention_days: number
}
export interface ReingestResult {
  ok: boolean
  result?: string
  error?: string | null
}

export const supportAdminApi = {
  async metrics(): Promise<SupportMetrics> {
    return (await apiClient.get<SupportMetrics>('/admin/support/metrics')).data
  },
  async reingest(): Promise<ReingestResult> {
    return (await apiClient.post<ReingestResult>('/admin/support/reingest')).data
  },
}
