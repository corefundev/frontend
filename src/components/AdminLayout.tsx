// src/components/AdminLayout.tsx
// ADM-0 (#276): the DEDICATED admin console shell — knowing which context
// you act in is a safety property (красная рамка + Admin-чип, прототип).
// ADM-v3-9 (#394, инкременты 1/3/4/5 — 100% соответствие прототипу):
//   • шапка: лого SKU Console + красный Admin-чип, ЖИВАЯ статус-полоса
//     (алерты/обучения/бэкап/audit-цепочка, клик = переход), кнопка
//     «Поиск и действия ⌘K», таймер сессии (H2), переключатель темы;
//   • светлая навигация группами (КЛИЕНТЫ/ОПЕРАЦИИ/КОНТРОЛЬ/ПРОЧЕЕ),
//     активный пункт = brand-bg, счётчики-бейджи;
//   • тёмная тема .admin-dark (значения прототипа), system→dark→light;
//   • query-ключи общие со страницами — полоса не удваивает запросы;
//     недоступный сигнал = «?», никогда не зеленеет молча (AUD-12).
import { useEffect, useState } from 'react'
import { useQuery, useQueryClient } from '@tanstack/react-query'
import { NavLink, Outlet, useLocation, useNavigate } from 'react-router-dom'

import { apiClient } from '../shared/api/client'
import { useAuthStore } from '../features/auth/store'
import { clientsApi } from '../features/clients/api'
import AdminCommandPalette from './AdminCommandPalette'
import { admApexPath, admPath } from '../shared/hostRouting'

const NAV_GROUPS: {
  header: string | null
  collapsible?: boolean
  items: { to: string; label: string; end: boolean
           badge?: 'stuck' | 'firing' | 'clients'
           children?: { to: string; label: string }[] }[]
}[] = [
  { header: null, items: [{ to: '/admin', label: 'Обзор', end: true }] },
  { header: 'Клиенты', items: [
    { to: '/admin/clients', label: 'Клиенты', end: false, badge: 'clients' },
    { to: '/admin/plans', label: 'Тарифы', end: false },
  ] },
  { header: 'Операции', items: [
    { to: '/admin/training', label: 'Обучение', end: false, badge: 'stuck' },
    { to: '/admin/data', label: 'Данные', end: false },
    { to: '/admin/notifications', label: 'Уведомления', end: false },
    { to: '/admin/news', label: 'Новости', end: false },
    { to: '/admin/help', label: 'База знаний', end: false },
  ] },
  { header: 'Контроль', collapsible: true, items: [
    { to: '/admin/audit', label: 'Аудит', end: false },
    { to: '/admin/security', label: 'Безопасность', end: false },
    { to: '/admin/system', label: 'Система', end: false, badge: 'firing' },
  ] },
  { header: 'Документы', collapsible: true, items: [
    { to: '/admin/legal', label: 'Privacy', end: true },
    { to: '/admin/legal/terms', label: 'Terms', end: false },
    { to: '/admin/legal/consent', label: 'Согласие ПДн', end: false },
    { to: '/admin/legal/pdn', label: 'Политика ПДн', end: false },
    { to: '/admin/legal/requisites', label: 'Реквизиты', end: false },
  ] },
]

const TITLES: Record<string, string> = {
  '/admin':               'Обзор системы',
  '/admin/clients':       'Клиенты',
  '/admin/plans':         'Тарифы',
  '/admin/training':      'Обучение',
  '/admin/data':          'Данные',
  '/admin/clients/new':   'Клиенты',
  '/admin/notifications': 'Уведомления клиентам',
  '/admin/news': 'Новости',
  '/admin/help': 'База знаний',
  '/admin/help/new': 'Новая статья',
  '/admin/audit':         'Аудит',
  '/admin/security':      'Безопасность',
  '/admin/legal':         'Privacy',
  '/admin/legal/terms':   'Terms',
  '/admin/legal/consent': 'Согласие на обработку ПДн',
  '/admin/legal/pdn':     'Политика обработки ПДн (152-ФЗ)',
  '/admin/legal/requisites': 'Реквизиты',
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
    <span className="text-xs text-ink-subtle whitespace-nowrap"
          title="Оставшееся время админ-сессии (30 мин, ADM-7 H2)">
      сессия{' '}
      <b className={`font-mono tabular-nums font-semibold ${
        m < 5 ? 'text-red-500' : 'text-ink-muted'}`}>
        {m}:{String(s).padStart(2, '0')}
      </b>
    </span>
  )
}

