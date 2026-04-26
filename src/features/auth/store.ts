// src/features/auth/store.ts
//
// Auth store — token + derived roles decoded from the JWT payload.
//
// We don't VERIFY the JWT signature client-side (the server is the source
// of truth for authorization). We only decode the payload so the UI can
// hide admin affordances — the server rejects the request if the role
// claim is wrong anyway.
import { create } from 'zustand'
import { persist } from 'zustand/middleware'

export type Role = 'forecast' | 'admin'

interface JwtPayload {
  sub?: string
  client_id?: string
  roles?: string[]
  exp?: number
}

// base64url → string, works in the browser without Node Buffer.
function b64urlDecode(s: string): string {
  s = s.replace(/-/g, '+').replace(/_/g, '/')
  const pad = s.length % 4
  if (pad) s += '='.repeat(4 - pad)
  return atob(s)
}

export function decodeJwtPayload(token: string): JwtPayload | null {
  const parts = token.split('.')
  if (parts.length !== 3) return null
  try {
    return JSON.parse(b64urlDecode(parts[1])) as JwtPayload
  } catch {
    return null
  }
}

interface AuthState {
  token: string | null
  clientId: string | null
  roles: Role[]
  expiresAt: number | null      // ms epoch; null if not parsed

  setAuth: (token: string, fallbackClientId?: string) => void
  logout: () => void
  isAuthenticated: () => boolean
  hasRole: (role: Role) => boolean
  isAdmin: () => boolean
}

export const useAuthStore = create<AuthState>()(
  persist(
    (set, get) => ({
      token: null,
      clientId: null,
      roles: [],
      expiresAt: null,

      setAuth: (token, fallbackClientId) => {
        const p = decodeJwtPayload(token)
        const clientId = p?.client_id ?? p?.sub ?? fallbackClientId ?? null
        const roles    = (p?.roles ?? []).filter(
          (r): r is Role => r === 'admin' || r === 'forecast',
        )
        const expiresAt = typeof p?.exp === 'number' ? p.exp * 1000 : null
        set({ token, clientId, roles, expiresAt })
      },

      logout: () => set({ token: null, clientId: null, roles: [], expiresAt: null }),

      isAuthenticated: () => {
        const { token, expiresAt } = get()
        if (!token) return false
        if (expiresAt && expiresAt < Date.now()) return false
        return true
      },
      hasRole: (role) => get().roles.includes(role),
      isAdmin:  () => get().roles.includes('admin'),
    }),
    {
      name: 'sku-auth',
      partialize: (s) => ({
        token: s.token,
        clientId: s.clientId,
        roles: s.roles,
        expiresAt: s.expiresAt,
      }),
    }
  )
)
