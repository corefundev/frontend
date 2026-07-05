// src/features/notifications/NotificationBell.tsx
// NC-2 (#242): header bell — unread badge + dropdown inbox.
//
// Polls unread state every 30s with meta:{silent:true} (PjaxLoader
// discipline — background polls must not flash the top bar). Opening the
// panel marks everything read (badge clears optimistically via query
// invalidation). Pure read surface; emitters live on the backend (NC-1).

import { useEffect, useRef, useState } from 'react'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'

import { useAuthStore } from '../auth/store'
import {
  getNotifications,
  markNotificationsRead,
  type AppNotification,
  type NotificationSeverity,
} from './api'

const SEVERITY_DOT: Record<NotificationSeverity, string> = {
  info:    'bg-brand-500',
  success: 'bg-emerald-500',
  warning: 'bg-amber-500',
  error:   'bg-red-500',
}

function timeAgo(iso: string): string {
  const sec = Math.max(0, (Date.now() - new Date(iso).getTime()) / 1000)
  if (sec < 60) return 'только что'
  const min = Math.floor(sec / 60)
  if (min < 60) return `${min} мин назад`
  const h = Math.floor(min / 60)
  if (h < 24) return `${h} ч назад`
  const d = Math.floor(h / 24)
  return `${d} дн назад`
}

function Row({ n }: { n: AppNotification }) {
  return (
    <li className="flex gap-3 px-4 py-3 border-b border-surface-border last:border-b-0">
      <span
        className={`mt-1.5 h-2 w-2 shrink-0 rounded-full ${SEVERITY_DOT[n.severity] ?? SEVERITY_DOT.info} ${n.read_at ? 'opacity-30' : ''}`}
        aria-hidden
      />
      <div className="min-w-0">
        <div className={`text-sm ${n.read_at ? 'text-ink-muted' : 'text-ink font-medium'}`}>
          {n.title}
        </div>
        {n.body && (
          <div className="text-xs text-ink-muted mt-0.5 break-words">{n.body}</div>
        )}
        <div className="text-[11px] text-ink-faint mt-1">{timeAgo(n.created_at)}</div>
      </div>
    </li>
  )
}

export function NotificationBell() {
  const clientId = useAuthStore((s) => s.clientId)
  const qc = useQueryClient()
  const [open, setOpen] = useState(false)
  const rootRef = useRef<HTMLDivElement>(null)

  const { data } = useQuery({
    queryKey: ['notifications', clientId],
    queryFn: () => getNotifications(clientId!),
    enabled: !!clientId,
    refetchInterval: 30_000,
    meta: { silent: true },
  })

  const markRead = useMutation({
    mutationFn: () => markNotificationsRead(clientId!),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['notifications', clientId] }),
  })

  // Close on outside click / Escape.
  useEffect(() => {
    if (!open) return
    const onDown = (e: MouseEvent) => {
      if (rootRef.current && !rootRef.current.contains(e.target as Node)) setOpen(false)
    }
    const onKey = (e: KeyboardEvent) => { if (e.key === 'Escape') setOpen(false) }
    document.addEventListener('mousedown', onDown)
    document.addEventListener('keydown', onKey)
    return () => {
      document.removeEventListener('mousedown', onDown)
      document.removeEventListener('keydown', onKey)
    }
  }, [open])

  if (!clientId) return null
  const unread = data?.unread ?? 0
  const items = data?.notifications ?? []

  const toggle = () => {
    const next = !open
    setOpen(next)
    if (next && unread > 0) markRead.mutate()
  }

  return (
    <div className="relative" ref={rootRef}>
      <button
        type="button"
        onClick={toggle}
        aria-label={unread > 0 ? `Уведомления: ${unread} непрочитанных` : 'Уведомления'}
        aria-expanded={open}
        className="relative flex h-9 w-9 items-center justify-center rounded-md text-ink-muted hover:text-ink hover:bg-surface-sunken transition-colors"
      >
        <IconBell className="h-5 w-5" />
        {unread > 0 && (
          <span className="absolute -top-0.5 -right-0.5 min-w-[18px] h-[18px] px-1 rounded-full bg-red-500 text-white text-[10px] font-semibold flex items-center justify-center">
            {unread > 99 ? '99+' : unread}
          </span>
        )}
      </button>

      {open && (
        <div className="absolute right-0 top-11 z-50 w-96 max-w-[calc(100vw-2rem)] rounded-lg border border-surface-border bg-surface-raised shadow-lg overflow-hidden">
          <div className="px-4 py-2.5 border-b border-surface-border text-sm font-semibold text-ink">
            Уведомления
          </div>
          {items.length === 0 ? (
            <div className="px-4 py-8 text-sm text-ink-muted text-center">
              Пока нет уведомлений
            </div>
          ) : (
            <ul className="max-h-96 overflow-y-auto">
              {items.map((n) => <Row key={n.id} n={n} />)}
            </ul>
          )}
        </div>
      )}
    </div>
  )
}

function IconBell({ className }: { className?: string }) {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8"
         strokeLinecap="round" strokeLinejoin="round" className={className} aria-hidden>
      <path d="M6 8a6 6 0 0 1 12 0c0 7 3 9 3 9H3s3-2 3-9" />
      <path d="M10.3 21a1.94 1.94 0 0 0 3.4 0" />
    </svg>
  )
}
