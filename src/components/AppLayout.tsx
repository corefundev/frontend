import { Fragment } from 'react'
import { useQuery } from '@tanstack/react-query'
import { newsPublicApi } from '../features/news/publicApi'
import { NavLink, Outlet, useLocation } from 'react-router-dom'
import { useAuthStore } from '../features/auth/store'
import { NotificationBell } from '../features/notifications/NotificationBell'
import { ProfileMenu } from '../features/account/ProfileMenu'
import { useUsage } from '../features/plans/useUsage'
import { PlanBadge } from '../features/plans/PlanBadge'
import { QuotaMeter, LockTag } from '../features/plans/upsell'
import type { PlanId } from '../features/plans/api'

// Sidebar entries; `minPlan` controls whether the item is clickable
// for the current user's plan. `pageTitle` (when present) shows in
// the top header bar in place of the section's nav label — same
// section name on the sidebar, slightly more descriptive name
// above the workspace.
const NAV = [
  { to: '',            label: 'Главная',       pageTitle: 'Панель управления',  icon: IconHome,    minPlan: 'free'     },
  // «Данные» inline group (epic #320): upload → prepare → enrich pipeline.
  { to: 'uploads',      label: 'Загрузки',          pageTitle: 'Загрузки данных',   icon: IconUpload,  minPlan: 'free', group: 'Данные' },
  { to: 'data/prepare', label: 'Подготовка данных', pageTitle: 'Подготовка данных', icon: IconSlider,  minPlan: 'free', group: 'Данные' },
  { to: 'data/enrich',  label: 'Обогащение данных', pageTitle: 'Обогащение данных', icon: IconSpark,   minPlan: 'free', group: 'Данные' },
  { to: 'forecasts',   label: 'Прогнозы',      pageTitle: 'Прогноз',            icon: IconChart,   minPlan: 'free'     },
  { to: 'training',    label: 'Обучение',      pageTitle: 'Обучение модели',    icon: IconCog,     minPlan: 'free'     },
  { to: 'training/history', label: 'История обучений', pageTitle: 'История обучений', icon: IconHistory, minPlan: 'free' },
  { to: 'scenarios',   label: 'Сценарии',      pageTitle: 'Сценарии',           icon: IconSplit,   minPlan: 'business' },
  { to: 'promo',       label: 'Промо',         pageTitle: 'Промо-планировщик',  icon: IconSpark,   minPlan: 'business' },
  { to: 'news',        label: 'Новости',       pageTitle: 'Новости',            icon: IconMegaphone, minPlan: 'free'   },
  { to: 'help',        label: 'Помощь',        pageTitle: 'Помощь',             icon: IconLifebuoy, minPlan: 'free'    },
  { to: 'settings',    label: 'Настройки',     pageTitle: 'Настройки модели',   icon: IconSlider,  minPlan: 'free'     },
  { to: 'upgrade',     label: 'Апгрейд',       pageTitle: 'Тариф',              icon: IconStar,    minPlan: 'free'     },
] as const

// AC-1 (#312): when inside /app/account the sidebar SWAPS to these — the
// account sections replace the main app nav (standard settings pattern), with
// a "back to app" link on top. No icons/plan-locks — account is not tier-gated.
const ACCOUNT_NAV = [
  { to: 'account/profile',       label: 'Профиль' },
  { to: 'account/security',      label: 'Безопасность' },
  { to: 'account/subscription',  label: 'Подписка' },
  { to: 'account/notifications', label: 'Уведомления' },
  { to: 'account/data',          label: 'Данные и приватность' },
] as const

const PLAN_RANK: Record<PlanId, number> = { free: 0, start: 1, business: 2 }

