// NC-9 (#584): текстовые константы уведомлений (отдельно от компонента —
// react-refresh требует component-only файлов).
import type { NotificationSeverity } from './api'

export const TYPE_LABEL: Record<string, string> = {
  announcement: 'анонс',
  system: 'система',
}

export const SEVERITY_TEXT: Record<NotificationSeverity, { label: string; cls: string }> = {
  info:    { label: 'Информация',     cls: 'text-brand-600' },
  success: { label: 'Успех',          cls: 'text-emerald-600' },
  warning: { label: 'Предупреждение', cls: 'text-amber-600' },
  error:   { label: 'Ошибка',         cls: 'text-red-600' },
}
