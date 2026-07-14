import { useEffect, useState } from 'react'
import { useMutation, useQuery } from '@tanstack/react-query'
import { Link, useNavigate, useSearchParams } from 'react-router-dom'
import toast from 'react-hot-toast'

import { authApi } from '../features/auth/api'
import AuthShell from '../components/AuthShell'
import { errorMessage } from '../shared/api/client'

// ─────────────────────────────────────────────────────────────────────────
//  ResetPasswordPage — AUTH-3 #447: лендинг ссылки сброса (/auth/reset?token=).
//
//  Сканеро-безопасность: открытие страницы токен НЕ тратит — /peek лишь
//  валидирует (показать форму или «ссылка устарела» ДО ввода пароля).
//  Токен расходуется только POST-ом формы. После успеха — на /login?reset=1,
//  все прежние сессии отозваны сервером.
// ─────────────────────────────────────────────────────────────────────────

const PASSWORD_MIN = 10

export default function ResetPasswordPage() {
  const nav = useNavigate()
  const [params] = useSearchParams()
  const token = params.get('token') ?? ''

  const [password, setPassword] = useState('')
  const [password2, setPassword2] = useState('')

  const peek = useQuery({
    queryKey: ['reset-peek', token],
    queryFn: () => authApi.resetPeek(token),
    enabled: !!token,
    retry: 1,
    staleTime: Infinity,
    meta: { silent: true },
  })

  useEffect(() => {
    if (!token) nav('/forgot', { replace: true })
  }, [token, nav])

  const { mutate, isPending } = useMutation({
    mutationFn: () => authApi.resetConfirm({ token, new_password: password }),
    onSuccess: () => {
      toast.success('Пароль изменён')
      nav('/login?reset=1', { replace: true })
    },
    onError: (e) => toast.error(errorMessage(e, 'Не удалось сменить пароль')),
  })

  if (peek.isLoading) {
    return <Shell><div className="h-40" aria-hidden /></Shell>
  }

  if (peek.isError || peek.data?.valid === false) {
    return (
      <Shell>
        <div className="text-center">
          <div className="text-3xl mb-3" aria-hidden>⏱</div>
          <h1 className="display-em text-brand-700 text-2xl">Ссылка недействительна</h1>
          <p className="text-sm text-ink-muted mt-3">
            Ссылка устарела или уже была использована.
            Запросите новую — это занимает минуту.
          </p>
          <Link to="/forgot" className="btn-primary w-full mt-6 inline-block">
            Запросить новую ссылку
          </Link>
          <p className="text-xs text-ink-subtle text-center mt-4">
            <Link to="/login" className="text-brand-500 underline underline-offset-2">
              ← Назад ко входу
            </Link>
          </p>
        </div>
      </Shell>
    )
  }

  return (
    <Shell>
      <h1 className="display-em text-brand-700 text-2xl">Новый пароль</h1>
      <form
        className="mt-5"
        onSubmit={(e) => {
          e.preventDefault()
          if (password.length < PASSWORD_MIN)
            return toast.error(`Пароль — не менее ${PASSWORD_MIN} символов`)
          if (password !== password2) return toast.error('Пароли не совпадают')
          mutate()
        }}
      >
        <label className="label" htmlFor="password">Новый пароль</label>
        <input
          id="password"
          type="password"
          className="input"
          value={password}
          onChange={(e) => setPassword(e.target.value)}
          autoComplete="new-password"
          required
          minLength={PASSWORD_MIN}
          maxLength={128}
        />
        <p className="eyebrow mt-1.5">
          Не менее {PASSWORD_MIN} символов. Спецсимволы не обязательны — длина важнее.
        </p>

        <label className="label mt-4" htmlFor="password2">Повторите пароль</label>
        <input
          id="password2"
          type="password"
          className="input"
          value={password2}
          onChange={(e) => setPassword2(e.target.value)}
          autoComplete="new-password"
          required
        />

        <button type="submit" className="btn-primary w-full mt-6" disabled={isPending}>
          {isPending ? 'Сохранение…' : 'Сменить пароль'}
        </button>
        <p className="text-xs text-ink-subtle text-center mt-4">
          После смены активные сессии на других устройствах будут завершены.
        </p>
      </form>
    </Shell>
  )
}

function Shell({ children }: { children: React.ReactNode }) {
  return (
    <AuthShell>
      <div className="w-full max-w-md card p-8 animate-fade-in">{children}</div>
    </AuthShell>
  )
}
