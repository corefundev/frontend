import { useState } from 'react'
import { useMutation } from '@tanstack/react-query'
import { Link, useNavigate } from 'react-router-dom'
import toast from 'react-hot-toast'

import { authApi } from '../features/auth/api'
import { useAuthStore } from '../features/auth/store'
import { errorMessage } from '../shared/api/client'
import { admPath } from '../shared/hostRouting'

// ─────────────────────────────────────────────────────────────────────────
//  AdminLoginPage — classic Client ID + API key flow.
//
//  This is the back-office / CI entry point. End users never see this
//  page; it lives under /login/admin and is referenced only from API
//  docs and ops runbooks. The public-facing /login page does email +
//  OTP and nothing else.
// ─────────────────────────────────────────────────────────────────────────

export default function AdminLoginPage() {
  const nav = useNavigate()
  const setAuth = useAuthStore((s) => s.setAuth)
  const [clientId, setClientId] = useState('')
  const [secret,   setSecret]   = useState('')

  const { mutate, isPending } = useMutation({
    mutationFn: () => authApi.login({ client_id: clientId.trim(), secret }),
    onSuccess: (data) => {
      setAuth(data.access_token, clientId.trim())
      toast.success('Вход выполнен')
      nav(admPath('/admin'), { replace: true })
    },
    onError: (e) => toast.error(errorMessage(e, 'Не удалось войти')),
  })

  return (
    <div className="min-h-screen bg-surface flex items-center justify-center p-6">
      <div className="w-full max-w-md card p-8 animate-fade-in">
        <div className="mb-6 flex flex-col items-center">
          <div
            aria-hidden
            className="h-12 w-12 rounded-md bg-brand-700 flex items-center justify-center text-ink-invert font-bold"
          >
            ⚙
          </div>
          <h1 className="display-em text-brand-700 text-2xl mt-3">
            Служебный вход
          </h1>
          <p className="text-xs text-ink-subtle mt-1 text-center">
            Для администраторов и интеграций.<br/>
            Обычные пользователи — на{' '}
            <Link to="/login" className="text-brand-500 underline">
              страницу входа
            </Link>.
          </p>
        </div>

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
      </div>
    </div>
  )
}
