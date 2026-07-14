import { useEffect, useRef, useState } from 'react'
import { useMutation } from '@tanstack/react-query'
import { Link } from 'react-router-dom'
import toast from 'react-hot-toast'

import { authApi } from '../features/auth/api'
import AuthShell from '../components/AuthShell'
import { errorMessage } from '../shared/api/client'

// ─────────────────────────────────────────────────────────────────────────
//  ForgotPasswordPage — AUTH-3 #447: запрос ссылки сброса пароля.
//
//  Ответ сервера всегда 202 (enumeration-guard) — экран «Проверьте почту»
//  показывается одинаково для существующих и несуществующих адресов.
//  Капча — всегда (email-спам дороже трения на редком флоу).
// ─────────────────────────────────────────────────────────────────────────

const TURNSTILE_SITE_KEY = import.meta.env.VITE_TURNSTILE_SITE_KEY as string | undefined

export default function ForgotPasswordPage() {
  const [email, setEmail] = useState('')
  const [captcha, setCaptcha] = useState('')
  const [sentTo, setSentTo] = useState<string | null>(null)

  const { mutate, isPending } = useMutation({
    mutationFn: () => authApi.resetRequest({
      email: email.trim().toLowerCase(),
      captcha_token: captcha || undefined,
    }),
    onSuccess: (resp) => setSentTo(resp.email),
    onError: (e) => toast.error(errorMessage(e, 'Не удалось отправить ссылку')),
  })

  if (sentTo) {
    return (
      <Shell>
        <div className="text-center">
          <div className="text-3xl mb-3" aria-hidden>✉️</div>
          <h1 className="text-[28px] font-bold text-ink">Проверьте почту</h1>
          <p className="text-sm text-ink-muted mt-3 leading-relaxed">
            Если аккаунт с адресом{' '}
            <strong className="text-ink font-mono">{sentTo}</strong> существует —
            мы отправили ссылку для смены пароля.
          </p>
          <p className="text-xs text-ink-subtle mt-3">
            Ссылка действительна 60 минут и работает один раз.
          </p>
          <Link to="/login" className="btn-secondary w-full mt-6 inline-block">
            ← Назад ко входу
          </Link>
        </div>
      </Shell>
    )
  }

  return (
    <Shell>
      <h1 className="text-[28px] font-bold text-ink text-center">Сброс пароля</h1>
      <p className="text-sm text-ink-muted mt-2 text-center">
        Пришлём ссылку для смены пароля на вашу почту.
      </p>
      <form
        className="mt-5"
        onSubmit={(e) => {
          e.preventDefault()
          if (!email.trim()) return toast.error('Введите email')
          if (TURNSTILE_SITE_KEY && !captcha) return toast.error('Пройдите captcha')
          mutate()
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

        {TURNSTILE_SITE_KEY && (
          <div className="mt-4">
            <TurnstileWidget siteKey={TURNSTILE_SITE_KEY} onToken={setCaptcha} />
          </div>
        )}

        <button type="submit" className="btn-primary w-full mt-5" disabled={isPending}>
          {isPending ? 'Отправка…' : 'Отправить ссылку'}
        </button>
      </form>
      <p className="text-xs text-ink-subtle text-center mt-5">
        <Link to="/login" className="text-brand-500 underline underline-offset-2">
          ← Назад ко входу
        </Link>
      </p>
    </Shell>
  )
}

function Shell({ children }: { children: React.ReactNode }) {
  return (
    <AuthShell>
      <div className="mx-auto w-full max-w-md">{children}</div>
    </AuthShell>
  )
}

// ── Turnstile widget — same contract as LoginPage's helper ──────────────

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
