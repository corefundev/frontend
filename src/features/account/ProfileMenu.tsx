// Profile menu — top-right account dropdown ("Личный кабинет", to be filled
// out over time). For now it hosts the B4 #156 (152-ФЗ) PII controls (export
// my data / close account) + logout. Matches NotificationBell's dropdown
// pattern (hand-rolled SVG, click-outside, absolute right-0 top-11).
import { useEffect, useRef, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { useMutation } from '@tanstack/react-query'
import toast from 'react-hot-toast'

import { apiClient, errorMessage } from '../../shared/api/client'
import { useAuthStore } from '../auth/store'

export function ProfileMenu() {
  const nav = useNavigate()
  const clientId = useAuthStore((s) => s.clientId)
  const logout = useAuthStore((s) => s.logout)

  const [open, setOpen] = useState(false)
  const [confirmClose, setConfirmClose] = useState(false)
  const rootRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    if (!open) return
    function onDown(e: MouseEvent) {
      if (rootRef.current && !rootRef.current.contains(e.target as Node)) {
        setOpen(false)
        setConfirmClose(false)
      }
    }
    document.addEventListener('mousedown', onDown)
    return () => document.removeEventListener('mousedown', onDown)
  }, [open])

  const { mutate: exportData, isPending: exporting } = useMutation({
    mutationFn: async () => {
      const { data } = await apiClient.get(`/clients/${clientId}/export`)
      return data
    },
    onSuccess: (data) => {
      const blob = new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' })
      const url = URL.createObjectURL(blob)
      const a = document.createElement('a')
      a.href = url
      a.download = `my-data-${clientId}.json`
      document.body.appendChild(a)
      a.click()
      a.remove()
      URL.revokeObjectURL(url)
      toast.success('Данные выгружены')
    },
    onError: (e) => toast.error(errorMessage(e, 'Не удалось выгрузить данные')),
  })

  const { mutate: closeAccount, isPending: closing } = useMutation({
    mutationFn: async () => { await apiClient.delete(`/clients/${clientId}`) },
    onSuccess: () => {
      toast.success('Аккаунт закрыт')
      setTimeout(() => { logout(); nav('/login') }, 1200)
    },
    onError: (e) => toast.error(errorMessage(e, 'Не удалось закрыть аккаунт')),
  })

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
              onClick={() => { setOpen(false); nav('/app/account') }}
            >
              Все настройки аккаунта →
            </button>
          </div>

          <div className="px-4 py-3 border-b border-surface-border">
            <div className="text-xs text-ink-muted mb-2">Данные и приватность (152-ФЗ)</div>
            <button
              className="w-full text-left text-sm text-ink hover:text-brand-700 disabled:opacity-50 py-1.5"
              onClick={() => exportData()}
              disabled={exporting}
            >
              {exporting ? 'Готовлю выгрузку…' : 'Скачать мои данные'}
            </button>

            {!confirmClose ? (
              <button
                className="w-full text-left text-sm text-danger hover:opacity-80 py-1.5"
                onClick={() => setConfirmClose(true)}
              >
                Закрыть аккаунт
              </button>
            ) : (
              <div className="mt-1 rounded-md border border-danger/40 bg-danger/5 p-3 space-y-2">
                <p className="text-xs text-ink leading-relaxed">
                  Доступ прекратится сразу. Данные хранятся ещё 30 дней, затем
                  удаляются безвозвратно.
                </p>
                <div className="flex items-center gap-2">
                  <button
                    className="text-xs font-medium text-white bg-danger hover:bg-danger/90 rounded px-2.5 py-1.5 disabled:opacity-50"
                    onClick={() => closeAccount()}
                    disabled={closing}
                  >
                    {closing ? 'Закрываю…' : 'Подтвердить'}
                  </button>
                  <button
                    className="text-xs text-ink-muted hover:text-ink px-2 py-1.5"
                    onClick={() => setConfirmClose(false)}
                    disabled={closing}
                  >
                    Отмена
                  </button>
                </div>
              </div>
            )}
          </div>

          <button
            className="w-full text-left px-4 py-3 text-sm text-ink-muted hover:text-ink hover:bg-surface-sunken transition-colors"
            onClick={() => { logout(); nav('/login') }}
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
