// src/components/AdminGuard.tsx
// Blocks a route for non-admins. Still lets the server do the real check —
// we only hide the UI so normal users don't see "forbidden" flashes.
import { Navigate } from 'react-router-dom'
import { useAuthStore } from '../features/auth/store'

export default function AdminGuard({ children }: { children: JSX.Element }) {
  const isAuthed = useAuthStore((s) => s.isAuthenticated())
  const isAdmin  = useAuthStore((s) => s.isAdmin())
  if (!isAuthed) return <Navigate to="/login" replace />
  if (!isAdmin)  return <Navigate to="/" replace />
  return children
}
