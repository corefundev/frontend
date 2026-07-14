import { useEffect, useMemo, useRef, useState } from 'react'
import { useMutation } from '@tanstack/react-query'
import { Link, useNavigate, useSearchParams } from 'react-router-dom'
import toast from 'react-hot-toast'

import { authApi } from '../features/auth/api'
import { useAuthStore } from '../features/auth/store'
import AuthShell from '../components/AuthShell'
import { PasswordInput } from '../components/PasswordInput'
import { SsoBadges, SsoDivider } from '../components/SsoBadges'
import { errorMessage } from '../shared/api/client'

// ─────────────────────────────────────────────────────────────────────────
//  LoginPage — AUTH-3 #447: классический вход email + пароль.
//
//  Флоу владельца: подтверждение почты кодом → пользователь входит СВОИМ
//  паролем (?confirmed=1 с /signup/verify показывает бейдж и подставляет
//  email; ?reset=1 — после смены пароля). Бэкенд ставит httpOnly
//  remember-me куку — возврат в кабинет без пароля (silent refresh).
//  Капча — ПО ТРЕБОВАНИЮ сервера (решение владельца: после 2 неудач):
//  виджет скрыт, пока /auth/login/password не ответит 422
//  «captcha_token is required» — тогда показываем и повторяем.
// ─────────────────────────────────────────────────────────────────────────

const TURNSTILE_SITE_KEY = import.meta.env.VITE_TURNSTILE_SITE_KEY as string | undefined

export default function LoginPage() {
  const nav = useNavigate()
  const setAuth = useAuthStore((s) => s.setAuth)
  const [params] = useSearchParams()

  const confirmed = params.get('confirmed') === '1'
  const afterReset = params.get('reset') === '1'
  const prefillEmail = useMemo(() => (params.get('email') ?? '').toLowerCase(), [params])

  const [email, setEmail] = useState(prefillEmail)
  const [password, setPassword] = useState('')
  const [captcha, setCaptcha] = useState('')
  const [captchaNeeded, setCaptchaNeeded] = useState(false)

  const login = useMutation({
    mutationFn: () => authApi.loginPassword({
      email: email.trim().toLowerCase(),
      password,
      captcha_token: captcha || undefined,
    }),
    onSuccess: (resp) => {
      setAuth(resp.access_token, resp.client_id)
      toast.success(`Добро пожаловать, ${resp.client_id}`)
      nav('/app', { replace: true })
    },
    onError: (e) => {
      // Сервер требует капчу после 2 неудач — показать виджет и не
      // сбрасывать пароль (пользователь просто решает капчу и повторяет).
      const detail = errorMessage(e, '')
      const status = (e as { response?: { status?: number } })?.response?.status
      if (status === 422 && detail.includes('captcha_token')) {
        setCaptchaNeeded(true)
        toast.error('Подтвердите, что вы не робот, и повторите вход')
        return
      }
      setPassword('')
      toast.error(errorMessage(e, 'Не удалось войти'))
    },
  })

  return (
    <AuthShell>
      <h1 className="text-[28px] font-bold text-ink text-center">Авторизация</h1>

      {confirmed && (
        <div className="mt-5 rounded-md bg-success-bg text-success px-4 py-2.5 text-sm font-medium text-center">
          ✓ Почта подтверждена — войдите с вашим паролем
        </div>
      )}
      {afterReset && (
        <div className="mt-5 rounded-md bg-success-bg text-success px-4 py-2.5 text-sm font-medium text-center">
          ✓ Пароль изменён — войдите с новым паролем
        </div>
      )}

      <div className="mt-9">
        <SsoBadges />
      </div>
      <SsoDivider label="или" />

      <form
          onSubmit={(e) => {
            e.preventDefault()
            if (!email.trim()) return toast.error('Введите email')
            if (!password) return toast.error('Введите пароль')
            if (captchaNeeded && !captcha) return toast.error('Пройдите captcha')
            login.mutate()
          }}
        >
          <label className="label" htmlFor="email">Емейл</label>
          <input
            id="email"
            type="email"
            className="input"
            placeholder="name@example.com"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            autoComplete="email"
            required
          />

          <label className="label mt-5" htmlFor="password">Введите пароль</label>
          <PasswordInput
            id="password"
            placeholder="Пароль"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            autoComplete="current-password"
            required
          />
          <div className="mt-2">
            <Link to="/forgot" className="text-sm text-brand-500">
              Восстановить пароль
            </Link>
          </div>

          {TURNSTILE_SITE_KEY && captchaNeeded && (
            <div className="mt-5">
              <TurnstileWidget siteKey={TURNSTILE_SITE_KEY} onToken={setCaptcha} />
            </div>
          )}

          <button
            type="submit"
            className="btn-primary block mx-auto px-10 mt-8"
            disabled={login.isPending}
          >
            {login.isPending ? 'Вход…' : 'Авторизоваться'}
          </button>
        </form>

      <p className="text-sm text-ink text-center mt-6 font-medium">
        Нет аккаунта?{' '}
        <Link to="/signup" className="text-brand-500 font-normal">
          Зарегистрируйтесь
        </Link>
      </p>
    </AuthShell>
  )
}

// ── Turnstile widget (локальная копия; см. коммент в SignupPage) ────────

function TurnstileWidget({
  siteKey, onToken,
}: {
  siteKey: string
  onToken: (t: string) => void
}) {
  // useEffect-based mount, NOT a callback ref. A callback ref's identity
  // changes on every parent re-render, which makes turnstile.render()
  // fire on every keystroke (severe lag + the widget keeps resetting).
  const elRef = useRef<HTMLDivElement | null>(null)
  const cbRef = useRef(onToken)
  cbRef.current = onToken

  useEffect(() => {
    const el = elRef.current
    if (!el) return

    if (!document.querySelector('script[data-turnstile]')) {
      const s = document.createElement('script')
      s.src = 'https://challenges.cloudflare.com/turnstile/v0/api.js'
      s.async = true; s.defer = true
      s.dataset.turnstile = '1'
      document.head.appendChild(s)
    }

    let widgetId: string | undefined
    let cancelled = false

    const tryRender = () => {
      if (cancelled) return
      const turnstile = window.turnstile
      if (!turnstile) { setTimeout(tryRender, 100); return }
      el.innerHTML = ''
      widgetId = turnstile.render(el, {
        sitekey: siteKey,
        theme: 'light',
        callback: (t: string) => cbRef.current(t),
        'error-callback': () => cbRef.current(''),
        'expired-callback': () => cbRef.current(''),
      })
    }
    tryRender()

    return () => {
      cancelled = true
      const turnstile = window.turnstile
      if (turnstile && widgetId) {
        try { turnstile.remove(widgetId) } catch { /* widget already gone */ }
      }
    }
  }, [siteKey])

  return <div ref={elRef} className="flex justify-center" />
}
