// src/pages/OAuthReturnPage.tsx
//
// Bounce-target after the backend's /auth/oauth/{provider}/callback.
// Backend redirects here with:
//
//   ?token=eyJ...        — the JWT we should store as the session
//   ?client_id=...       — the (possibly auto-generated) client_id
//   ?new_user=0|1        — whether the account was just created
//   ?api_key=sku_...     — ONLY on new_user=1; one-time api_key
//
// Behavior:
//   • Always: setAuth(token, client_id) — user is logged in.
//   • new_user=1 → show ApiKeyReveal one-time card → /welcome (onboarding)
//   • new_user=0 → straight to /
//
// We do NOT trust the URL — but JWT is HMAC-signed, so a tampered
// token simply fails the next API call. The api_key here was minted
// by the backend on this round-trip; if someone forged the URL with
// fake `?api_key=`, all they get is a worthless string in their UI.

import { useEffect, useMemo, useState } from 'react'
import { useNavigate, useSearchParams } from 'react-router-dom'
import toast from 'react-hot-toast'

import { useAuthStore } from '../features/auth/store'

export default function OAuthReturnPage() {
  const nav = useNavigate()
  const [params] = useSearchParams()
  const setAuth = useAuthStore((s) => s.setAuth)

  // R11-L1: the backend now delivers the token / api_key in the URL
  // FRAGMENT (#…), which never reaches the server (out of access logs and
  // the Referer header). Read the hash first; fall back to the query string
  // for backward-compat during the backend deploy window. The values are
  // captured once at mount; we scrub the URL in the effect below.
  const { token, clientId, newUser, apiKey } = useMemo(() => {
    const rawHash = window.location.hash.replace(/^#/, '')
    const hashParams = new URLSearchParams(rawHash)
    const get = (k: string) => hashParams.get(k) ?? params.get(k) ?? ''
    return {
      token:    get('token'),
      clientId: get('client_id'),
      newUser:  get('new_user') === '1',
      apiKey:   get('api_key'),
    }
  }, [params])

  // Apply the JWT once. The effect re-runs if the URL params change
  // (e.g. back-button → forward through a different OAuth callback)
  // so we don't get stuck with stale auth state. setAuth/nav are
  // stable references from their stores, safe to include in deps.
  // If the token's bogus, the next API call will 401 and the global
  // axios interceptor boots us back to /login.
  useEffect(() => {
    if (!token || !clientId) {
      toast.error('Сессия не получена. Попробуйте снова.')
      nav('/login', { replace: true })
      return
    }
    // R11-L1: scrub the token / api_key out of the URL (address bar +
    // history entry) immediately after capturing them, so they don't
    // linger in browser history once login completes.
    window.history.replaceState(null, '', window.location.pathname)
    setAuth(token, clientId)

    // Existing user → straight in.
    if (!newUser) {
      toast.success(`Добро пожаловать, ${clientId}`)
      nav('/app', { replace: true })
    }
    // New user → stay on this page to show api_key, then continue.
    // (ApiKeyReveal calls onContinue → /welcome)
  }, [token, clientId, newUser, setAuth, nav])

  if (!token || !clientId) return null
  if (!newUser) return <Spinner />

  return (
    <ApiKeyReveal
      clientId={clientId}
      apiKey={apiKey}
      onContinue={() => nav('/welcome', { replace: true })}
    />
  )
}

function Spinner() {
  return (
    <div className="min-h-screen bg-surface flex items-center justify-center">
      <div className="text-ink-muted">Завершаем вход…</div>
    </div>
  )
}

// ─────────────────────────────────────────────────────────────────────────
//  ApiKeyReveal — same warm-paper design as the email-OTP signup flow.
//  Duplicated here (not extracted) to avoid coupling /signup to /oauth
//  unless we deliberately decide to share — both are auth flows but
//  evolve independently.
// ─────────────────────────────────────────────────────────────────────────

function ApiKeyReveal({
  clientId, apiKey, onContinue,
}: {
  clientId: string
  apiKey:   string
  onContinue: () => void
}) {
  const [copied, setCopied] = useState(false)
  // If api_key wasn't passed — surface it gracefully. Shouldn't happen
  // for new_user=1 in practice, but better than a blank box.
  const haveKey = useMemo(() => !!apiKey, [apiKey])

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
        <div className="chapter-num">— добро пожаловать</div>
        <h1 className="display-em text-brand-700 text-3xl sm:text-4xl mt-2 leading-tight">
          Аккаунт создан
        </h1>
        <p className="text-sm text-ink-muted mt-3 max-w-md leading-relaxed">
          Идентификатор аккаунта: <code className="font-mono text-ink">{clientId}</code>.
          Если хотите интегрировать API напрямую — используйте api-ключ ниже
          (показан один раз).
        </p>

        {haveKey && (
          <div className="card-paper mt-6 p-5">
            <div className="eyebrow">api_key</div>
            <div className="mt-1 flex items-center gap-2">
              <code className="font-mono text-xs flex-1 break-all bg-surface-raised px-3 py-2.5 rounded ring-1 ring-paper-deep">
                {apiKey}
              </code>
              <button
                type="button"
                className={copied ? 'btn-secondary !ring-success !text-success' : 'btn-secondary'}
                onClick={copy}
              >
                {copied ? '✓ скопирован' : 'Скопировать'}
              </button>
            </div>
          </div>
        )}

        {haveKey && (
          <div className="rounded-md bg-warn-bg text-warn px-4 py-3 text-xs mt-5">
            <strong>Где хранить?</strong> Менеджер паролей. Если потеряете —
            сможете выпустить новый ключ в разделе «Настройки», но интеграции
            на старом перестанут работать.
          </div>
        )}

        <button
          type="button"
          className="btn-primary w-full mt-7"
          onClick={onContinue}
        >
          Перейти к загрузке данных →
        </button>
      </div>
    </div>
  )
}
