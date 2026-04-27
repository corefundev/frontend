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
export function errorMessage(err: unknown, fallback = 'Произошла ошибка'): string {
  const ax = err as AxiosError<{ detail?: string | Array<{ msg?: string }> }>
  const detail = ax?.response?.data?.detail
  if (typeof detail === 'string') return detail
  if (Array.isArray(detail) && detail[0]?.msg) return detail[0].msg
  if (ax?.message) return ax.message
  return fallback
}
