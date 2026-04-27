import { useEffect, useRef, useState } from 'react'
import { useMutation } from '@tanstack/react-query'
import { Link, useNavigate } from 'react-router-dom'
import toast from 'react-hot-toast'

import { authApi } from '../features/auth/api'
import { errorMessage } from '../shared/api/client'
import { OAuthButtons } from '../components/OAuthButtons'

// ─────────────────────────────────────────────────────────────────────────
//  SignupPage — step 1 of email-OTP registration.
//
//  Submits email + desired client_id (+ Turnstile token if configured)
//  to /auth/signup. Redirects to /signup/verify on success, where the
//  user enters the OTP from email.
//
//  Captcha (Turnstile)
//  ───────────────────
//  Renders only if VITE_TURNSTILE_SITE_KEY is set at build time.
//  Otherwise we rely on backend's DISABLE_CAPTCHA=1 (dev mode).
// ─────────────────────────────────────────────────────────────────────────

const TURNSTILE_SITE_KEY = import.meta.env.VITE_TURNSTILE_SITE_KEY as string | undefined

export default function SignupPage() {
  const nav = useNavigate()
  const [email,    setEmail]    = useState('')
  const [clientId, setClientId] = useState('')
  const [captcha,  setCaptcha]  = useState<string>('')

  const { mutate, isPending } = useMutation({
    mutationFn: () => authApi.signup({
      email: email.trim().toLowerCase(),
      desired_client_id: clientId.trim().toLowerCase(),
      captcha_token: captcha || undefined,
    }),
    onSuccess: (resp) => {
      toast.success(`Код отправлен на ${resp.email}`)
      // Pass desired_client_id along — /signup/verify needs it for the
      // in-place "resend" flow (re-POST to /auth/signup without bouncing
      // the user back to step 1).
      const cid = clientId.trim().toLowerCase()
      nav(
        `/signup/verify?email=${encodeURIComponent(resp.email)}&client_id=${encodeURIComponent(cid)}`,
        { replace: true },
      )
    },
    onError: (e) => toast.error(errorMessage(e, 'Регистрация не удалась')),
  })

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    if (!email.trim())    return toast.error('Введите email')
    if (!clientId.trim()) return toast.error('Введите идентификатор организации')
    if (TURNSTILE_SITE_KEY && !captcha) return toast.error('Пройдите captcha')
    mutate()
  }

  return (
    <div className="min-h-screen bg-surface flex items-center justify-center p-6">
      <form
        onSubmit={handleSubmit}
        className="card w-full max-w-md p-8 animate-fade-in"
        autoComplete="off"
      >
        <div className="mb-7">
          <div className="chapter-num">— шаг 01 из 02</div>
          <h1 className="display-em text-brand-700 text-3xl mt-2 leading-tight">
            Создать аккаунт
          </h1>
          <p className="text-sm text-ink-muted mt-2">
            Мы отправим код подтверждения на ваш email — никаких паролей.
          </p>
        </div>

        <label className="label" htmlFor="email">Email</label>
        <input
          id="email"
          type="email"
          className="input"
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          autoComplete="email"
          required
          placeholder="vasya@acme.ru"
        />

        <label className="label mt-4" htmlFor="cid">Идентификатор организации</label>
        <input
          id="cid"
          type="text"
          className="input font-mono"
          value={clientId}
          onChange={(e) => setClientId(e.target.value.toLowerCase().replace(/[^a-z0-9-]/g, ''))}
          autoComplete="off"
          required
          minLength={3}
          maxLength={64}
          placeholder="acme-shop"
          spellCheck={false}
        />
        <p className="eyebrow mt-1.5">
          Латиница, цифры и дефис. От 3 до 64 символов. Останется навсегда — не спешите.
        </p>

        {/* Turnstile widget — silent if site key not provided */}
        {TURNSTILE_SITE_KEY && (
          <div className="mt-5">
            <TurnstileWidget
              siteKey={TURNSTILE_SITE_KEY}
              onToken={setCaptcha}
            />
          </div>
        )}

        <button
          type="submit"
          className="btn-primary w-full mt-7"
          disabled={isPending}
        >
          {isPending ? 'Отправка кода…' : 'Получить код'}
        </button>

        <div className="mt-6">
          <OAuthButtons />
        </div>

        <p className="text-xs text-ink-subtle text-center mt-5">
          Уже есть аккаунт?{' '}
          <Link to="/login" className="text-brand-500 underline underline-offset-2">
            Войти
          </Link>
        </p>
      </form>
    </div>
  )
}

// ── Turnstile widget — minimal wrapper. Loads CF script lazily, renders
//    once, hands token back via callback. If you migrate away from
//    Turnstile, swap this for hCaptcha/recaptcha by changing one URL +
//    one global. Same token-via-callback contract.
function TurnstileWidget({
  siteKey,
  onToken,
}: {
  siteKey: string
  onToken: (token: string) => void
}) {
  // useRef + useEffect, NOT a callback ref — a callback ref's function
  // identity changes on every parent re-render (e.g. on every keystroke
  // in the email field), which makes React detach + reattach the ref
  // and re-run the body, causing turnstile.render() to fire repeatedly.
  // That manifested as "screen jumps every keystroke + captcha resets".
  const elRef = useRef<HTMLDivElement | null>(null)
  // Stash the latest onToken in a ref so we don't need to re-render
  // Turnstile when the parent passes a fresh setCaptcha closure.
  const cbRef = useRef(onToken)
  cbRef.current = onToken

  useEffect(() => {
    const el = elRef.current
    if (!el) return

    if (!document.querySelector('script[data-turnstile]')) {
      const s = document.createElement('script')
      s.src = 'https://challenges.cloudflare.com/turnstile/v0/api.js'
      s.async = true
      s.defer = true
      s.dataset.turnstile = '1'
      document.head.appendChild(s)
    }

    let widgetId: string | undefined
    let cancelled = false

    const tryRender = () => {
      if (cancelled) return
      const turnstile = (window as any).turnstile
      if (!turnstile) {
        setTimeout(tryRender, 100)
        return
      }
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
    // siteKey almost never changes, but keep it in deps for correctness.
  }, [siteKey])

  return <div ref={elRef} className="flex justify-center" />
}
