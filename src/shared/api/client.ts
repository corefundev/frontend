// src/shared/api/client.ts
/// <reference types="vite/client" />
//
// Single axios instance used by all feature APIs.
//
// Design notes
// ────────────
//   • Token is attached per-request via the auth store (zustand persist).
//   • On 401 we clear auth + bounce to /login. This matches the backend
//     JWT lifetime (60 min) — when it expires the server returns 401 and
//     we transparently send the user back to the login screen.
//   • withCredentials is OFF by default. The JWT lives in the
//     Authorization header, not a cookie, so we don't need cookies to
//     cross origins and we also don't want the browser sending unrelated
//     cookies to the API host.
//   • Per-request timeout kept at 30 s; uploads override via the
//     `uploadClient` export which has no timeout and streams multipart.
//   • BASE_URL is validated at import-time to avoid silently falling back
//     to localhost in production when VITE_API_URL was not baked in.

import axios, { type AxiosError, type InternalAxiosRequestConfig } from 'axios'
import { useAuthStore } from '../../features/auth/store'
import { IS_ADMIN_HOST } from '../hostRouting'

function resolveBaseUrl(): string {
  // ADM-ACCESS (#551): консоль ходит в API ТОЛЬКО same-origin через
  // nginx-proxy /api — так Cf-Access-Jwt-Assertion периметра доезжает
  // до серверной валидации, а CSP admin-хоста сжимается до 'self'.
  if (IS_ADMIN_HOST) return '/api'
  const raw = import.meta.env.VITE_API_URL
  if (!raw) {
    // In prod, refuse to silently fall back — an unconfigured API URL
    // means the site is broken and should fail loudly.
    if (import.meta.env.PROD) {
      throw new Error('VITE_API_URL is not set; rebuild with it defined')
    }
    return 'http://localhost:8000'
  }
  return String(raw).replace(/\/$/, '')
}

export const BASE_URL = resolveBaseUrl()

export const apiClient = axios.create({
  baseURL: BASE_URL,
  headers: { 'Content-Type': 'application/json' },
  timeout: 30_000,
  // JWT travels in Authorization header — cookies aren't used.
  withCredentials: false,
})

// Multipart uploads need no timeout (a 50 MB file over slow LTE can take
// minutes). We also want axios to leave the Content-Type alone so the
// browser fills in the multipart boundary automatically.
export const uploadClient = axios.create({
  baseURL: BASE_URL,
  timeout: 0,
  withCredentials: false,
})

// ── Request interceptor: attach bearer token ──────────────────────────────
function attachAuth(config: InternalAxiosRequestConfig) {
  const token = useAuthStore.getState().token
  if (token) config.headers.Authorization = `Bearer ${token}`
  return config
}
apiClient.interceptors.request.use(attachAuth)
uploadClient.interceptors.request.use(attachAuth)

// ── AUTH-2 #446: silent refresh (remember-me httpOnly cookie) ─────────────
//
// Single-flight: параллельные 401 делят один POST /auth/refresh (иначе
// вторая ротация съест токен первой и сработает reuse-detection).
// Плоский axios.post, НЕ apiClient — без интерсепторов, без рекурсии.
let refreshInFlight: Promise<string | null> | null = null

export function tryRefreshToken(): Promise<string | null> {
  // ADM-HOST (#128): консоль аутентифицируется ТОЛЬКО формой с админ-
  // ключом. Клиентская remember-me-кука на admin-хосте не опрашивается
  // вовсе — иначе она молча подменяет админ-сессию клиентской (владелец
  // выкидывался из консоли при живой клиентской сессии в том же браузере).
  if (IS_ADMIN_HOST) return Promise.resolve(null)
  if (!refreshInFlight) {
    refreshInFlight = axios
      .post<{ access_token: string; client_id: string }>(
        `${BASE_URL}/auth/refresh`, {},
        { withCredentials: true, timeout: 15_000 })
      .then((r) => {
        const t = r.data?.access_token
        if (t) useAuthStore.getState().setAuth(t, r.data.client_id)
        return t ?? null
      })
      .catch(() => null)
      .finally(() => { refreshInFlight = null })
  }
  return refreshInFlight
}

