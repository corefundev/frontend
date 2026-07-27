// Словарь и утилиты журнала событий аккаунта (react-refresh требует
// отделять не-компонентные экспорты от компонентов — см. shared.tsx).
export const EVENT_LABEL: Record<string, string> = {
  login: 'Вход', logout: 'Выход', otp_verify: 'Подтверждение кода',
  oauth_callback: 'Вход через провайдера', signup: 'Регистрация',
  plan_change: 'Смена тарифа', email_change: 'Смена email',
  password_change: 'Смена ключа/доступа', twofa: 'Двухэтапная аутентификация',
}

export function fmtTs(iso: string): string {
  const d = new Date(iso)
  return Number.isNaN(d.getTime()) ? iso : d.toLocaleString('ru-RU', { dateStyle: 'medium', timeStyle: 'short' })
}

export interface SecurityEvent { ts: string; event_type: string; event_subtype: string | null; ip: string | null }
export interface AuditResponse { count: number; events: SecurityEvent[] }
