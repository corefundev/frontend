import { useEffect, useMemo, useRef, useState } from 'react'
import { useMutation } from '@tanstack/react-query'
import { Link, useLocation, useNavigate, useSearchParams } from 'react-router-dom'
import toast from 'react-hot-toast'

import { authApi } from '../features/auth/api'
import { OtpInput } from '../components/OtpInput'
import { errorMessage } from '../shared/api/client'

const TURNSTILE_SITE_KEY = import.meta.env.VITE_TURNSTILE_SITE_KEY as string | undefined
const RESEND_COOLDOWN_S = 60

// ─────────────────────────────────────────────────────────────────────────
//  SignupVerifyPage — шаг 2 регистрации (AUTH-3 #447): «одноразовый
//  пароль из письма». На успех аккаунт создан С ПАРОЛЕМ (задан на шаге 1),
//  БЕЗ api-key-окна и БЕЗ авто-сессии — редирект на /login?confirmed=1,
//  пользователь входит своим паролем (решение владельца).
//
//  Пароль для «Отправить ещё раз» приходит через router state (НЕ в URL —
//  секрет не должен светиться в адресной строке/истории). Если state
//  потерян (refresh страницы) — resend отправляет на шаг 1.
// ─────────────────────────────────────────────────────────────────────────

export default function SignupVerifyPage() {
  const nav = useNavigate()
  const [params] = useSearchParams()
  const email = useMemo(() => (params.get('email') ?? '').toLowerCase(), [params])
  const location = useLocation()
  const signupPassword =
    (location.state as { password?: string } | null)?.password ?? ''

  const [code, setCode] = useState('')

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
        password: signupPassword,
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
    if (!signupPassword) {
      // Страница обновлена — router state с паролем потерян; повторная
      // отправка требует пароль → назад на шаг 1.
      toast.error('Вернитесь на шаг 1, чтобы запросить новый код')
      nav(`/signup?email=${encodeURIComponent(email)}`)
      return
    }
    resendMut.mutate()
  }

  const { mutate, isPending } = useMutation({
    mutationFn: () => authApi.signupVerify({ email, code }),
    onSuccess: () => {
      // Аккаунт создан с паролем; api-key-окна и авто-сессии нет — на вход.
      toast.success('Почта подтверждена')
      nav(`/login?email=${encodeURIComponent(email)}&confirmed=1`, { replace: true })
    },
    onError: (e) => {
      setCode('')
      toast.error(errorMessage(e, 'Код не подошёл'))
    },
  })

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

// ── Turnstile widget — same contract as SignupPage's helper ─────────────

function TurnstileWidget({
  siteKey,
  onToken,
}: {
  siteKey: string
  onToken: (token: string) => void
}) {
  // useRef + useEffect, NOT a callback ref — a callback ref's function
  // identity changes on every parent re-render, which re-runs
  // turnstile.render() on every keystroke (lag + widget resets).
  const elRef = useRef<HTMLDivElement | null>(null)
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
  }, [siteKey])

  return <div ref={elRef} className="flex justify-center" />
}