// ── живые сигналы хрома ─────────────────────────────────────────────────

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
    queryKey: ['admin-training-oversight', 50],
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
  const clients = useQuery({
    queryKey: ['admin-clients'],
    queryFn: () => clientsApi.list(),
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
    clients: clients.isError ? null : (clients.data?.length ?? 0),
  }
}

// прототип .status-item: точка-индикатор + текст + жирное значение
function StatusItem({ tone, label, value, title, to }: {
  tone: 'ok' | 'warn' | 'danger' | 'unknown'
  label: string; value: string; title: string; to: string
}) {
  const nav = useNavigate()
  const dot = {
    ok: 'bg-success', warn: 'bg-warn', danger: 'bg-danger',
    unknown: 'bg-ink-subtle',
  }[tone]
  return (
    <button type="button" title={title} onClick={() => nav(to)}
            className="flex items-center gap-[7px] px-2.5 py-[5px] rounded-md text-[12.5px] text-ink-muted hover:bg-surface-muted transition-colors whitespace-nowrap">
      <span className={`h-[7px] w-[7px] rounded-full shrink-0 ${dot}`} aria-hidden />
      {label} <b className="text-ink font-semibold tabular-nums">{value}</b>
    </button>
  )
}

function StatusStrip() {
  const s = useChromeSignals()
  const fmtAge = (sec: number) =>
    sec < 5400 ? `${Math.round(sec / 60)} мин` : `${Math.round(sec / 3600)} ч`
  return (
    <div className="flex items-center gap-1 flex-1 overflow-x-auto min-w-0"
         aria-label="Живой статус системы">
      {s.firing == null
        ? <StatusItem tone="unknown" label="Алерты" value="?" title="Состояние алертов недоступно" to={admPath('/admin/system')} />
        : s.firing > 0
          ? <StatusItem tone="danger" label="Алерты" value={String(s.firing)} title={`Firing-алертов: ${s.firing}`} to={admPath('/admin/system')} />
          : <StatusItem tone="ok" label="Алерты" value="0" title="Firing-алертов нет" to={admPath('/admin/system')} />}
      {s.stuck == null
        ? <StatusItem tone="unknown" label="Обучения" value="?" title="Лента обучений недоступна" to={admPath('/admin/training')} />
        : s.stuck > 0
          ? <StatusItem tone="warn" label="Обучения" value={`${s.stuck} зависла?`} title="Зависшие тренировки — Reconcile на «Обучении»" to={admPath('/admin/training')} />
          : <StatusItem tone="ok" label="Обучения" value={String(s.running ?? 0)} title="Тренировок в работе" to={admPath('/admin/training')} />}
      {s.backup == null || !s.backup
        ? <StatusItem tone="unknown" label="Бэкап" value="?" title="Свежесть бэкапа недоступна" to={admPath('/admin/system')} />
        : s.backup.stale
          ? <StatusItem tone="danger" label="Бэкап" value={fmtAge(s.backup.age_sec)} title="Бэкап отстаёт от каденса" to={admPath('/admin/system')} />
          : <StatusItem tone="ok" label="Бэкап" value={`${fmtAge(s.backup.age_sec)} назад`} title="Последний успешный бэкап" to={admPath('/admin/system')} />}
      {s.chain == null
        ? <StatusItem tone="unknown" label="Audit-цепочка" value="?" title="Статус цепочки недоступен" to={admPath('/admin/audit')} />
        : !s.chain.stamped
          ? <StatusItem tone="warn" label="Audit-цепочка" value="не проверялась" title="Автопроверка ещё не штамповалась" to={admPath('/admin/audit')} />
          : s.chain.verdict?.ok === false
            ? <StatusItem tone="danger" label="Audit-цепочка" value="НАРУШЕНА" title="HMAC-цепочка нарушена!" to={admPath('/admin/audit')} />
            : s.chain.stale
              ? <StatusItem tone="warn" label="Audit-цепочка" value="крон молчит" title="Вердикт устарел" to={admPath('/admin/audit')} />
              : <StatusItem tone="ok" label="Audit-цепочка" value="целостна" title="HMAC-цепочка цела" to={admPath('/admin/audit')} />}
    </div>
  )
}