export default function AppLayout() {
  // NEWS-7 (#409): бейдж непрочитанных новостей (тихий поллинг)
  const { data: newsUnread = 0 } = useQuery({
    queryKey: ['news-unread'],
    queryFn: () => newsPublicApi.unreadCount(),
    refetchInterval: 300_000,
    meta: { silent: true },
    retry: 1,
  })
  const location = useLocation()
  const clientId = useAuthStore((s) => s.clientId)
  const { data: usage } = useUsage()

  const userRank = usage ? PLAN_RANK[usage.plan] : 0
  // ADM-0 (#276): админ-пункты живут в выделенной консоли /admin — клиентский
  // сайдбар показывает только клиентские разделы.
  const visibleNav = NAV

  // Pick the longest matching nav entry for the current path so a nested
  // path beats the empty "Главная" entry (which would otherwise
  // prefix-match the root /app path).
  const isAccount = location.pathname.startsWith('/app/account')
  const pageTitle = (() => {
    if (isAccount) {
      const seg = location.pathname.replace(/^\/app\/account\/?/, '') || 'profile'
      return ACCOUNT_NAV.find((n) => n.to === `account/${seg}`)?.label ?? 'Личный кабинет'
    }
    const path = location.pathname.replace(/^\/app\/?/, '')
    const matches = NAV.filter((n) => n.to !== '' && path.startsWith(n.to))
    matches.sort((a, b) => b.to.length - a.to.length)
    if (matches.length > 0) return matches[0].pageTitle
    return NAV[0].pageTitle  // root → "Панель управления"
  })()

  return (
    <div className="min-h-screen flex bg-surface">
      {/* ── Sidebar ─────────────────────────────────────────────── */}
      <aside className="w-64 bg-brand-700 text-ink-invert flex flex-col relative">
        {/* Editorial ambient decoration — thin gold vertical rule */}
        <span
          aria-hidden
          className="absolute top-0 right-0 w-px h-full bg-gradient-to-b from-transparent via-gold-600/30 to-transparent"
        />

        <div className="px-6 py-6 flex items-center gap-3 border-b border-brand-600">
          <div className="h-9 w-9 rounded-md bg-brand-500 flex items-center justify-center text-[11px] font-semibold tracking-wider">
            SKU
          </div>
          <div className="leading-tight">
            <div className="font-display italic text-lg">Forecasting</div>
            {usage && (
              <div className="eyebrow !text-gold-300 !tracking-[0.16em]">
                {usage.model_display_name}
              </div>
            )}
          </div>
        </div>

        {isAccount ? (
          <nav className="flex-1 p-3 space-y-0.5">
            <NavLink
              to=""
              end
              className="flex items-center gap-2 rounded-md px-3 py-2 text-sm text-brand-50/70 hover:bg-brand-600 hover:text-ink-invert transition-colors"
            >
              <span aria-hidden>←</span>
              <span className="truncate">Назад в приложение</span>
            </NavLink>
            <div className="pt-3" />
            {ACCOUNT_NAV.map((s) => (
              <NavLink
                key={s.to}
                to={s.to}
                className={({ isActive }) => [
                  'block rounded-md px-3 py-2 text-sm transition-colors',
                  isActive
                    ? 'bg-brand-500 text-ink-invert'
                    : 'text-brand-50/80 hover:bg-brand-600 hover:text-ink-invert',
                ].join(' ')}
              >
                {s.label}
              </NavLink>
            ))}
          </nav>
        ) : (
        <nav className="flex-1 p-3 space-y-0.5">
          {visibleNav.map((item, i) => {
            const { to, label, icon: Icon } = item
            const minPlan = ('minPlan' in item ? item.minPlan : 'free') as PlanId
            const locked  = PLAN_RANK[minPlan] > userRank
            // Inline nav group: render a small header before the first item of
            // a group (items of one group are contiguous in NAV).
            const group     = ('group' in item ? item.group : undefined) as string | undefined
            const prevItem  = i > 0 ? visibleNav[i - 1] : undefined
            const prevGroup = prevItem && 'group' in prevItem ? (prevItem.group as string) : undefined
            const showGroupHeader = !!group && group !== prevGroup
            // Split locked vs unlocked into two real branches so TS
            // sees the right component (div vs NavLink) and we don't
            // pass `to={undefined}` to NavLink at runtime. The shared
            // child content is extracted to a fragment.
            const inner = (
              <>
                <Icon className="h-4 w-4 shrink-0" />
                <span className="flex-1 truncate">{label}</span>
                {to === 'news' && newsUnread > 0 && (
                  <span className="px-1.5 rounded-full bg-red-500 text-white text-[10px] font-semibold tabular-nums">
                    {newsUnread}
                  </span>
                )}
                {locked && <LockTag required={minPlan} compact />}
              </>
            )
            const itemEl = locked ? (
              <div
                role="link"
                aria-disabled="true"
                className="flex items-center gap-3 rounded-md px-3 py-2 text-sm text-brand-50/40 cursor-not-allowed"
                title={`Доступно в тарифе ${minPlan === 'start' ? 'Start' : 'Business'}`}
              >
                {inner}
              </div>
            ) : (
              <NavLink
                to={to}
                // Strict-match every nav entry so a parent (e.g. "Обучение")
                // doesn't also light up while the user is on a child route
                // (e.g. "Обучение → История").
                end
                className={({ isActive }) => [
                  'flex items-center gap-3 rounded-md px-3 py-2 text-sm',
                  'transition-colors',
                  isActive
                    ? 'bg-brand-500 text-ink-invert'
                    : 'text-brand-50/80 hover:bg-brand-600 hover:text-ink-invert',
                ].join(' ')}
              >
                {inner}
              </NavLink>
            )
            return (
              <Fragment key={to}>
                {showGroupHeader && (
                  <div className="px-3 pt-4 pb-1 eyebrow !text-brand-50/40">{group}</div>
                )}
                {itemEl}
              </Fragment>
            )
          })}
        </nav>
        )}

        {/* Footer of sidebar — client identity */}
        <div className="p-4 border-t border-brand-600">
          <div className="eyebrow !text-brand-50/50">Клиент</div>
          <div className="font-mono text-xs text-ink-invert truncate">{clientId ?? '—'}</div>
        </div>
      </aside>

      {/* ── Main column ─────────────────────────────────────────── */}
      <div className="flex-1 flex flex-col min-w-0">
        <header className="flex items-center justify-between bg-surface-raised border-b border-surface-border px-6 h-16 shrink-0 gap-6">
          <h1 className="text-lg font-semibold tracking-tight text-ink">{pageTitle}</h1>

          <div className="flex items-center gap-6">
            {usage && (
              <QuotaMeter
                // Prefer "current catalog size" (latest processed upload)
                // over "last-trained SKU count" — users see the upload's
                // numbers immediately, before they kick off training.
                used={usage.current_sku_count ?? usage.trained_sku_count ?? 0}
                max={usage.max_skus}
                label="SKU"
              />
            )}
            {usage && (
              <PlanBadge
                plan={usage.plan}
                modelName={usage.model_display_name}
              />
            )}
            <NotificationBell />
            <ProfileMenu />
          </div>
        </header>

        <main className="flex-1 overflow-auto p-6 sm:p-8">
          <Outlet />
        </main>
      </div>
    </div>
  )
}

