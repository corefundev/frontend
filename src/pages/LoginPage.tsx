import { useState } from 'react'
import { useMutation } from '@tanstack/react-query'
import { Link, useNavigate } from 'react-router-dom'
import toast from 'react-hot-toast'

import { authApi } from '../features/auth/api'
import { useAuthStore } from '../features/auth/store'
import { OtpInput } from '../components/OtpInput'
import { OAuthButtons } from '../components/OAuthButtons'
import { errorMessage } from '../shared/api/client'

// ─────────────────────────────────────────────────────────────────────────
//  LoginPage — two parallel ways to sign in.
//
//  Tab 1: Email + OTP   (default — Claude.ai-style, recommended)
//         a) submit email → backend sends 6-digit code
//         b) enter code   → JWT
//
//  Tab 2: Client ID + API key  (classic — for ops scripts and admins)
//         single-step exchange; admin via ADMIN_API_KEY also goes here
//
//  We keep the classic tab for two reasons:
//    1. ADMIN_API_KEY login (back-office tooling)
//    2. CI / cron jobs that already store an api_key
// ─────────────────────────────────────────────────────────────────────────

const TURNSTILE_SITE_KEY = import.meta.env.VITE_TURNSTILE_SITE_KEY as string | undefined

type Tab = 'email' | 'classic'

export default function LoginPage() {
  const [tab, setTab] = useState<Tab>('email')

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

        {/* Tab switcher */}
        <div role="tablist" className="grid grid-cols-2 mb-6 rounded-md bg-surface-muted p-1">
          <TabButton active={tab === 'email'}   onClick={() => setTab('email')}>
            Email-код
          </TabButton>
          <TabButton active={tab === 'classic'} onClick={() => setTab('classic')}>
            Client&nbsp;ID&nbsp;+&nbsp;ключ
          </TabButton>
        </div>

        {tab === 'email'   && <EmailTab />}
        {tab === 'classic' && <ClassicTab />}

        {/* OAuth buttons live below both tabs — they apply to either path */}
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

function TabButton({
  active, onClick, children,
}: {
  active: boolean
  onClick: () => void
  children: React.ReactNode
}) {
  return (
    <button
      type="button"
      role="tab"
      aria-selected={active}
      onClick={onClick}
      className={[
        'rounded-[5px] py-1.5 text-xs font-medium transition-colors',
        active
          ? 'bg-surface-raised text-ink shadow-sm ring-1 ring-surface-border'
          : 'text-ink-muted hover:text-ink',
      ].join(' ')}
    >
      {children}
    </button>
  )
}

// ── Tab 1: email + OTP ───────────────────────────────────────────────────

function EmailTab() {
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
      nav('/', { replace: true })
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

// ── Tab 2: classic client_id + api_key ──────────────────────────────────

function ClassicTab() {
  const nav = useNavigate()
  const setAuth = useAuthStore((s) => s.setAuth)
  const [clientId, setClientId] = useState('')
  const [secret,   setSecret]   = useState('')

  const { mutate, isPending } = useMutation({
    mutationFn: () => authApi.login({ client_id: clientId.trim(), secret }),
    onSuccess: (data) => {
      setAuth(data.access_token, clientId.trim())
      toast.success('Вход выполнен')
      nav('/', { replace: true })
    },
    onError: (e) => toast.error(errorMessage(e, 'Не удалось войти')),
  })

  return (
    <form
      onSubmit={(e) => {
        e.preventDefault()
        if (!clientId.trim() || !secret) return toast.error('Заполните оба поля')
        mutate()
      }}
      autoComplete="off"
    >
      <label className="label" htmlFor="cid">Client ID</label>
      <input
        id="cid"
        className="input font-mono"
        value={clientId}
        onChange={(e) => setClientId(e.target.value)}
        autoComplete="username"
        spellCheck={false}
        autoCapitalize="off"
        required
      />

      <label className="label mt-4" htmlFor="secret">API-ключ</label>
      <input
        id="secret"
        className="input font-mono"
        type="password"
        value={secret}
        onChange={(e) => setSecret(e.target.value)}
        autoComplete="new-password"
        required
        placeholder="sku_..."
      />

      <button type="submit" className="btn-primary w-full mt-6" disabled={isPending}>
        {isPending ? 'Вход…' : 'Войти'}
      </button>
    </form>
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
  const containerRef = (el: HTMLDivElement | null) => {
    if (!el) return
    if (!document.querySelector('script[data-turnstile]')) {
      const s = document.createElement('script')
      s.src = 'https://challenges.cloudflare.com/turnstile/v0/api.js'
      s.async = true; s.defer = true
      s.dataset.turnstile = '1'
      document.head.appendChild(s)
    }
    const tryRender = () => {
      const turnstile = (window as any).turnstile
      if (!turnstile) { setTimeout(tryRender, 100); return }
      el.innerHTML = ''
      turnstile.render(el, {
        sitekey: siteKey,
        callback: onToken,
        'error-callback': () => onToken(''),
        'expired-callback': () => onToken(''),
      })
    }
    tryRender()
  }
  return <div ref={containerRef} className="flex justify-center" />
}
