// src/features/notifications/api.ts
// NC-2 (#242): in-account notification center (backend NC-1 #241).
// GET  /clients/{id}/notifications        → list + unread count
// POST /clients/{id}/notifications/read   → mark ids (or all) read

import { apiClient } from '../../shared/api/client'

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
  const { data } = await apiClient.get(
    `/clients/${encodeURIComponent(clientId)}/notifications`,
    { params: { limit } },
  )
  return data
}

export async function markNotificationsRead(
  clientId: string,
  ids?: number[],
): Promise<{ marked: number }> {
  const { data } = await apiClient.post(
    `/clients/${encodeURIComponent(clientId)}/notifications/read`,
    { ids: ids ?? null },
  )
  return data
}