// ── Response interceptor: 401 → refresh-retry → logout + redirect ────────
//
// Only treat 401 as "session expired" for REGULAR endpoints. A 401 on
// the auth endpoints themselves (login / signup / token / refresh /
// password flows) means "wrong credentials this attempt" — a normal
// mutation error to surface as a toast, not a reason to wipe state.
// For regular endpoints we first try ONE silent refresh (remember-me
// cookie) and replay the request; only a failed refresh logs out.
async function handle401(error: AxiosError) {
  const url = error.config?.url ?? ''
  const isAuthAttempt =
    url.startsWith('/auth/login') ||
    url.startsWith('/auth/signup') ||
    url.startsWith('/auth/token') ||
    url.startsWith('/auth/refresh') ||
    url.startsWith('/auth/password')

  if (error.response?.status === 401 && !isAuthAttempt) {
    const cfg = error.config as (InternalAxiosRequestConfig & { _retried?: boolean }) | undefined
    if (cfg && !cfg._retried) {
      const fresh = await tryRefreshToken()
      if (fresh) {
        cfg._retried = true
        cfg.headers.Authorization = `Bearer ${fresh}`
        return axios.request(cfg)
      }
    }
    useAuthStore.getState().logout()
    if (IS_ADMIN_HOST) {
      // #551: 401 на периметре = истёкшая CF-сессия; перезагрузка
      // отдаёт управление interstitial'у CF, своей /login тут нет.
      window.location.reload()
    } else if (!window.location.pathname.startsWith('/login')) {
      window.location.href = '/login'
    }
  }
  return Promise.reject(error)
}
apiClient.interceptors.response.use((r) => r, handle401)
uploadClient.interceptors.response.use((r) => r, handle401)

// ── Error message helper for toast ────────────────────────────────────────
//
// Runtime-guarded extraction of a user-facing message from any thrown
// value. The previous version cast `err as AxiosError<{detail?: …}>`
// without checking — if the backend returned an unexpected shape, or
// a non-axios error landed here (a plain Error from caller code), the
// cast was a lie. Toast would surface "[object Object]" or empty
// strings depending on what the backend actually returned.
//
// Order of preference:
//   1. FastAPI {detail: string}
//   2. FastAPI {detail: [{msg: string}, …]} (validation errors)
//   3. axios/Error .message  (timeout, network, etc.)
//   4. fallback
export function errorMessage(err: unknown, fallback = 'Произошла ошибка'): string {
  // Narrow without lying — `unknown` is only safe to dereference when
  // we've actually checked it's an object.
  if (!err || typeof err !== 'object') return fallback

  const errObj = err as Record<string, unknown>
  const response = errObj.response as { data?: unknown } | undefined
  const data = response?.data

  if (data && typeof data === 'object') {
    const detail = (data as { detail?: unknown }).detail
    if (typeof detail === 'string') return detail
    // B3 #155: structured denial envelope {reason_code, message, …} — the
    // human string lives under .message. (Kept before the array branch so a
    // future object-shaped detail doesn't slip through to the fallback.)
    if (detail && typeof detail === 'object' && !Array.isArray(detail)) {
      const m = (detail as { message?: unknown }).message
      if (typeof m === 'string' && m.length > 0) return m
    }
    if (Array.isArray(detail) && detail.length > 0) {
      const first = detail[0]
      if (first && typeof first === 'object' && typeof (first as { msg?: unknown }).msg === 'string') {
        return (first as { msg: string }).msg
      }
    }
  }

  const msg = errObj.message
  if (typeof msg === 'string' && msg.length > 0) return msg

  return fallback
}

// B3 #155 — structured training-denial envelope, parsed off an axios error.
// Returns null when the error isn't a reason-coded denial (network error,
// plain string detail, etc.) so callers fall back to errorMessage().
export type TrainingDenial = {
  reasonCode: 'cooldown' | 'lost_race' | 'in_flight'
  message: string
  cooldownUntil: string | null
  retryAfterSec: number | null
}

export function trainingDenial(err: unknown): TrainingDenial | null {
  if (!err || typeof err !== 'object') return null
  const response = (err as Record<string, unknown>).response as { data?: unknown } | undefined
  const detail = (response?.data as { detail?: unknown } | undefined)?.detail
  if (!detail || typeof detail !== 'object' || Array.isArray(detail)) return null
  const d = detail as Record<string, unknown>
  const code = d.reason_code
  if (code !== 'cooldown' && code !== 'lost_race' && code !== 'in_flight') return null
  return {
    reasonCode: code,
    message: typeof d.message === 'string' ? d.message : '',
    cooldownUntil: typeof d.cooldown_until === 'string' ? d.cooldown_until : null,
    retryAfterSec: typeof d.retry_after_sec === 'number' ? d.retry_after_sec : null,
  }
}

// Human "через 2 ч 5 мин" from an ISO cooldown ETA (or a retry-after seconds
// fallback). Empty string when neither is usable.
export function cooldownEta(until: string | null, retryAfterSec: number | null): string {
  let secs = retryAfterSec ?? 0
  if (until) {
    const ms = new Date(until).getTime() - Date.now()
    if (!Number.isNaN(ms)) secs = Math.max(0, Math.round(ms / 1000))
  }
  if (secs <= 0) return ''
  const h = Math.floor(secs / 3600)
  const m = Math.floor((secs % 3600) / 60)
  if (h > 0) return m > 0 ? `${h} ч ${m} мин` : `${h} ч`
  if (m > 0) return `${m} мин`
  return 'меньше минуты'
}
