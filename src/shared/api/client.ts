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

import axios, { type AxiosError } from 'axios'
import { useAuthStore } from '../../features/auth/store'

function resolveBaseUrl(): string {
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
function attachAuth(config: any) {
  const token = useAuthStore.getState().token
  if (token) config.headers.Authorization = `Bearer ${token}`
  return config
}
apiClient.interceptors.request.use(attachAuth)
uploadClient.interceptors.request.use(attachAuth)

// ── Response interceptor: 401 → logout + redirect ─────────────────────────
//
// Only treat 401 as "session expired" for REGULAR endpoints. A 401 on
// the auth endpoints themselves (/auth/login, /auth/login/verify,
// /auth/signup, /auth/signup/verify, /auth/token) means "wrong
// credentials this attempt" — a normal mutation error to surface as a
// toast, not a reason to wipe state and reload the page.
function handle401(error: AxiosError) {
  const url = error.config?.url ?? ''
  const isAuthAttempt =
    url.startsWith('/auth/login') ||
    url.startsWith('/auth/signup') ||
    url.startsWith('/auth/token')

  if (error.response?.status === 401 && !isAuthAttempt) {
    useAuthStore.getState().logout()
    if (!window.location.pathname.startsWith('/login')) {
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
