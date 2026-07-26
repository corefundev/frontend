// AC-2 (#313) — Безопасность. Редизайн по референсу владельца (2026-07-25):
// группы «Данные аккаунта» / «Способ входа в аккаунт» / «API-доступ», строки
// «иконка-кружок · заголовок + подзаголовок · кнопка справа». Состав — только
// РЕАЛЬНЫЕ механики: смена пароля (AUTH-3), ротация API-ключа, история
// событий. Телефон/2FA/восстановление по документам из референса не
// портированы — таких механик нет, мёртвые кнопки не рисуем (смена
// email = AC-4 #315, появится строкой при реализации).
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

// ── строка референса: кружок-иконка · текст · действие справа ────────────
function SecRow({ icon, title, subtitle, action }: {
  icon: React.ReactNode
  title: string
  subtitle: React.ReactNode
  action?: React.ReactNode
}) {
  return (
    <div className="flex items-center gap-4 py-3">
      <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-full bg-surface-sunken text-ink-muted">
        {icon}
      </div>
      <div className="min-w-0 flex-1">
        <div className="text-sm font-medium text-ink">{title}</div>
        <div className="text-sm text-ink-muted truncate">{subtitle}</div>
      </div>
      {action && <div className="shrink-0">{action}</div>}
    </div>
  )
}

function GroupTitle({ children }: { children: React.ReactNode }) {
  return <h3 className="text-base font-semibold text-ink mb-1">{children}</h3>
}

const IconMail = (
  <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"><rect x="3" y="5" width="18" height="14" rx="2"/><path d="m3 7 9 6 9-6"/></svg>
)
const IconLock = (
  <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"><rect x="4" y="11" width="16" height="9" rx="2"/><path d="M8 11V7a4 4 0 0 1 8 0v4"/></svg>
)
const IconShield = (
  <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"><path d="M12 3l7 3v5c0 4.5-3 8.5-7 10-4-1.5-7-5.5-7-10V6z"/></svg>
)
const IconKey = (
  <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"><circle cx="8" cy="15" r="4"/><path d="m11 12 9-9M17 6l3 3M14 9l2 2"/></svg>
)

export default function SecuritySection() {
  const clientId = useAuthStore((s) => s.clientId)!
  const [newKey, setNewKey] = useState<string | null>(null)
  const [pwdOpen, setPwdOpen] = useState(false)

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

  // подзаголовок строки «Пароль»: дата последней смены из журнала событий
  const lastPwdChange = audit?.events?.find((e) => e.event_type === 'password_change')
  const pwdSubtitle = lastPwdChange
    ? `Изменён ${fmtTs(lastPwdChange.ts)}`
    : 'Используется для входа по email'

  return (
    <div className="space-y-6">
      <section className="card p-6 sm:p-8">
        <GroupTitle>Данные аккаунта</GroupTitle>
        <div className="divide-y divide-surface-border">
          <SecRow
            icon={IconMail}
            title="Электронная почта"
            subtitle={rec?.email ?? '—'}
          />
        </div>
      </section>

      <section className="card p-6 sm:p-8">
        <GroupTitle>Способ входа в аккаунт</GroupTitle>
        <div className="divide-y divide-surface-border">
          <SecRow
            icon={IconLock}
            title="Пароль"
            subtitle={pwdSubtitle}
            action={
              <button className="btn-secondary" onClick={() => setPwdOpen((v) => !v)}>
                Изменить
              </button>
            }
          />
          {rec?.oauth_provider && (
            <SecRow
              icon={IconShield}
              title={`Вход через ${PROVIDER_LABEL[rec.oauth_provider] ?? rec.oauth_provider}`}
              subtitle={<span className="text-moss">Подключён</span>}
            />
          )}
        </div>
        {pwdOpen && <PasswordChangeForm />}
      </section>

      <section className="card p-6 sm:p-8">
        <GroupTitle>API-доступ</GroupTitle>
        <div className="divide-y divide-surface-border">
          <SecRow
            icon={IconKey}
            title="API-ключ"
            subtitle="Для интеграций (1С и др.). Старый ключ перестаёт работать сразу"
            action={
              <button className="btn-secondary" onClick={() => rotate()} disabled={rotating}>
                {rotating ? 'Обновляю…' : 'Обновить'}
              </button>
            }
          />
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


function PasswordChangeForm() {
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
    <div className="mt-4 border-t border-surface-border pt-4">
      <p className="text-xs text-ink-muted mb-4">
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
    </div>
  )
}
