import { useEffect, useMemo, useState } from 'react'
import { useMutation } from '@tanstack/react-query'
import { Link, useNavigate, useSearchParams } from 'react-router-dom'
import toast from 'react-hot-toast'

import { authApi } from '../features/auth/api'
import { useAuthStore } from '../features/auth/store'
import { OtpInput } from '../components/OtpInput'
import { errorMessage } from '../shared/api/client'

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
  const setAuth = useAuthStore((s) => s.setAuth)

  const [code, setCode] = useState('')
  const [issued, setIssued] = useState<{ clientId: string; apiKey: string } | null>(null)

  // Bounce back to /signup if email param missing — we can't verify without it.
  useEffect(() => {
    if (!email) nav('/signup', { replace: true })
  }, [email, nav])

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

        <div className="flex items-center justify-between text-xs mt-5">
          <Link to="/signup" className="text-ink-subtle hover:text-ink">
            ← Изменить email
          </Link>
          <ResendLink email={email} />
        </div>
      </div>
    </div>
  )
}

// Resend link — re-runs /auth/signup with the same email + (no client_id?
// see note). For simplicity, we ask the user to go back if they want to
// resend — the /auth/signup endpoint requires desired_client_id which we
// don't have here.
function ResendLink({ email }: { email: string }) {
  return (
    <Link
      to={`/signup?email=${encodeURIComponent(email)}`}
      className="text-ink-subtle hover:text-ink"
    >
      Отправить новый код →
    </Link>
  )
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
