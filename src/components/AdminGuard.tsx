// src/components/AdminGuard.tsx
// Blocks a route for non-admins. Still lets the server do the real check —
// we only hide the UI so normal users don't see "forbidden" flashes.
import { Navigate } from 'react-router-dom'
import { useAuthStore } from '../features/auth/store'
import { IS_ADMIN_HOST } from '../shared/hostRouting'

export default function AdminGuard({ children }: { children: JSX.Element }) {
  const isAuthed = useAuthStore((s) => s.isAuthenticated())
  const isAdmin  = useAuthStore((s) => s.isAdmin())
  // ADM-HOST (#126): на admin-хосте любой не-админ (в т.ч. живая
  // КЛИЕНТСКАЯ сессия, подтянутая refresh-кукой) идёт на локальную
  // форму админ-входа — консоль с клиентскими аккаунтами не связана.
  if (IS_ADMIN_HOST && !isAdmin) return <Navigate to="/login" replace />
  if (!isAuthed) return <Navigate to="/login" replace />
  if (!isAdmin)  return <Navigate to="/" replace />
  return children
}
