// Profile menu — редизайн 2026-07-26 (прототип cabinet_design): аватар =
// первые цифры ID; меню — шапка «ID: XXXXXX» + новости / база знаний /
// настройки кабинета + выход (правки владельца 2026-07-28).
// 152-ФЗ PII-контролы живут в «Данные и приватность».
import { useEffect, useRef, useState } from 'react'
import { authApi } from '../auth/api'
import { useNavigate } from 'react-router-dom'

import { useAuthStore } from '../auth/store'
import { cabPath } from '../../shared/hostRouting'

// Состав меню — правки владельца 2026-07-28: ID (шапка), новости,
// база знаний, настройки личного кабинета, выход.
const ITEMS = [
  { to: '/app/news',            label: 'Новости' },
  { to: '/app/help',            label: 'База знаний' },
  { to: '/app/account/profile', label: 'Настройки' },
] as const

export function ProfileMenu() {
  const nav = useNavigate()
  const clientId = useAuthStore((s) => s.clientId)
  const logout = useAuthStore((s) => s.logout)

  const [open, setOpen] = useState(false)
  const rootRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    if (!open) return
    function onDown(e: MouseEvent) {
      if (rootRef.current && !rootRef.current.contains(e.target as Node)) {
        setOpen(false)
      }
    }
    function onKey(e: KeyboardEvent) { if (e.key === 'Escape') setOpen(false) }
    document.addEventListener('mousedown', onDown)
    document.addEventListener('keydown', onKey)
    return () => {
      document.removeEventListener('mousedown', onDown)
      document.removeEventListener('keydown', onKey)
    }
  }, [open])

  const go = (to: string) => { setOpen(false); nav(cabPath(to)) }
  // аватар: первые 2 цифры цифрового ID; фолбэк — первая буква
  const avatarText = (clientId ?? '?').replace(/\D/g, '').slice(0, 2)
    || (clientId ?? '?').slice(0, 1).toUpperCase()

  return (
    <div className="relative" ref={rootRef}>
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        aria-label="Личный кабинет"
        aria-expanded={open}
        className="flex h-8 w-8 items-center justify-center rounded-full bg-brand-50 text-[13px] font-extrabold text-brand-700 transition-transform hover:scale-105"
      >
        {avatarText}
      </button>

      {open && (
        <div className="absolute right-0 top-11 z-50 w-64 max-w-[calc(100vw-2rem)] rounded-lg border border-surface-border bg-surface-raised shadow-lg overflow-hidden">
          <div className="px-4 py-2.5 border-b border-surface-border text-[12px] font-bold text-ink-faint">
            ID: <span className="font-mono">{clientId ?? '—'}</span>
          </div>

          {ITEMS.map((i) => (
            <button
              key={i.to}
              className="block w-full text-left px-4 py-2.5 text-sm font-semibold text-ink hover:bg-surface-sunken transition-colors"
              onClick={() => go(i.to)}
            >
              {i.label}
            </button>
          ))}

          <div className="h-px bg-surface-border" />
          <button
            className="block w-full text-left px-4 py-2.5 text-sm text-ink-muted hover:text-ink hover:bg-surface-sunken transition-colors"
            onClick={async () => {
              // #126: сначала отзыв на сервере (иначе гонка с интерсептором
              // теряет Authorization), потом локальная очистка.
              try { await authApi.logout() } catch { /* revoke best-effort */ }
              logout()
              nav('/login')
            }}
          >
            Выйти
          </button>
        </div>
      )}
    </div>
  )
}