// ── Icons — keeping them inline keeps the bundle tiny ──────────────────
type IconProps = { className?: string }
function IconMegaphone({ className }: IconProps) {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"
         strokeLinecap="round" strokeLinejoin="round" className={className} aria-hidden>
      <path d="M3 11v3a1 1 0 0 0 1 1h2l3.5 4.5a1 1 0 0 0 1.8-.6V5.1a1 1 0 0 0-1.8-.6L6 9H4a1 1 0 0 0-1 1z" />
      <path d="M15 8.5a5 5 0 0 1 0 7" />
      <path d="M17.7 5.5a9 9 0 0 1 0 13" />
    </svg>
  )
}

function IconLifebuoy({ className }: IconProps) {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"
         strokeLinecap="round" strokeLinejoin="round" className={className} aria-hidden>
      <circle cx="12" cy="12" r="9" />
      <circle cx="12" cy="12" r="4" />
      <path d="M5.6 5.6l3.6 3.6M18.4 5.6l-3.6 3.6M18.4 18.4l-3.6-3.6M5.6 18.4l3.6-3.6" />
    </svg>
  )
}

function IconHome({ className }: IconProps) {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"
         strokeLinecap="round" strokeLinejoin="round" className={className}>
      <path d="M3 11l9-8 9 8v10a2 2 0 0 1-2 2h-4v-7h-6v7H5a2 2 0 0 1-2-2z" />
    </svg>
  )
}
function IconUpload({ className }: IconProps) {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"
         strokeLinecap="round" strokeLinejoin="round" className={className}>
      <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4" />
      <path d="M17 8l-5-5-5 5" />
      <path d="M12 3v12" />
    </svg>
  )
}
function IconCog({ className }: IconProps) {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"
         strokeLinecap="round" strokeLinejoin="round" className={className}>
      <circle cx="12" cy="12" r="3" />
      <path d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 1 1-2.83 2.83l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 1 1-4 0v-.09a1.65 1.65 0 0 0-1-1.51 1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 1 1-2.83-2.83l.06-.06a1.65 1.65 0 0 0 .33-1.82 1.65 1.65 0 0 0-1.51-1H3a2 2 0 1 1 0-4h.09A1.65 1.65 0 0 0 4.6 9a1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 1 1 2.83-2.83l.06.06a1.65 1.65 0 0 0 1.82.33H9a1.65 1.65 0 0 0 1-1.51V3a2 2 0 1 1 4 0v.09a1.65 1.65 0 0 0 1 1.51 1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 1 1 2.83 2.83l-.06.06a1.65 1.65 0 0 0-.33 1.82V9a1.65 1.65 0 0 0 1.51 1H21a2 2 0 1 1 0 4h-.09a1.65 1.65 0 0 0-1.51 1z" />
    </svg>
  )
}
function IconChart({ className }: IconProps) {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"
         strokeLinecap="round" strokeLinejoin="round" className={className}>
      <path d="M3 3v18h18" />
      <path d="M7 14l4-4 4 4 6-6" />
    </svg>
  )
}
function IconSlider({ className }: IconProps) {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"
         strokeLinecap="round" strokeLinejoin="round" className={className}>
      <line x1="4" y1="21" x2="4" y2="14" />
      <line x1="4" y1="10" x2="4" y2="3" />
      <line x1="12" y1="21" x2="12" y2="12" />
      <line x1="12" y1="8" x2="12" y2="3" />
      <line x1="20" y1="21" x2="20" y2="16" />
      <line x1="20" y1="12" x2="20" y2="3" />
      <line x1="1" y1="14" x2="7" y2="14" />
      <line x1="9" y1="8" x2="15" y2="8" />
      <line x1="17" y1="16" x2="23" y2="16" />
    </svg>
  )
}
function IconSplit({ className }: IconProps) {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"
         strokeLinecap="round" strokeLinejoin="round" className={className}>
      <path d="M6 3v6l-4 4" />
      <path d="M18 3v6l4 4" />
      <path d="M12 3v18" />
    </svg>
  )
}
function IconSpark({ className }: IconProps) {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"
         strokeLinecap="round" strokeLinejoin="round" className={className}>
      <path d="M12 2v5" />
      <path d="M12 17v5" />
      <path d="M4.22 4.22l3.54 3.54" />
      <path d="M16.24 16.24l3.54 3.54" />
      <path d="M2 12h5" />
      <path d="M17 12h5" />
      <path d="M4.22 19.78l3.54-3.54" />
      <path d="M16.24 7.76l3.54-3.54" />
    </svg>
  )
}
function IconHistory({ className }: IconProps) {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"
         strokeLinecap="round" strokeLinejoin="round" className={className}>
      <path d="M3 12a9 9 0 1 0 3-6.7" />
      <polyline points="3 4 3 9 8 9" />
      <polyline points="12 7 12 12 15 14" />
    </svg>
  )
}
function IconStar({ className }: IconProps) {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"
         strokeLinecap="round" strokeLinejoin="round" className={className}>
      <polygon points="12 2 15.09 8.26 22 9.27 17 14.14 18.18 21.02 12 17.77 5.82 21.02 7 14.14 2 9.27 8.91 8.26 12 2" />
    </svg>
  )
}
