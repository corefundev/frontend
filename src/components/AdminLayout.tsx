// src/components/AdminLayout.tsx
// ADM-0 (#276): the DEDICATED admin console shell. The operator controls
// the system from here — no client-cabinet chrome (no quota/plan widgets,
// no client nav). Visually distinct on purpose: knowing which context you
// act in is a safety property. Sections appear in the nav as they ship
// (ADM-2/4/5/6) — no dead stubs.
// ADM-v3-9 (#394, инкремент 1): навигация группами (КЛИЕНТЫ/ОПЕРАЦИИ/
// КОНТРОЛЬ) + живая статус-полоса в шапке (алерты/обучения/бэкап/
// audit-цепочка; клик = переход). Query-ключи совпадают со страницами —
// react-query разделяет кэш, полоса не удваивает запросы. Недоступный
// сигнал рендерится «?»-warn, никогда не прячется и не зеленеет (AUD-12).
import { useEffect, useState } from 'react'
import { useQuery } from '@tanstack/react-query'
import { NavLink, Outlet, useLocation, useNavigate } from 'react-router-dom'

import { apiClient } from '../shared/api/client'
import { useAuthStore } from '../features/auth/store'
import AdminCommandPalette from './AdminCommandPalette'

const NAV_GROUPS: {
  header: string | null
  items: { to: string; label: string; end: boolean; badge?: 'stuck' | 'firing'
           children?: { to: string; label: string }[] }[]
}[] = [
  { header: null, items: [{ to: '/admin', label: 'Обзор', end: true }] },
  { header: 'Клиенты', items: [
    // правка 2026-07-06: «Новый пользователь» — подпункт дерева под
    // «Клиенты» (кнопки на странице списка нет).
    { to: '/admin/clients', label: 'Клиенты', end: false,
      children: [{ to: '/admin/clients/new', label: 'Новый пользователь' }] },
    { to: '/admin/plans', label: 'Тарифы', end: false },
  ] },
  { header: 'Операции', items: [
    { to: '/admin/training', label: 'Обучение', end: false, badge: 'stuck' },
    { to: '/admin/data', label: 'Данные', end: false },
    { to: '/admin/notifications', label: 'Уведомления', end: false },
  ] },
  { header: 'Контроль', items: [
    { to: '/admin/audit', label: 'Аудит', end: false },
    { to: '/admin/security', label: 'Безопасность', end: false },
    { to: '/admin/system', label: 'Система', end: false, badge: 'firing' },
  ] },
  { header: null, items: [{ to: '/admin/legal', label: 'Юр. документы', end: false }] },
]

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

// ── #394-1: живые сигналы хрома ─────────────────────────────────────────

interface AlertsInfo { counts?: { firing?: number } }
interface Oversight {
  runs: { status: string; started_at: string | null }[]
  stuck_threshold_min?: number
}
interface SystemInfo {
  jobs: { job: string; age_sec: number; stale: boolean }[]
}
interface ChainStatus {
  stamped: boolean
  stale: boolean | null
  verdict: { ok?: boolean } | null
}

function useChromeSignals() {
  const alerts = useQuery({
    queryKey: ['admin-alerts'],
    queryFn: async () =>
      (await apiClient.get<AlertsInfo>('/admin/alerts')).data,
    refetchInterval: 45_000, meta: { silent: true }, retry: 1,
  })
  const training = useQuery({
    queryKey: ['admin-training-oversight'],
    queryFn: async () =>
      (await apiClient.get<Oversight>('/admin/training-runs',
        { params: { limit: 50 } })).data,
    refetchInterval: 60_000, meta: { silent: true }, retry: 1,
  })
  const system = useQuery({
    queryKey: ['admin-system'],
    queryFn: async () =>
      (await apiClient.get<SystemInfo>('/admin/system')).data,
    refetchInterval: 60_000, meta: { silent: true }, retry: 1,
  })
  const chain = useQuery({
    queryKey: ['admin-audit-chain-status'],
    queryFn: async () =>
      (await apiClient.get<ChainStatus>('/admin/audit/chain-status')).data,
    refetchInterval: 300_000, meta: { silent: true }, retry: 1,
  })

  const threshold = training.data?.stuck_threshold_min ?? 90
  const running = (training.data?.runs ?? []).filter((r) => r.status === 'running')
  const stuck = running.filter((r) =>
    r.started_at && Date.now() - new Date(r.started_at).getTime() > threshold * 60_000)
  const backup = (system.data?.jobs ?? []).find((j) => j.job === 'backup')

  return {
    firing: alerts.isError ? null : (alerts.data?.counts?.firing ?? 0),
    running: training.isError ? null : running.length,
    stuck: training.isError ? null : stuck.length,
    backup: system.isError ? null : backup ?? null,
    chain: chain.isError ? null : (chain.data ?? null),
  }
}

