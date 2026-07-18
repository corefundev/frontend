// Profile menu — top-right account dropdown. A compact launcher: account id,
// a link into the Account Center (/app/account, where profile/security/data
// live), and logout. The 152-ФЗ PII controls (export / close account) moved to
// the account "Данные и приватность" section (AC-3 #314).
import { useEffect, useRef, useState } from 'react'
import { authApi } from '../auth/api'
import { useNavigate } from 'react-router-dom'

import { useAuthStore } from '../auth/store'
import { cabPath } from '../../shared/hostRouting'

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
    document.addEventListener('mousedown', onDown)
    return () => document.removeEventListener('mousedown', onDown)
  }, [open])

  return (
    <div className="relative" ref={rootRef}>
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        aria-label="Личный кабинет"
        className="flex h-9 w-9 items-center justify-center rounded-md text-ink-muted hover:text-ink hover:bg-surface-sunken transition-colors"
      >
        <IconUser className="h-5 w-5" />
      </button>

      {open && (
        <div className="absolute right-0 top-11 z-50 w-72 max-w-[calc(100vw-2rem)] rounded-lg border border-surface-border bg-surface-raised shadow-lg overflow-hidden">
          <div className="px-4 py-3 border-b border-surface-border">
            <div className="text-xs text-ink-muted">Аккаунт</div>
            <div className="font-mono text-sm text-ink truncate">{clientId ?? '—'}</div>
            <button
              className="mt-2 text-sm text-brand-700 hover:underline"
              onClick={() => { setOpen(false); nav(cabPath('/app/account')) }}
            >
              Все настройки аккаунта →
            </button>
          </div>

          <button
            className="w-full text-left px-4 py-3 text-sm text-ink-muted hover:text-ink hover:bg-surface-sunken transition-colors"
            onClick={() => { void authApi.logout().catch(() => undefined); logout(); nav('/login') }}
          >
            Выйти
          </button>
        </div>
      )}
    </div>
  )
}

function IconUser({ className }: { className?: string }) {
  return (
    <svg className={className} viewBox="0 0 24 24" fill="none" stroke="currentColor"
         strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2" />
      <circle cx="12" cy="7" r="4" />
    </svg>
  )
}
