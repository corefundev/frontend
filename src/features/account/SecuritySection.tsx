// AC-2 (#313) — Безопасность. Правки владельца 2026-07-28 (#472): один
// общий лист (без карточки на каждую группу), заголовки групп остаются;
// журнал входов — раздел «Журнал авторизаций», API-ключ — «Интеграция».
import { useState } from 'react'
import { useMutation, useQuery } from '@tanstack/react-query'
import toast from 'react-hot-toast'

import { Link, useNavigate } from 'react-router-dom'

import { apiClient, errorMessage } from '../../shared/api/client'
import { authApi } from '../auth/api'
import { clientsApi } from '../clients/api'
import { useAuthStore } from '../auth/store'
import { twofaApi } from './twofa/api'
import { SecRow } from './shared'
import { fmtTs, type AuditResponse } from './audit'

const PROVIDER_LABEL: Record<string, string> = { google: 'Google', yandex: 'Яндекс', vk: 'VK' }

const IconMail = (
  <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"><rect x="3" y="5" width="18" height="14" rx="2"/><path d="m3 7 9 6 9-6"/></svg>
)
const IconLock = (
  <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"><rect x="4" y="11" width="16" height="9" rx="2"/><path d="M8 11V7a4 4 0 0 1 8 0v4"/></svg>
)
const IconShield = (
  <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"><path d="M12 3l7 3v5c0 4.5-3 8.5-7 10-4-1.5-7-5.5-7-10V6z"/></svg>
)

export default function SecuritySection() {
  const clientId = useAuthStore((s) => s.clientId)!
  const [pwdOpen, setPwdOpen] = useState(false)

  const { data: rec } = useQuery({ queryKey: ['client', clientId], queryFn: () => clientsApi.get(clientId) })
  const { data: audit } = useQuery({
    queryKey: ['account-audit', clientId],
    queryFn: async () => (await apiClient.get<AuditResponse>(`/clients/${clientId}/audit`, { params: { limit: 20 } })).data,
  })

  // подзаголовок строки «Пароль»: дата последней смены из журнала событий
  const lastPwdChange = audit?.events?.find((e) => e.event_type === 'password_change')
  const pwdSubtitle = lastPwdChange
    ? `Изменён ${fmtTs(lastPwdChange.ts)}`
    : 'Используется для входа по email'

  // 2FA-1 #587: статус двухэтапной аутентификации
  const { data: twofa } = useQuery({
    queryKey: ['twofa-status', clientId],
    queryFn: () => twofaApi.status(clientId),
    meta: { silent: true },
    retry: 1,
  })
  const twofaSubtitle = twofa == null
    ? 'Дополнительная защита входа'
    : twofa.protected
      ? <span className="text-moss">Включена</span>
      : 'Отключена — рекомендуем включить'

  // правка владельца 2026-07-28: без отдельных карточек-блоков — один
  // общий лист, но заголовки групп остаются (референс Т-Банка)
  return (
    <section className="card p-6 sm:p-8">
      <h3 className="text-base font-semibold text-ink mb-1">Данные аккаунта</h3>
      <div className="divide-y divide-surface-border">
        <SecRow
          icon={IconMail}
          title="Электронная почта"
          subtitle={rec?.email ?? '—'}
        />
      </div>

      <h3 className="text-base font-semibold text-ink mb-1 mt-6">Способ входа в аккаунт</h3>
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
        <SecRow
          icon={IconShield}
          title="Двухэтапная аутентификация"
          subtitle={twofaSubtitle}
          action={
            <Link className="btn-secondary inline-block" to="/app/account/security/2fa">
              Изменить
            </Link>
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