function Pill({ tone, label, title, to }: {
  tone: 'ok' | 'warn' | 'danger' | 'unknown'
  label: string; title: string; to: string
}) {
  const nav = useNavigate()
  const cls = {
    ok:      'bg-emerald-500/15 text-emerald-300',
    warn:    'bg-amber-500/15 text-amber-300',
    danger:  'bg-red-500/20 text-red-300',
    unknown: 'bg-slate-500/20 text-slate-300',
  }[tone]
  return (
    <button type="button" title={title} onClick={() => nav(to)}
            className={`px-2 py-0.5 rounded-full text-[11px] font-medium tabular-nums ${cls} hover:brightness-125 transition`}>
      {label}
    </button>
  )
}

function StatusStrip() {
  const s = useChromeSignals()
  const fmtAge = (sec: number) =>
    sec < 5400 ? `${Math.round(sec / 60)} мин` : `${Math.round(sec / 3600)} ч`
  return (
    <div className="flex items-center gap-1.5" aria-label="Состояние системы">
      {s.firing == null
        ? <Pill tone="unknown" label="алерты ?" title="Состояние алертов недоступно" to="/admin/system" />
        : s.firing > 0
          ? <Pill tone="danger" label={`алерты ${s.firing}`} title={`Firing-алертов: ${s.firing}`} to="/admin/system" />
          : <Pill tone="ok" label="алертов нет" title="Firing-алертов нет" to="/admin/system" />}
      {s.stuck == null
        ? <Pill tone="unknown" label="обучения ?" title="Лента обучений недоступна" to="/admin/training" />
        : s.stuck > 0
          ? <Pill tone="danger" label={`зависло ${s.stuck}`} title="Зависшие тренировки — Reconcile" to="/admin/training" />
          : <Pill tone="ok" label={`обучений ${s.running ?? 0}`} title="Тренировок в работе" to="/admin/training" />}
      {s.backup === null
        ? <Pill tone="unknown" label="бэкап ?" title="Свежесть бэкапа недоступна" to="/admin/system" />
        : s.backup === undefined || !s.backup
          ? <Pill tone="warn" label="бэкап ?" title="Метрика бэкапа не найдена" to="/admin/system" />
          : s.backup.stale
            ? <Pill tone="danger" label={`бэкап ${fmtAge(s.backup.age_sec)}`} title="Бэкап отстаёт от каденса" to="/admin/system" />
            : <Pill tone="ok" label={`бэкап ${fmtAge(s.backup.age_sec)}`} title="Последний успешный бэкап" to="/admin/system" />}
      {s.chain === null
        ? <Pill tone="unknown" label="цепочка ?" title="Статус audit-цепочки недоступен" to="/admin/audit" />
        : !s.chain.stamped
          ? <Pill tone="warn" label="цепочка —" title="Автопроверка ещё не штамповалась" to="/admin/audit" />
          : s.chain.verdict?.ok === false
            ? <Pill tone="danger" label="ЦЕПОЧКА!" title="HMAC-цепочка НАРУШЕНА" to="/admin/audit" />
            : s.chain.stale
              ? <Pill tone="warn" label="цепочка стух." title="Вердикт устарел — крон молчит" to="/admin/audit" />
              : <Pill tone="ok" label="цепочка ок" title="HMAC-цепочка цела" to="/admin/audit" />}
    </div>
  )
}

export default function AdminLayout() {
  const clientId = useAuthStore((s) => s.clientId)
  const logout   = useAuthStore((s) => s.logout)
  const nav = useNavigate()
  const { pathname } = useLocation()
  const signals = useChromeSignals()
  const title = TITLES[pathname]
    ?? (pathname.startsWith('/admin/clients/') ? 'Карточка клиента' : 'Админ-консоль')

  const navBadge = (kind?: 'stuck' | 'firing'): number => {
    if (kind === 'stuck') return signals.stuck ?? 0
    if (kind === 'firing') return signals.firing ?? 0
    return 0
  }

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
        <nav className="flex-1 px-3 py-4 space-y-4">
          {NAV_GROUPS.map((group, gi) => (
            <div key={gi} className="space-y-1">
              {group.header && (
                <div className="px-3 pt-1 text-[10px] uppercase tracking-wider text-slate-500">
                  {group.header}
                </div>
              )}
              {group.items.map((item) => (
                <div key={item.to}>
                  <NavLink
                    to={item.to}
                    end={item.children ? true : item.end}
                    className={({ isActive }) =>
                      `flex items-center justify-between rounded-md px-3 py-2 text-sm transition-colors ${
                        isActive
                          ? 'bg-slate-800 text-white font-medium'
                          : 'text-slate-300 hover:bg-slate-800/60 hover:text-white'
                      }`
                    }
                  >
                    <span>{item.label}</span>
                    {navBadge(item.badge) > 0 && (
                      <span className="ml-2 px-1.5 rounded-full bg-red-500/90 text-white text-[10px] font-semibold tabular-nums">
                        {navBadge(item.badge)}
                      </span>
                    )}
                  </NavLink>
                  {item.children?.map((ch) => (
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
            </div>
          ))}
        </nav>
        <div className="px-4 py-3 border-t border-slate-800">
          <StatusStrip />
        </div>
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
      {/* #394-3: Cmd/Ctrl+K — навигационная палитра */}
      <AdminCommandPalette />
    </div>
  )
}
