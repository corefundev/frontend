import { useEffect, useRef, useState } from 'react'
import { useMutation } from '@tanstack/react-query'
import { Link, useNavigate } from 'react-router-dom'
import toast from 'react-hot-toast'

import { authApi } from '../features/auth/api'
import { errorMessage } from '../shared/api/client'
import AuthShell from '../components/AuthShell'
import { SsoBadges } from '../components/SsoBadges'

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

const PASSWORD_MIN = 10

export default function SignupPage() {
  const nav = useNavigate()
  const [email,    setEmail]    = useState('')
  const [password, setPassword] = useState('')
  const [password2, setPassword2] = useState('')
  const [captcha,  setCaptcha]  = useState<string>('')
  const [agreed,   setAgreed]   = useState<boolean>(false)

  const { mutate, isPending } = useMutation({
    mutationFn: () => authApi.signup({
      email: email.trim().toLowerCase(),
      password,
      captcha_token: captcha || undefined,
      accepted_terms: agreed,
    }),
    onSuccess: (resp) => {
      toast.success(`Код отправлен на ${resp.email}`)
      // Пароль — в router state (НЕ в URL): /signup/verify пере-POST-ит
      // /auth/signup при «Отправить ещё раз», для этого нужен пароль.
      nav(`/signup/verify?email=${encodeURIComponent(resp.email)}`,
          { replace: true, state: { password } })
    },
    onError: (e) => toast.error(errorMessage(e, 'Регистрация не удалась')),
  })

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    if (!email.trim())    return toast.error('Введите email')
    if (password.length < PASSWORD_MIN)
      return toast.error(`Пароль — не менее ${PASSWORD_MIN} символов`)
    if (password !== password2) return toast.error('Пароли не совпадают')
    if (!agreed)          return toast.error('Подтвердите согласие с политикой конфиденциальности')
    if (TURNSTILE_SITE_KEY && !captcha) return toast.error('Пройдите captcha')
    mutate()
  }

  return (
    <AuthShell>
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
            Придумайте пароль — на почту придёт код подтверждения.
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

        <label className="label mt-4" htmlFor="password">Пароль</label>
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

        {/* Turnstile widget — silent if site key not provided */}
        {TURNSTILE_SITE_KEY && (
          <div className="mt-5">
            <TurnstileWidget
              siteKey={TURNSTILE_SITE_KEY}
              onToken={setCaptcha}
            />
          </div>
        )}

        <label className="flex items-start gap-2 mt-5 cursor-pointer text-sm select-none">
          <input
            type="checkbox"
            checked={agreed}
            onChange={(e) => setAgreed(e.target.checked)}
            className="mt-0.5 h-4 w-4 rounded border-ink-subtle/40 text-brand-600 focus:ring-brand-500"
          />
          <span className="text-ink-muted leading-snug">
            Я принимаю{' '}
            <Link
              to="/terms"
              target="_blank"
              rel="noopener noreferrer"
              className="text-brand-500 underline underline-offset-2"
            >
              пользовательское соглашение
            </Link>
            , согласен с{' '}
            <Link
              to="/privacy"
              target="_blank"
              rel="noopener noreferrer"
              className="text-brand-500 underline underline-offset-2"
            >
              политикой конфиденциальности
            </Link>{' '}
            и даю{' '}
            <Link
              to="/consent"
              target="_blank"
              rel="noopener noreferrer"
              className="text-brand-500 underline underline-offset-2"
            >
              согласие на обработку персональных данных
            </Link>
            .
          </span>
        </label>

        <button
          type="submit"
          className="btn-primary w-full mt-5"
          disabled={isPending || !agreed}
        >
          {isPending ? 'Отправка кода…' : 'Подтвердить'}
        </button>

        <SsoBadges />

        <p className="text-xs text-ink-subtle text-center mt-5">
          Уже есть аккаунт?{' '}
          <Link to="/login" className="text-brand-500 underline underline-offset-2">
            Войти
          </Link>
        </p>
      </form>
    </AuthShell>
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
      const turnstile = window.turnstile
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
      const turnstile = window.turnstile
      if (turnstile && widgetId) {
        try { turnstile.remove(widgetId) } catch { /* widget already gone */ }
      }
    }
    // siteKey almost never changes, but keep it in deps for correctness.
  }, [siteKey])

  return <div ref={elRef} className="flex justify-center" />
}
