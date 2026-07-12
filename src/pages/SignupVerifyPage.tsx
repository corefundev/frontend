import { useEffect, useMemo, useRef, useState } from 'react'
import { useMutation } from '@tanstack/react-query'
import { Link, useNavigate, useSearchParams } from 'react-router-dom'
import toast from 'react-hot-toast'

import { authApi } from '../features/auth/api'
import { useAuthStore } from '../features/auth/store'
import { OtpInput } from '../components/OtpInput'
import { errorMessage } from '../shared/api/client'

const TURNSTILE_SITE_KEY = import.meta.env.VITE_TURNSTILE_SITE_KEY as string | undefined
const RESEND_COOLDOWN_S = 60

// ─────────────────────────────────────────────────────────────────────────
//  SignupVerifyPage — step 2 of email-OTP registration.
//
//  Reads `email` from query params (set by SignupPage on success).
//  Posts the 6-digit OTP to /auth/signup/verify; on success:
//    1. backend creates the client + mints api_key (returned ONCE)
//    2. backend issues a JWT — we store it via setAuth()
//    3. we show the api_key in a paper-card with copy button
//    4. when user dismisses, redirect into /welcome (onboarding)
// ─────────────────────────────────────────────────────────────────────────

export default function SignupVerifyPage() {
  const nav = useNavigate()
  const [params] = useSearchParams()
  const email = useMemo(() => (params.get('email') ?? '').toLowerCase(), [params])
  const clientId = useMemo(() => (params.get('client_id') ?? '').toLowerCase(), [params])
  const setAuth = useAuthStore((s) => s.setAuth)

  const [code, setCode] = useState('')
  const [issued, setIssued] = useState<{ clientId: string; apiKey: string } | null>(null)

  // Resend state — captcha solved by user + countdown counter.
  const [resendCaptcha, setResendCaptcha] = useState('')
  const [cooldown, setCooldown] = useState(RESEND_COOLDOWN_S)

  // Bounce back to /signup if email param missing — we can't verify without it.
  useEffect(() => {
    if (!email) nav('/signup', { replace: true })
  }, [email, nav])

  // Countdown ticker — stops at 0, lets the resend button enable.
  useEffect(() => {
    if (cooldown <= 0) return
    const t = setInterval(() => setCooldown((s) => Math.max(0, s - 1)), 1000)
    return () => clearInterval(t)
  }, [cooldown])

  const resendMut = useMutation({
    mutationFn: () =>
      authApi.signup({
        email,
        desired_client_id: clientId,
        captcha_token: resendCaptcha || undefined,
        // повторная отправка кода = та же заявка; согласие уже дано на шаге 1
        accepted_terms: true,
      }),
    onSuccess: () => {
      toast.success('Новый код отправлен')
      setResendCaptcha('')
      setCooldown(RESEND_COOLDOWN_S)
      // Reset the Turnstile widget too so user can re-solve next time.
      const turnstile = window.turnstile
      if (turnstile && turnstile.reset) {
        try { turnstile.reset() } catch { /* widget was unmounted already */ }
      }
    },
    onError: (e) => toast.error(errorMessage(e, 'Не удалось отправить код')),
  })

  function handleResend() {
    if (cooldown > 0 || resendMut.isPending) return
    if (TURNSTILE_SITE_KEY && !resendCaptcha) {
      toast.error('Пройдите captcha')
      return
    }
    if (!clientId) {
      // No client_id means user came back via deep-link or stale URL —
      // bounce them to /signup to refill the form.
      toast.error('Вернитесь на шаг 1, чтобы запросить новый код')
      nav(`/signup?email=${encodeURIComponent(email)}`)
      return
    }
    resendMut.mutate()
  }

  const { mutate, isPending } = useMutation({
    mutationFn: () => authApi.signupVerify({ email, code }),
    onSuccess: (resp) => {
      // Already log them in (JWT) but DON'T navigate yet — we want them
      // to see the api_key first.
      setAuth(resp.access_token, resp.client_id)
      setIssued({ clientId: resp.client_id, apiKey: resp.api_key })
      toast.success('Аккаунт создан')
    },
    onError: (e) => {
      setCode('')
      toast.error(errorMessage(e, 'Код не подошёл'))
    },
  })

  // Show api_key reveal — exclusive screen, replaces the form.
  if (issued) {
    return (
      <ApiKeyReveal
        clientId={issued.clientId}
        apiKey={issued.apiKey}
        onContinue={() => nav('/welcome', { replace: true })}
      />
    )
  }

  return (
    <div className="min-h-screen bg-surface flex items-center justify-center p-6">
      <div className="card w-full max-w-md p-8 animate-fade-in">
        <div className="chapter-num">— шаг 02 из 02</div>
        <h1 className="display-em text-brand-700 text-3xl mt-2 leading-tight">
          Введите код из email
        </h1>
        <p className="text-sm text-ink-muted mt-2">
          Мы отправили 6-значный код на{' '}
          <strong className="text-ink font-mono">{email}</strong>.
          Код действует 10 минут.
        </p>

        <div className="mt-7 flex justify-center">
          <OtpInput
            value={code}
            onChange={setCode}
            onComplete={(full) => {
              if (!isPending) {
                setCode(full)
                mutate()
              }
            }}
            disabled={isPending}
          />
        </div>

        <button
          type="button"
          className="btn-primary w-full mt-7"
          onClick={() => mutate()}
          disabled={isPending || code.length !== 6}
        >
          {isPending ? 'Проверка…' : 'Подтвердить'}
        </button>

        {/* Resend block — captcha + countdown + button. Captcha widget
            stays mounted; user re-solves it before each resend so the
            backend's signup endpoint gets a fresh Turnstile token. */}
        <div className="mt-7 pt-5 border-t border-paper-deep">
          <div className="text-xs text-ink-subtle text-center mb-3">
            Не пришёл код? Проверьте спам или отправьте новый.
          </div>

          {TURNSTILE_SITE_KEY && (
            <div className="mb-3">
              <TurnstileWidget
                siteKey={TURNSTILE_SITE_KEY}
                onToken={setResendCaptcha}
              />
            </div>
          )}

          <button
            type="button"
            className="btn-secondary w-full"
            onClick={handleResend}
            disabled={cooldown > 0 || resendMut.isPending}
          >
            {resendMut.isPending
              ? 'Отправляем…'
              : cooldown > 0
                ? `Отправить ещё раз через ${cooldown}\u00A0с`
                : 'Отправить ещё раз'}
          </button>
        </div>

        {/* Login-redirect hint — shown to ALL users (not gated on any
            server response), so it never leaks whether THIS email is
            already registered. Pairs with audit R3-9: the backend's
            /auth/signup returns an identical 202 for duplicate emails,
            so an honest user who already has an account won't see a
            code and needs an in-UI nudge toward /login. */}
        <div className="text-xs mt-5 text-center text-ink-subtle">
          Уже регистрировались?{' '}
          <Link to="/login" className="text-brand-700 hover:text-brand-800 font-medium">
            Войти
          </Link>
        </div>

        <div className="text-xs mt-3 text-center">
          <Link to="/signup" className="text-ink-subtle hover:text-ink">
            ← Изменить email
          </Link>
        </div>
      </div>
    </div>
  )
}

