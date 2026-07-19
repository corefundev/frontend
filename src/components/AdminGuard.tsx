// src/components/AdminGuard.tsx
// Blocks a route for non-admins. Still lets the server do the real check —
// we only hide the UI so normal users don't see "forbidden" flashes.
import { useEffect } from 'react'
import { Navigate } from 'react-router-dom'
import { useAuthStore } from '../features/auth/store'
import { IS_ADMIN_HOST, MAIN_ORIGIN } from '../shared/hostRouting'

function ToApexRoot() {
  // ADM-HOST (#122): на admin-хосте «не админ» уезжает на апекс full-
  // reload'ом — локальный Navigate('/') зациклился бы на консоли.
  useEffect(() => { window.location.replace(MAIN_ORIGIN + '/') }, [])
  return null
}

export default function AdminGuard({ children }: { children: JSX.Element }) {
  const isAuthed = useAuthStore((s) => s.isAuthenticated())
  const isAdmin  = useAuthStore((s) => s.isAdmin())
  if (!isAuthed) return <Navigate to="/login" replace />
  if (!isAdmin)  return IS_ADMIN_HOST ? <ToApexRoot /> : <Navigate to="/" replace />
  return children
}
