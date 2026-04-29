import { useEffect, useRef, useState } from 'react'
import { useMutation } from '@tanstack/react-query'
import { Link, useNavigate } from 'react-router-dom'
import toast from 'react-hot-toast'

import { authApi } from '../features/auth/api'
import { useAuthStore } from '../features/auth/store'
import { OtpInput } from '../components/OtpInput'
import { OAuthButtons } from '../components/OAuthButtons'
import { errorMessage } from '../shared/api/client'

// ─────────────────────────────────────────────────────────────────────────
//  LoginPage — email + OTP. The previous Client ID + API key tab has
//  moved to /login/admin (linked from API docs and ops runbooks). End
//  users no longer see token-shaped fields here.
// ─────────────────────────────────────────────────────────────────────────

const TURNSTILE_SITE_KEY = import.meta.env.VITE_TURNSTILE_SITE_KEY as string | undefined

export default function LoginPage() {
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

        <EmailLoginForm />

        <div className="mt-6">
          <OAuthButtons />
        </div>

        <p className="text-xs text-ink-subtle text-center mt-6">
          Нет аккаунта?{' '}
          <Link to="/signup" className="text-brand-500 underline underline-offset-2">
            Создать
          </Link>
        </p>
      </div>
    </div>
  )
}

// ── Email + OTP — the only flow users see here ──────────────────────────

function EmailLoginForm() {
  const nav = useNavigate()
  const setAuth = useAuthStore((s) => s.setAuth)

  const [step,    setStep]    = useState<'email' | 'code'>('email')
  const [email,   setEmail]   = useState('')
  const [captcha, setCaptcha] = useState('')
  const [code,    setCode]    = useState('')

  const sendOtp = useMutation({
    mutationFn: () => authApi.loginEmail({
      email: email.trim().toLowerCase(),
      captcha_token: captcha || undefined,
    }),
    onSuccess: () => {
      toast.success('Код отправлен (если email зарегистрирован)')
      setStep('code')
    },
    onError: (e) => toast.error(errorMessage(e, 'Не удалось отправить код')),
  })

  const verify = useMutation({
    mutationFn: () => authApi.loginEmailVerify({ email: email.trim().toLowerCase(), code }),
    onSuccess: (resp) => {
      setAuth(resp.access_token, resp.client_id)
      toast.success(`Добро пожаловать, ${resp.client_id}`)
      nav('/app', { replace: true })
    },
    onError: (e) => {
      setCode('')
      toast.error(errorMessage(e, 'Код не подошёл'))
    },
  })

  if (step === 'email') {
    return (
      <form
        onSubmit={(e) => {
          e.preventDefault()
          if (!email.trim()) return toast.error('Введите email')
          if (TURNSTILE_SITE_KEY && !captcha) return toast.error('Пройдите captcha')
          sendOtp.mutate()
        }}
        autoComplete="off"
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

        {TURNSTILE_SITE_KEY && (
          <div className="mt-4">
            <TurnstileWidget siteKey={TURNSTILE_SITE_KEY} onToken={setCaptcha} />
          </div>
        )}

        <button
          type="submit"
          className="btn-primary w-full mt-5"
          disabled={sendOtp.isPending}
        >
          {sendOtp.isPending ? 'Отправка…' : 'Отправить код'}
        </button>
      </form>
    )
  }

  return (
    <div>
      <p className="text-sm text-ink-muted mb-5">
        Код отправлен на{' '}
        <strong className="text-ink font-mono">{email}</strong>.
      </p>

      <div className="flex justify-center">
        <OtpInput
          value={code}
          onChange={setCode}
          onComplete={(full) => {
            if (!verify.isPending) {
              setCode(full)
              verify.mutate()
            }
          }}
          disabled={verify.isPending}
        />
      </div>

      <button
        type="button"
        className="btn-primary w-full mt-6"
        onClick={() => verify.mutate()}
        disabled={verify.isPending || code.length !== 6}
      >
        {verify.isPending ? 'Проверка…' : 'Войти'}
      </button>

      <button
        type="button"
        className="btn-ghost w-full mt-2 text-ink-subtle"
        onClick={() => { setStep('email'); setCode('') }}
      >
        ← Изменить email
      </button>
    </div>
  )
}

// ── Turnstile widget (duplicate of SignupPage's helper, kept local
//    to LoginPage so dropping signup wouldn't dead-code this) ─────────────

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
      const turnstile = (window as any).turnstile
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
      const turnstile = (window as any).turnstile
      if (turnstile && widgetId) {
        try { turnstile.remove(widgetId) } catch { /* widget already gone */ }
      }
    }
  }, [siteKey])

  return <div ref={elRef} className="flex justify-center" />
}