// тема консоли — system (default) → dark → light по циклу; выбор в
// localStorage, system следит за prefers-color-scheme
type ThemeMode = 'system' | 'dark' | 'light'

function ThemeIcon({ mode, dark }: { mode: ThemeMode; dark: boolean }) {
  // прототипная штриховая иконка (15px, stroke 2, currentColor)
  if (mode === 'system') {
    return (
      <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor"
           strokeWidth="2" strokeLinecap="round" aria-hidden>
        <circle cx="12" cy="12" r="9" />
        <path d="M12 3a9 9 0 0 1 0 18z" fill="currentColor" stroke="none" />
      </svg>
    )
  }
  if (dark) {
    return (
      <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor"
           strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
        <path d="M21 12.8A9 9 0 1 1 11.2 3a7 7 0 0 0 9.8 9.8z" />
      </svg>
    )
  }
  return (
    <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor"
         strokeWidth="2" strokeLinecap="round" aria-hidden>
      <circle cx="12" cy="12" r="4" />
      <path d="M12 2v2M12 20v2M4.9 4.9l1.4 1.4M17.7 17.7l1.4 1.4M2 12h2M20 12h2M4.9 19.1l1.4-1.4M17.7 6.3l1.4-1.4" />
    </svg>
  )
}

function useAdminTheme(): [boolean, ThemeMode, () => void] {
  const [mode, setMode] = useState<ThemeMode>(
    () => (localStorage.getItem('admin-theme') as ThemeMode) || 'system')
  const [systemDark, setSystemDark] = useState(
    () => window.matchMedia('(prefers-color-scheme: dark)').matches)

  useEffect(() => {
    const mq = window.matchMedia('(prefers-color-scheme: dark)')
    const onChange = (e: MediaQueryListEvent) => setSystemDark(e.matches)
    mq.addEventListener('change', onChange)
    return () => mq.removeEventListener('change', onChange)
  }, [])

  const cycle = () => {
    const next: ThemeMode = mode === 'system' ? 'dark' : mode === 'dark' ? 'light' : 'system'
    setMode(next)
    if (next === 'system') localStorage.removeItem('admin-theme')
    else localStorage.setItem('admin-theme', next)
  }
  const dark = mode === 'dark' || (mode === 'system' && systemDark)
  return [dark, mode, cycle]
}

function UpdatedAgo() {
  // прототип: «обновлено 30 с назад» — честно от последнего успешного
  // рефетча живых сигналов (react-query dataUpdatedAt)
  const [, force] = useState(0)
  useEffect(() => {
    const id = setInterval(() => force((x) => x + 1), 10_000)
    return () => clearInterval(id)
  }, [])
  const qc = useQueryClient()
  const stamps = ['admin-alerts', 'admin-system']
    .map((k) => qc.getQueryState([k])?.dataUpdatedAt ?? 0)
  const newest = Math.max(...stamps)
  if (!newest) return null
  const sec = Math.max(0, Math.round((Date.now() - newest) / 1000))
  const label = sec < 90 ? `${sec} с` : `${Math.round(sec / 60)} мин`
  return <span className="text-[12.5px] text-ink-subtle">обновлено {label} назад</span>
}