// ── Turnstile widget — useEffect-mounted (callback-ref version remounts
//    on every parent re-render and creates dozens of widget instances).
//    Same shape as the helper in SignupPage / LoginPage; lifted here too
//    so /signup/verify can request a fresh token before each resend.
function TurnstileWidget({
  siteKey, onToken,
}: {
  siteKey: string
  onToken: (t: string) => void
}) {
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

// ─────────────────────────────────────────────────────────────────────────
//  ApiKeyReveal — full-screen one-time display of the freshly minted key
//  Same pattern as the AdminClientsPage variant, scaled for solo-screen.
// ─────────────────────────────────────────────────────────────────────────

function ApiKeyReveal({
  clientId, apiKey, onContinue,
}: {
  clientId: string
  apiKey: string
  onContinue: () => void
}) {
  const [copied, setCopied] = useState(false)

  async function copy() {
    try {
      await navigator.clipboard.writeText(apiKey)
      setCopied(true)
      setTimeout(() => setCopied(false), 1500)
    } catch {
      toast.error('Браузер не дал скопировать. Скопируйте вручную.')
    }
  }

  return (
    <div className="min-h-screen bg-surface flex items-center justify-center p-6">
      <div className="card w-full max-w-lg p-8 sm:p-10 animate-rise">
        <div className="chapter-num">— ваш ключ выпущен</div>
        <h1 className="display-em text-brand-700 text-3xl sm:text-4xl mt-2 leading-tight">
          Сохраните API-ключ
        </h1>
        <p className="text-sm text-ink-muted mt-3 max-w-md leading-relaxed">
          Это единственный раз, когда мы показываем этот ключ. Сервер
          хранит только хеш — восстановить плейн-ключ невозможно.
          Если потеряете — выпустите новый в разделе «Настройки».
        </p>

        <div className="card-paper mt-6 p-5">
          <div className="eyebrow">client_id</div>
          <div className="font-mono text-sm mt-1">{clientId}</div>

          <div className="eyebrow mt-5">api_key</div>
          <div className="mt-1 flex items-center gap-2">
            <code className="font-mono text-xs flex-1 break-all bg-surface-raised px-3 py-2.5 rounded ring-1 ring-paper-deep">
              {apiKey}
            </code>
            <button
              type="button"
              className={copied ? 'btn-secondary !ring-success !text-success' : 'btn-secondary'}
              onClick={copy}
              title="Скопировать"
            >
              {copied ? '✓ скопирован' : 'Скопировать'}
            </button>
          </div>
        </div>

        <div className="rounded-md bg-warn-bg text-warn px-4 py-3 text-xs mt-5">
          <strong>Где хранить?</strong> Менеджер паролей (1Password,
          Bitwarden, KeePass) — самое безопасное. Не отправляйте ключ
          в Telegram/email/Slack.
        </div>

        <button
          type="button"
          className="btn-primary w-full mt-7"
          onClick={onContinue}
        >
          Я сохранил, продолжить →
        </button>
      </div>
    </div>
  )
}
