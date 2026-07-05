// src/features/notifications/api.ts
//
// Notification channel management — currently only Telegram has a
// linking flow (email is on by default and uses the account's email
// address from sign-up).

import { apiClient } from '../../shared/api/client'

export interface TelegramStatus {
  linked: boolean
  bot:    string         // bot username, e.g. "syntheicbot"
  training_complete_enabled: boolean
}

export interface TelegramLinkToken {
  token:          string
  url:            string  // https://t.me/<bot>?start=<token>
  expires_in_sec: number  // typically 600
}

export const notificationsApi = {
  // GET /clients/{id}/telegram
  getTelegramStatus: (clientId: string) =>
    apiClient
      .get<TelegramStatus>(`/clients/${clientId}/telegram`)
      .then((r) => r.data),

  // POST /clients/{id}/telegram/link-token
  createLinkToken: (clientId: string) =>
    apiClient
      .post<TelegramLinkToken>(`/clients/${clientId}/telegram/link-token`)
      .then((r) => r.data),

  // DELETE /clients/{id}/telegram
  unlink: (clientId: string) =>
    apiClient
      .delete(`/clients/${clientId}/telegram`)
      .then(() => undefined),
}

// ── In-account notification center (NC-2 #242; backend NC-1 #241) ────────────
// GET  /clients/{id}/notifications        → inbox list + unread count
// POST /clients/{id}/notifications/read   → mark ids (or all) read

export type NotificationSeverity = 'info' | 'success' | 'warning' | 'error'

export interface AppNotification {
  id: number
  type: string
  severity: NotificationSeverity
  title: string
  body: string
  created_at: string
  read_at: string | null
}

export interface NotificationsResponse {
  notifications: AppNotification[]
  count: number
  unread: number
}

export async function getNotifications(
  clientId: string,
  limit = 20,
): Promise<NotificationsResponse> {
  const { data } = await apiClient.get<NotificationsResponse>(
    `/clients/${encodeURIComponent(clientId)}/notifications`,
    { params: { limit } },
  )
  return data
}

export async function markNotificationsRead(
  clientId: string,
  ids?: number[],
): Promise<{ marked: number }> {
  const { data } = await apiClient.post<{ marked: number }>(
    `/clients/${encodeURIComponent(clientId)}/notifications/read`,
    { ids: ids ?? null },
  )
  return data
}
