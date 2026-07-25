// NC-9 (#584, дизайн-прототип владельца 2026-07-26): иконка-кружок
// уведомления — язык референса «Безопасности» (Т-Банк): tinted circle +
// иконка по типу/severity; непрочитанное — брендовая точка на кружке.
import type { AppNotification, NotificationSeverity } from './api'

const TONE: Record<NotificationSeverity, string> = {
  info:    'bg-brand-50 text-brand-600',
  success: 'bg-emerald-50 text-emerald-600',
  warning: 'bg-amber-50 text-amber-600',
  error:   'bg-red-50 text-red-600',
}

function Glyph({ n }: { n: Pick<AppNotification, 'type' | 'severity'> }) {
  const common = {
    viewBox: '0 0 24 24', fill: 'none', stroke: 'currentColor',
    strokeWidth: 2, strokeLinecap: 'round', strokeLinejoin: 'round',
  } as const
  if (n.severity === 'warning' || n.severity === 'error') {
    return (
      <svg {...common}><path d="M10.3 3.9 1.8 18a2 2 0 0 0 1.7 3h17a2 2 0 0 0 1.7-3L13.7 3.9a2 2 0 0 0-3.4 0z" /><path d="M12 9v4M12 17h.01" /></svg>
    )
  }
  if (n.severity === 'success') {
    return (
      <svg {...common}><path d="M22 11.1V12a10 10 0 1 1-5.9-9.1" /><path d="m9 11 3 3L22 4" /></svg>
    )
  }
  if (n.type === 'announcement') {
    return (
      <svg {...common}><path d="M12 2 3 7v10l9 5 9-5V7z" /><path d="M12 22V12M3 7l9 5 9-5" /></svg>
    )
  }
  return (
    <svg {...common}><circle cx="12" cy="12" r="10" /><path d="M12 16v-5M12 8h.01" /></svg>
  )
}

export function NotificationIcon({ n, size = 'md' }: {
  n: Pick<AppNotification, 'type' | 'severity' | 'read_at'>
  size?: 'md' | 'lg'
}) {
  const dims = size === 'lg' ? 'h-[52px] w-[52px]' : 'h-10 w-10'
  const glyph = size === 'lg' ? 'h-6 w-6' : 'h-[19px] w-[19px]'
  return (
    <span className={`relative flex ${dims} shrink-0 items-center justify-center rounded-full ${TONE[n.severity] ?? TONE.info}`}>
      <span className={glyph}><Glyph n={n} /></span>
      {!n.read_at && (
        <span className="absolute -top-px -right-px h-[11px] w-[11px] rounded-full bg-brand-500 ring-[2.5px] ring-surface-raised" aria-hidden />
      )}
    </span>
  )
}
