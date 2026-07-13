// AC-2 (#313) — Безопасность. API-key rotation (one-time reveal) + login
// history + sign-in methods (read). All from existing endpoints. OAuth
// link/unlink is a follow-up (unlink needs a backend endpoint + last-method guard).
import { useState } from 'react'
import { useMutation, useQuery } from '@tanstack/react-query'
import toast from 'react-hot-toast'

import { useNavigate } from 'react-router-dom'

import { apiClient, errorMessage } from '../../shared/api/client'
import { authApi } from '../auth/api'
import { clientsApi } from '../clients/api'
import { useAuthStore } from '../auth/store'

const PROVIDER_LABEL: Record<string, string> = { google: 'Google', yandex: 'Яндекс', vk: 'VK' }

interface SecurityEvent { ts: string; event_type: string; event_subtype: string | null; ip: string | null }
interface AuditResponse { count: number; events: SecurityEvent[] }

const EVENT_LABEL: Record<string, string> = {
  login: 'Вход', logout: 'Выход', otp_verify: 'Подтверждение кода',
  oauth_callback: 'Вход через провайдера', signup: 'Регистрация',
  plan_change: 'Смена тарифа', email_change: 'Смена email',
  password_change: 'Смена ключа/доступа',
}

function fmtTs(iso: string): string {
  const d = new Date(iso)
  return Number.isNaN(d.getTime()) ? iso : d.toLocaleString('ru-RU', { dateStyle: 'medium', timeStyle: 'short' })
}

export default function SecuritySection() {
  const clientId = useAuthStore((s) => s.clientId)!
  const [newKey, setNewKey] = useState<string | null>(null)

  const { data: rec } = useQuery({ queryKey: ['client', clientId], queryFn: () => clientsApi.get(clientId) })
  const { data: audit } = useQuery({
    queryKey: ['account-audit', clientId],
    queryFn: async () => (await apiClient.get<AuditResponse>(`/clients/${clientId}/audit`, { params: { limit: 20 } })).data,
  })

  const { mutate: rotate, isPending: rotating } = useMutation({
    mutationFn: () => clientsApi.rotateApiKey(clientId),
    onSuccess: (d) => { setNewKey(d.api_key); toast.success('Ключ обновлён') },
    onError: (e) => toast.error(errorMessage(e, 'Не удалось обновить ключ')),
  })

  return (
    <div className="space-y-6">
      {/* Sign-in methods */}
      <section className="card p-6 sm:p-8">
        <div className="text-sm text-ink-muted mb-2">Способы входа</div>
        <ul className="text-sm text-ink space-y-1">
          <li>• Email + пароль{rec?.email ? ` — ${rec.email}` : ''}</li>
          {rec?.oauth_provider && <li>• {PROVIDER_LABEL[rec.oauth_provider] ?? rec.oauth_provider}</li>}
        </ul>
      </section>

      {/* AUTH-3 #447: смена пароля. После успеха сервер отзывает ВСЕ
          сессии (включая текущую) — честно разлогиниваем и ведём на вход. */}
      <PasswordChangeCard />

      {/* API key */}
      <section className="card p-6 sm:p-8">
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
          <div>
            <div className="font-medium text-ink">API-ключ</div>
            <p className="text-sm text-ink-muted mt-1 max-w-md">
              Для интеграций (1С и др.). При обновлении старый ключ сразу
              перестаёт работать.
            </p>
          </div>
          <button className="btn-secondary shrink-0" onClick={() => rotate()} disabled={rotating}>
            {rotating ? 'Обновляю…' : 'Обновить ключ'}
          </button>
        </div>
        {newKey && (
          <div className="mt-4 rounded-lg border border-brand-200 bg-brand-50 p-4">
            <p className="text-sm text-ink mb-2">
              Сохраните ключ — он показывается один раз:
            </p>
            <div className="flex items-center gap-2">
              <code className="flex-1 text-xs bg-surface-raised border border-surface-border rounded px-3 py-2 font-mono break-all">{newKey}</code>
              <button
                className="btn-secondary shrink-0"
                onClick={() => { navigator.clipboard?.writeText(newKey); toast.success('Скопировано') }}
              >
                Копировать
              </button>
            </div>
          </div>
        )}
      </section>

      {/* Login history */}
      <section className="card p-6 sm:p-8">
        <div className="font-medium text-ink mb-4">История входов и событий</div>
        {!audit?.events?.length ? (
          <p className="text-sm text-ink-muted">Пока нет событий.</p>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="text-left text-ink-muted border-b border-surface-border">
                  <th className="py-2 pr-4 font-medium">Событие</th>
                  <th className="py-2 pr-4 font-medium">Когда</th>
                  <th className="py-2 font-medium">IP</th>
                </tr>
              </thead>
              <tbody>
                {audit.events.map((e, i) => (
                  <tr key={i} className="border-b border-surface-border last:border-b-0">
                    <td className="py-2 pr-4 text-ink">{EVENT_LABEL[e.event_type] ?? e.event_type}</td>
                    <td className="py-2 pr-4 text-ink-muted">{fmtTs(e.ts)}</td>
                    <td className="py-2 text-ink-muted font-mono text-xs">{e.ip ?? '—'}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </section>
    </div>
  )
}


function PasswordChangeCard() {
  const nav = useNavigate()
  const logout = useAuthStore((s) => s.logout)
  const [current, setCurrent] = useState('')
  const [next, setNext] = useState('')
  const [next2, setNext2] = useState('')

  const { mutate, isPending } = useMutation({
    mutationFn: () => authApi.changePassword({
      current_password: current || undefined,
      new_password: next,
    }),
    onSuccess: () => {
      toast.success('Пароль изменён — войдите с новым паролем')
      void authApi.logout().catch(() => undefined)
      logout()
      nav('/login?reset=1', { replace: true })
    },
    onError: (e) => toast.error(errorMessage(e, 'Не удалось сменить пароль')),
  })

  return (
    <section className="card p-6 sm:p-8">
      <div className="font-medium text-ink">Пароль</div>
      <p className="text-xs text-ink-muted mt-1 mb-4">
        После смены пароля все активные сессии будут завершены — вход с новым паролем.
      </p>
      <form
        className="max-w-sm space-y-3"
        onSubmit={(e) => {
          e.preventDefault()
          if (next.length < 10) return toast.error('Пароль — не менее 10 символов')
          if (next !== next2) return toast.error('Пароли не совпадают')
          mutate()
        }}
      >
        <div>
          <label className="label" htmlFor="cur-pwd">Текущий пароль</label>
          <input id="cur-pwd" type="password" className="input" value={current}
                 onChange={(e) => setCurrent(e.target.value)}
                 autoComplete="current-password"
                 placeholder="если пароля ещё нет — оставьте пустым" />
        </div>
        <div>
          <label className="label" htmlFor="new-pwd">Новый пароль</label>
          <input id="new-pwd" type="password" className="input" value={next}
                 onChange={(e) => setNext(e.target.value)}
                 autoComplete="new-password" required minLength={10} maxLength={128} />
        </div>
        <div>
          <label className="label" htmlFor="new-pwd2">Повторите новый пароль</label>
          <input id="new-pwd2" type="password" className="input" value={next2}
                 onChange={(e) => setNext2(e.target.value)}
                 autoComplete="new-password" required />
        </div>
        <button type="submit" className="btn-primary" disabled={isPending}>
          {isPending ? 'Сохранение…' : 'Сменить пароль'}
        </button>
      </form>
    </section>
  )
}
