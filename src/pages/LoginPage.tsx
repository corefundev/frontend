import { useEffect, useMemo, useRef, useState } from 'react'
import { useMutation } from '@tanstack/react-query'
import { Link, useNavigate, useSearchParams } from 'react-router-dom'
import toast from 'react-hot-toast'

import { authApi } from '../features/auth/api'
import { useAuthStore } from '../features/auth/store'
import { SsoBadges } from '../components/SsoBadges'
import { errorMessage } from '../shared/api/client'

// ─────────────────────────────────────────────────────────────────────────
//  LoginPage — AUTH-3 #447: классический вход email + пароль.
//
//  Флоу владельца: подтверждение почты кодом → пользователь входит СВОИМ
//  паролем (?confirmed=1 с /signup/verify показывает бейдж и подставляет
//  email; ?reset=1 — после смены пароля). Бэкенд ставит httpOnly
//  remember-me куку — возврат в кабинет без пароля (silent refresh).
//  Капча рендерится всегда (если сконфигурирована) — сервер требует её
//  только после 2 неудач, лишний токен безвреден.
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
      setPassword('')
      toast.error(errorMessage(e, 'Не удалось войти'))
    },
  })

  return (
    <div className="min-h-screen bg-surface flex items-center justify-center p-6">
      <div className="w-full max-w-md card p-8 animate-fade-in">
        <div className="mb-6 flex flex-col items-center">
          <div
            aria-hidden
            className="h-12 w-12 rounded-md bg-brand-500 flex items-center justify-center text-ink-invert font-bold"
          >
            SKU
          </div>
          <h1 className="display-em text-brand-700 text-2xl mt-3">
            Вход в SKU&nbsp;Forecasting
          </h1>
        </div>

        {confirmed && (
          <div className="mb-5 rounded-md bg-success-bg text-success px-4 py-2.5 text-sm font-medium text-center">
            ✓ Почта подтверждена — войдите с вашим паролем
          </div>
        )}
        {afterReset && (
          <div className="mb-5 rounded-md bg-success-bg text-success px-4 py-2.5 text-sm font-medium text-center">
            ✓ Пароль изменён — войдите с новым паролем
          </div>
        )}

        <form
          onSubmit={(e) => {
            e.preventDefault()
            if (!email.trim()) return toast.error('Введите email')
            if (!password) return toast.error('Введите пароль')
            login.mutate()
          }}
        >
          <label className="label" htmlFor="email">Email</label>
          <input
            id="email"
            type="email"
            className="input"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            autoComplete="email"
            required
          />

          <label className="label mt-4" htmlFor="password">Пароль</label>
          <input
            id="password"
            type="password"
            className="input"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            autoComplete="current-password"
            required
          />
          <div className="flex justify-end mt-1.5">
            <Link to="/forgot" className="text-xs text-brand-500 underline underline-offset-2">
              Забыли пароль?
            </Link>
          </div>

          {TURNSTILE_SITE_KEY && (
            <div className="mt-4">
              <TurnstileWidget siteKey={TURNSTILE_SITE_KEY} onToken={setCaptcha} />
            </div>
          )}

          <button
            type="submit"
            className="btn-primary w-full mt-5"
            disabled={login.isPending}
          >
            {login.isPending ? 'Вход…' : 'Войти'}
          </button>
        </form>

        <SsoBadges />

        <p className="text-xs text-ink-subtle text-center mt-6">
          Нет аккаунта?{' '}
          <Link to="/signup" className="text-brand-500 underline underline-offset-2">
            Создать аккаунт
          </Link>
        </p>
      </div>
    </div>
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
