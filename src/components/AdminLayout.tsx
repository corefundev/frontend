// src/components/AdminLayout.tsx
// ADM-0 (#276): the DEDICATED admin console shell. The operator controls
// the system from here — no client-cabinet chrome (no quota/plan widgets,
// no client nav). Visually distinct on purpose: knowing which context you
// act in is a safety property. Sections appear in the nav as they ship
// (ADM-2/4/5/6) — no dead stubs.
import { useEffect, useState } from 'react'
import { NavLink, Outlet, useLocation, useNavigate } from 'react-router-dom'

import { useAuthStore } from '../features/auth/store'

const NAV = [
  { to: '/admin',               label: 'Обзор',          end: true },
  // правка 2026-07-06: «Новый пользователь» — подпункт дерева под
  // «Клиенты» (кнопки на странице списка нет).
  { to: '/admin/clients',       label: 'Клиенты',        end: false,
    children: [{ to: '/admin/clients/new', label: 'Новый пользователь' }] },
  { to: '/admin/plans',         label: 'Тарифы',         end: false },
  { to: '/admin/training',      label: 'Обучение',       end: false },
  { to: '/admin/data',          label: 'Данные',         end: false },
  { to: '/admin/notifications', label: 'Уведомления',    end: false },
  { to: '/admin/audit',         label: 'Аудит',          end: false },
  { to: '/admin/security',      label: 'Безопасность',   end: false },
  { to: '/admin/legal',         label: 'Юр. документы',  end: false },
  { to: '/admin/system',        label: 'Система',        end: false },
] as const

const TITLES: Record<string, string> = {
  '/admin':               'Обзор системы',
  '/admin/clients':       'Клиенты',
  '/admin/plans':         'Тарифы',
  '/admin/training':      'Обучение',
  '/admin/data':          'Данные',
  '/admin/clients/new':   'Новый пользователь',
  '/admin/notifications': 'Уведомления клиентам',
  '/admin/audit':         'Аудит',
  '/admin/security':      'Безопасность',
  '/admin/legal':         'Юридические документы',
  '/admin/system':        'Система',
}

function SessionCountdown() {
  // H2 made visible: admin JWTs live 30 minutes — show the clock instead
  // of surprising the operator with a mid-action 401.
  const expiresAt = useAuthStore((s) => s.expiresAt)
  const logout    = useAuthStore((s) => s.logout)
  const nav = useNavigate()
  const [left, setLeft] = useState<number | null>(null)

  useEffect(() => {
    const tick = () => {
      if (!expiresAt) { setLeft(null); return }
      const ms = expiresAt - Date.now()
      if (ms <= 0) { logout(); nav('/login/admin', { replace: true }); return }
      setLeft(ms)
    }
    tick()
    const id = setInterval(tick, 1000)
    return () => clearInterval(id)
  }, [expiresAt, logout, nav])

  if (left == null) return null
  const m = Math.floor(left / 60000)
  const s = Math.floor((left % 60000) / 1000)
  return (
    <span
      className={`font-mono text-xs tabular-nums ${m < 5 ? 'text-red-500 font-semibold' : 'text-ink-muted'}`}
      title="Оставшееся время админ-сессии (30 мин, ADM-7 H2)"
    >
      {m}:{String(s).padStart(2, '0')}
    </span>
  )
}

export default function AdminLayout() {
  const clientId = useAuthStore((s) => s.clientId)
  const logout   = useAuthStore((s) => s.logout)
  const nav = useNavigate()
  const { pathname } = useLocation()
  const title = TITLES[pathname]
    ?? (pathname.startsWith('/admin/clients/') ? 'Карточка клиента' : 'Админ-консоль')

  return (
    <div className="flex min-h-screen bg-surface">
      <aside className="w-60 shrink-0 bg-slate-900 text-slate-200 flex flex-col">
        <div className="px-5 h-16 flex items-center gap-2 border-b border-slate-800">
          <span className="h-2.5 w-2.5 rounded-full bg-red-500" aria-hidden />
          <div>
            <div className="text-sm font-semibold tracking-tight text-white">Админ-консоль</div>
            <div className="text-[10px] uppercase tracking-wider text-slate-400">production</div>
          </div>
        </div>
        <nav className="flex-1 px-3 py-4 space-y-1">
          {NAV.map((item) => (
            <div key={item.to}>
              <NavLink
                to={item.to}
                end={'children' in item ? true : item.end}
                className={({ isActive }) =>
                  `block rounded-md px-3 py-2 text-sm transition-colors ${
                    isActive
                      ? 'bg-slate-800 text-white font-medium'
                      : 'text-slate-300 hover:bg-slate-800/60 hover:text-white'
                  }`
                }
              >
                {item.label}
              </NavLink>
              {'children' in item && item.children.map((ch) => (
                <NavLink
                  key={ch.to}
                  to={ch.to}
                  className={({ isActive }) =>
                    `block rounded-md pl-8 pr-3 py-1.5 text-[13px] transition-colors ${
                      isActive
                        ? 'bg-slate-800 text-white font-medium'
                        : 'text-slate-400 hover:bg-slate-800/60 hover:text-white'
                    }`
                  }
                >
                  {ch.label}
                </NavLink>
              ))}
            </div>
          ))}
        </nav>

      </aside>

      <div className="flex-1 flex flex-col min-w-0">
        <header className="flex items-center justify-between bg-surface-raised border-b border-surface-border px-6 h-16 shrink-0 gap-6">
          <h1 className="text-lg font-semibold tracking-tight text-ink">{title}</h1>
          <div className="flex items-center gap-4">
            <SessionCountdown />
            <span className="font-mono text-xs text-ink-muted">{clientId ?? '—'}</span>
            <button
              type="button"
              className="btn-secondary text-sm"
              onClick={() => { logout(); nav('/login/admin') }}
            >
              Выйти
            </button>
          </div>
        </header>
        <main className="flex-1 overflow-y-auto p-6">
          <Outlet />
        </main>
      </div>
    </div>
  )
}
