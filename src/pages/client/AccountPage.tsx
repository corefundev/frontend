// AC-1 (#312) — Account Center shell. Lives inside AppLayout (top bar + main
// nav preserved); adds a secondary left-nav for the account sub-sections.
// Wave-1 skeleton: sections land in their own AC issues (AC-2 profile/security,
// AC-3 data/152-ФЗ, AC-4 email). Empty sections show a "скоро" placeholder.
import { NavLink, Outlet } from 'react-router-dom'

const SECTIONS = [
  { to: 'profile',       label: 'Профиль' },
  { to: 'security',      label: 'Безопасность' },
  { to: 'subscription',  label: 'Подписка' },
  { to: 'notifications', label: 'Уведомления' },
  { to: 'data',          label: 'Данные и приватность' },
]

export default function AccountPage() {
  return (
    <div className="max-w-6xl">
      <header className="mb-8">
        <div className="eyebrow">Аккаунт</div>
        <h1 className="display-em text-brand-700 text-4xl sm:text-5xl mt-2 leading-[1.05]">
          Личный кабинет
        </h1>
        <p className="mt-4 text-ink-muted max-w-2xl leading-relaxed">
          Управление профилем, доступом, подпиской и данными.
        </p>
      </header>

      <div className="grid gap-8 lg:grid-cols-[220px_1fr]">
        <nav className="space-y-0.5">
          {SECTIONS.map((s) => (
            <NavLink
              key={s.to}
              to={s.to}
              className={({ isActive }) =>
                `block rounded-md px-3 py-2 text-sm transition-colors ${
                  isActive
                    ? 'bg-brand-50 text-brand-700 font-medium'
                    : 'text-ink-muted hover:text-ink hover:bg-surface-sunken'
                }`
              }
            >
              {s.label}
            </NavLink>
          ))}
        </nav>

        <div className="min-w-0">
          <Outlet />
        </div>
      </div>
    </div>
  )
}