export default function AdminLayout() {
  const clientId = useAuthStore((s) => s.clientId)
  const logout   = useAuthStore((s) => s.logout)
  const nav = useNavigate()
  // ADM-HOST (#122): матчинг ниже ходит по апексным '/admin/*'-ключам —
  // на admin-хосте путь приводится к апексной форме.
  const { pathname: rawPathname } = useLocation()
  const pathname = admApexPath(rawPathname)
  const signals = useChromeSignals()
  const [dark, themeMode, cycleTheme] = useAdminTheme()
  const [paletteOpen, setPaletteOpen] = useState(false)

  // Скрыть страничный скроллбар, пока открыта консоль (снимается при
  // уходе из админки — публичка/кабинет не затронуты)
  useEffect(() => {
    document.documentElement.classList.add('admin-no-scrollbar')
    return () => document.documentElement.classList.remove('admin-no-scrollbar')
  }, [])
  // «Контроль»/«Документы» свёрнуты по умолчанию; клик по заголовку
  // раскрывает; активный раздел внутри группы держит её раскрытой
  const [openGroups, setOpenGroups] = useState<Record<string, boolean>>({})
  const cardMatch = pathname.match(/^\/admin\/clients\/([^/]+)$/)
  const cardId = cardMatch && cardMatch[1] !== 'new'
    ? decodeURIComponent(cardMatch[1]) : null
  const title = TITLES[pathname]
    ?? (cardId ? 'Клиенты'
      : pathname.startsWith('/admin/news/') ? 'Новости'
      : pathname.startsWith('/admin/help/') ? 'База знаний'
      : 'Админ-консоль')

  const navBadge = (kind?: 'stuck' | 'firing' | 'clients'): number => {
    if (kind === 'stuck') return signals.stuck ?? 0
    if (kind === 'firing') return signals.firing ?? 0
    if (kind === 'clients') return signals.clients ?? 0
    return 0
  }

  return (
    <div className={`admin-console min-h-screen bg-surface text-ink ${dark ? 'admin-dark' : ''}`}>
      {/* ── Шапка (прототип): лого + Admin-чип · статус-полоса · ⌘K · сессия · тема ── */}
      <header className="sticky top-0 z-20 h-[54px] bg-surface-raised border-b border-surface-border flex items-center gap-4 px-4">
        <div className="flex-1 basis-0 min-w-0 flex items-center">
          <StatusStrip />
        </div>
        <button type="button"
                className="shrink-0 flex items-center gap-2 px-2.5 py-1.5 rounded-md ring-1 ring-surface-border text-xs text-ink-subtle hover:text-ink-muted hover:ring-surface-deep transition-colors"
                onClick={() => setPaletteOpen(true)}>
          Поиск и действия
          <kbd className="text-[10.5px] px-1.5 rounded border border-surface-deep border-b-2 bg-surface-muted text-ink-muted font-sans">⌘K</kbd>
        </button>
        <div className="flex-1 basis-0 min-w-0 flex items-center justify-end gap-2.5">
          <SessionCountdown />
          <button type="button"
                  className="h-[30px] w-[30px] rounded-md ring-1 ring-surface-border flex items-center justify-center text-ink-muted hover:bg-surface-muted transition-colors"
                  title={`Тема: ${themeMode === 'system' ? 'системная' : themeMode === 'dark' ? 'тёмная' : 'светлая'} (клик — переключить)`}
                  aria-label="Переключить тему"
                  onClick={cycleTheme}>
            <ThemeIcon mode={themeMode} dark={dark} />
          </button>
          <span className="font-mono text-xs text-ink-subtle">{clientId ?? '—'}</span>
          <button type="button" className="btn-ghost text-xs"
                  onClick={() => { logout(); nav('/login/admin') }}>
            Выйти
          </button>
        </div>
      </header>

      <div className="flex min-h-[calc(100vh-59px)]">
        {/* ── Светлая навигация группами (прототип). Сайдбар липнет под
             шапкой и не уезжает при скролле рабочей области; при
             переполнении скроллится сам. Граница — на обёртке, чтобы
             тянулась на всю высоту колонки. ── */}
        <div className="w-[216px] shrink-0 border-r border-surface-border">
        <nav className="sticky top-[54px] max-h-[calc(100vh-54px)] overflow-y-auto scrollbar-none px-2.5 py-4"
             aria-label="Разделы консоли">
          {NAV_GROUPS.map((group, gi) => {
            const hasActive = group.items.some((i) =>
              pathname === i.to || pathname.startsWith(i.to + '/'))
            const open = !group.collapsible || hasActive
              || openGroups[group.header ?? ''] === true
            return (
            <div key={gi} className="mb-3.5">
              {group.header && (group.collapsible ? (
                <button type="button"
                        className="w-full flex items-center gap-1 m-0 mb-1 px-2.5 text-[10px] font-bold uppercase tracking-widest text-ink-subtle hover:text-ink-muted transition-colors"
                        aria-expanded={open}
                        onClick={() => setOpenGroups((g) => ({
                          ...g, [group.header ?? '']: !open }))}>
                  {group.header}
                  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5"
                       strokeLinecap="round" strokeLinejoin="round"
                       className={`h-3 w-3 transition-transform ${open ? 'rotate-180' : ''}`}
                       aria-hidden>
                    <path d="M6 9l6 6 6-6" />
                  </svg>
                </button>
              ) : (
                <p className="m-0 mb-1 px-2.5 text-[10px] font-bold uppercase tracking-widest text-ink-subtle">
                  {group.header}
                </p>
              ))}
              {open && group.items.map((item) => (
                <div key={item.to}>
                  <NavLink
                    to={admPath(item.to)}
                    end={item.children ? true : item.end}
                    className={({ isActive }) =>
                      `flex items-center gap-2 rounded-md px-2.5 py-[6.5px] text-[13.5px] transition-colors ${
                        isActive ? 'font-semibold' : 'text-ink-muted hover:bg-surface-muted hover:text-ink'
                      }`}
                    style={({ isActive }) => isActive
                      ? { background: 'var(--admin-brand-bg)', color: 'var(--admin-brand-ink)' }
                      : undefined}
                  >
                    <span>{item.label}</span>
                    {navBadge(item.badge) > 0 && (
                      <span className={`ml-auto text-[10.5px] font-bold rounded-full px-1.5 py-px tabular-nums ${
                        item.badge === 'clients'
                          ? 'bg-surface-muted text-ink-subtle'
                          : 'bg-warn-bg text-warn'}`}>
                        {navBadge(item.badge)}
                      </span>
                    )}
                  </NavLink>
                  {item.children?.map((ch) => (
                    <NavLink
                      key={ch.to}
                      to={admPath(ch.to)}
                      className={({ isActive }) =>
                        `flex items-center gap-1.5 rounded-md pl-7 pr-2.5 py-1 text-[12.5px] transition-colors ${
                          isActive ? 'font-semibold' : 'text-ink-subtle hover:bg-surface-muted hover:text-ink'
                        }`}
                      style={({ isActive }) => isActive
                        ? { background: 'var(--admin-brand-bg)', color: 'var(--admin-brand-ink)' }
                        : undefined}
                    >
                      <span aria-hidden className="text-[13px] leading-none">+</span>
                      {ch.label}
                    </NavLink>
                  ))}
                </div>
              ))}
            </div>
            )
          })}
        </nav>
        </div>

        <main className="flex-1 min-w-0 px-7 pt-6 pb-12 max-w-[1160px]">
          <div className="flex items-baseline gap-3 mb-4">
            <h1 className="text-[19px] font-semibold tracking-tight text-ink">
              {title}
              {cardId && <span className="text-ink-subtle font-normal"> / {cardId}</span>}
            </h1>
            <UpdatedAgo />
          </div>
          <Outlet />
        </main>
      </div>

      {/* #394-3: Cmd/Ctrl+K — палитра (управляется и кнопкой в шапке) */}
      <AdminCommandPalette open={paletteOpen} onOpenChange={setPaletteOpen} />
    </div>
  )
}
