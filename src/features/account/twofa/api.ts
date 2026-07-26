// 2FA-1 (#587) slice C: клиентский API управления двухэтапной
// аутентификацией (slice A на бэке). Опасные действия (отключение,
// резервные коды) несут re-auth-поля: живой TOTP-код, резервный код
// или пароль — сервер проверяет цепочкой, 403 generic.
import { apiClient } from '../../../shared/api/client'

export interface TwoFAStatus {
  totp_enabled: boolean
  totp_pending: boolean
  email_enabled: boolean
  backup_left: number
  protected: boolean
}

export interface TwoFAEnrollResponse {
  secret: string
  otpauth_uri: string
}

export interface ReauthPayload {
  code?: string
  password?: string
}

export const twofaApi = {
  status: (clientId: string) =>
    apiClient.get<TwoFAStatus>(`/clients/${clientId}/2fa`).then((r) => r.data),
  enroll: (clientId: string) =>
    apiClient.post<TwoFAEnrollResponse>(`/clients/${clientId}/2fa/totp/enroll`)
      .then((r) => r.data),
  confirmTotp: (clientId: string, code: string) =>
    apiClient.post<{ totp_enabled: boolean }>(
      `/clients/${clientId}/2fa/totp/confirm`, { code }).then((r) => r.data),
  disableTotp: (clientId: string, reauth: ReauthPayload) =>
    apiClient.delete<{ totp_enabled: boolean }>(
      `/clients/${clientId}/2fa/totp`, { data: reauth }).then((r) => r.data),
  emailToggle: (clientId: string, payload: ReauthPayload & { enabled: boolean }) =>
    apiClient.put<{ email_enabled: boolean }>(
      `/clients/${clientId}/2fa/email`, payload).then((r) => r.data),
  backupCodes: (clientId: string, reauth: ReauthPayload) =>
    apiClient.post<{ codes: string[]; count: number }>(
      `/clients/${clientId}/2fa/backup-codes`, reauth).then((r) => r.data),
}
