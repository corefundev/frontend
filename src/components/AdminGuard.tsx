// src/components/AdminGuard.tsx
// Blocks a route for non-admins on LEGACY/dev hosts. Still lets the
// server do the real check — we only hide the UI so normal users don't
// see "forbidden" flashes.
//
// ADM-ACCESS (#551): на admin.sprosly.com этот гард БОЛЬШЕ НЕ МОНТИРУЕТСЯ
// (допуск = периметр CF Access, сервер валидирует подпись на каждом
// /api-запросе) — ветки IS_ADMIN_HOST здесь удалены как мёртвые.
import { Navigate } from 'react-router-dom'
import { useAuthStore } from '../features/auth/store'

export default function AdminGuard({ children }: { children: JSX.Element }) {
  const isAuthed = useAuthStore((s) => s.isAuthenticated())
  const isAdmin  = useAuthStore((s) => s.isAdmin())
  if (!isAuthed) return <Navigate to="/login" replace />
  if (!isAdmin)  return <Navigate to="/" replace />
  return children
}
