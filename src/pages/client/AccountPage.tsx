// AC-1 (#312) — Account Center content container. The section nav lives in the
// app SIDEBAR (AppLayout swaps it to the account menu on /app/account/*, the
// standard "settings replaces the left nav" pattern), so this page is just the
// section outlet.
import { Outlet } from 'react-router-dom'

export default function AccountPage() {
  return (
    <div className="max-w-4xl">
      <Outlet />
    </div>
  )
}
