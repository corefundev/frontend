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
