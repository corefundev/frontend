// src/pages/PlansPage.tsx
//
// Публичные тарифы — referest.ru стиль, общий PublicLayout
// (header + footer). Три тарифа карточками; затем сравнительная
// таблица всех лимитов из /plans API.

import type { ReactNode } from 'react'
import { useQuery } from '@tanstack/react-query'
import { Link } from 'react-router-dom'

import { plansApi, type PlanSpec } from '../features/plans/api'
import { useAuthStore } from '../features/auth/store'
import PublicLayout from '../components/PublicLayout'
import { cabPath } from '../shared/hostRouting'

interface PlanCopy {
  tag:      string
  title:    string
  promise:  string
  body:     string
  cta:      string
  featured?: boolean
}

const COPY: Record<'free' | 'start' | 'business', PlanCopy> = {
  free: {
    tag:     'Старт',
    title:   'Free',
    promise: 'Точный прогноз за 5 минут',
    body:    'Загрузите CSV — получите прогноз по 30 позициям на неделю. Без карты, без обязательств.',
    cta:     'Начать бесплатно',
  },
  start: {
    tag:     'Бизнес',
    title:   'Start',
    promise: 'Модель слышит ваш бизнес',
    body:    'Расскажите модели про ваши праздники, промо и сезонность. До 1 500 SKU, горизонт 30 дней.',
    cta:     'Попробовать Start',
    featured: true,
  },
  business: {
    tag:     'Корпоратив',
    title:   'Business',
    promise: 'Прогноз × стратегия',
    body:    'Безлимит SKU, горизонт 90 дней, промо-планирование, сценарии, интеграции с 1С и API.',
    cta:     'Связаться для Business',
  },
}

export default function PlansPage() {
  const isAuthed = useAuthStore((s) => s.isAuthenticated())

  const { data: plans = [], isLoading } = useQuery({
    queryKey: ['plans'],
    queryFn:  () => plansApi.list(),
    staleTime: 5 * 60_000,
  })

  return (
    <PublicLayout>
      <Hero />
      {isLoading ? (
        <PlansSkeleton />
      ) : (
        <>
          <PlanCards plans={plans} isAuthed={isAuthed} />
          <PlanCompare plans={plans} />
        </>
      )}
      <FaqStrip />
    </PublicLayout>
  )
}

// ── Hero ───────────────────────────────────────────────────────────────

function Hero() {
  return (
    <section>
      <div className="mx-auto max-w-6xl px-5 lg:px-8 pt-16 pb-10 lg:pt-24 lg:pb-12">
        <div className="max-w-3xl">
          <p className="text-sm font-medium text-brand-500 uppercase tracking-wider mb-3">
            Тарифы
          </p>
          <h1 className="text-4xl md:text-5xl lg:text-6xl font-bold tracking-tight text-ink leading-[1.1]">
            Три тарифа,&nbsp;без скрытых платежей
          </h1>
          <p className="mt-6 text-lg text-ink-muted max-w-2xl leading-relaxed">
            Начните с Free — 30 SKU навсегда. Платите только когда модели приносят
            бизнесу пользу.
          </p>
        </div>
      </div>
    </section>
  )
}

// ── Plan cards (3-up) ─────────────────────────────────────────────────

function PlanCards({ plans, isAuthed }: { plans: PlanSpec[]; isAuthed: boolean }) {
  // Order ensures featured (start) lands in the middle column.
  const ordered = ['free', 'start', 'business']
    .map((id) => plans.find((p) => p.id === id))
    .filter((p): p is PlanSpec => !!p)

  return (
    <section className="pb-12 lg:pb-16">
      <div className="mx-auto max-w-6xl px-5 lg:px-8">
        <div className="grid md:grid-cols-3 gap-6">
          {ordered.map((p) => {
            const copy = COPY[p.id as 'free' | 'start' | 'business']
            const featured = copy?.featured
            return (
              <div
                key={p.id}
                className={[
                  'p-7 rounded-2xl border transition-colors',
                  featured
                    ? 'bg-brand-500 text-white border-brand-500 lg:scale-[1.02]'
                    : 'bg-white border-ink/10 hover:border-ink/20',
                ].join(' ')}
              >
                <div className="flex items-baseline justify-between mb-1">
                  <h2 className={`text-2xl font-bold ${featured ? 'text-white' : 'text-ink'}`}>
                    {copy?.title || p.display_name}
                  </h2>
                  <span
                    className={[
                      'text-xs px-2.5 py-1 rounded-full font-medium',
                      featured ? 'bg-white/20 text-white' : 'bg-brand-500/10 text-brand-700',
                    ].join(' ')}
                  >
                    {copy?.tag || p.id}
                  </span>
                </div>
                <p
                  className={[
                    'text-sm mb-4',
                    featured ? 'text-white/80' : 'text-ink-muted',
                  ].join(' ')}
                >
                  {copy?.promise}
                </p>
                <p
                  className={[
                    'text-sm leading-relaxed mb-6',
                    featured ? 'text-white/90' : 'text-ink-muted',
                  ].join(' ')}
                >
                  {copy?.body}
                </p>

                <dl className="space-y-2 text-sm mb-7">
                  <Row
                    label="SKU"
                    value={p.max_skus === null ? '∞' : String(p.max_skus)}
                    dark={!!featured}
                  />
                  <Row
                    label="Горизонт"
                    value={p.max_horizon_days === null ? '∞' : `${p.max_horizon_days} дней`}
                    dark={!!featured}
                  />
                  <Row
                    label="Кулдаун обучения"
                    value={p.training_cooldown_hours === null ? 'нет' : `${p.training_cooldown_hours} ч`}
                    dark={!!featured}
                  />
                </dl>

                {p.id === 'business' ? (
                  <a
                    href="mailto:dochub.org@gmail.com?subject=SKU%20Forecasting%20Business"
                    className={[
                      'inline-flex items-center justify-center w-full px-4 py-2.5 rounded-lg font-medium transition-colors',
                      featured
                        ? 'bg-white text-brand-700 hover:bg-white/90'
                        : 'bg-brand-500 text-white hover:bg-brand-600',
                    ].join(' ')}
                  >
                    {copy?.cta}
                  </a>
                ) : (
                  <Link
                    to={isAuthed ? cabPath('/app/upgrade') : '/signup'}
                    className={[
                      'inline-flex items-center justify-center w-full px-4 py-2.5 rounded-lg font-medium transition-colors',
                      featured
                        ? 'bg-white text-brand-700 hover:bg-white/90'
                        : 'bg-brand-500 text-white hover:bg-brand-600',
                    ].join(' ')}
                  >
                    {copy?.cta}
                  </Link>
                )}
              </div>
            )
          })}
        </div>
      </div>
    </section>
  )
}

function Row({ label, value, dark }: { label: string; value: string; dark: boolean }) {
  return (
    <div className="flex items-center justify-between">
      <dt className={dark ? 'text-white/70' : 'text-ink-muted'}>{label}</dt>
      <dd className={dark ? 'text-white font-medium' : 'text-ink font-medium'}>{value}</dd>
    </div>
  )
}

// ── Detailed comparison table ─────────────────────────────────────────

function PlanCompare({ plans }: { plans: PlanSpec[] }) {
  const ordered = ['free', 'start', 'business']
    .map((id) => plans.find((p) => p.id === id))
    .filter((p): p is PlanSpec => !!p)

  const rows: { label: string; render: (p: PlanSpec) => ReactNode }[] = [
    { label: 'Максимум SKU',           render: (p) => (p.max_skus       === null ? '∞' : p.max_skus) },
    { label: 'Горизонт прогноза',      render: (p) => (p.max_horizon_days === null ? '∞' : `${p.max_horizon_days} дней`) },
    { label: 'Кулдаун между обучениями', render: (p) => (p.training_cooldown_hours === null ? 'нет' : `${p.training_cooldown_hours} ч`) },
    { label: 'Параллельные обучения',    render: () => '1 — новое после завершения текущего' },
    { label: 'Модель',                 render: (p) => p.model_display_name },
  ]

  return (
    <section className="py-12 lg:py-16 bg-surface/30 border-y border-ink/5">
      <div className="mx-auto max-w-6xl px-5 lg:px-8">
        <h2 className="text-2xl md:text-3xl font-bold text-ink mb-8">
          Что входит в каждый тариф
        </h2>
        <div className="overflow-x-auto -mx-5 px-5 lg:mx-0 lg:px-0">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-ink/10">
                <th className="text-left py-3 pr-4 text-ink-muted font-medium uppercase tracking-wider text-xs">
                  Возможность
                </th>
                {ordered.map((p) => (
                  <th key={p.id} className="text-left py-3 px-4 text-ink font-semibold">
                    {p.display_name}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {rows.map((r) => (
                <tr key={r.label} className="border-b border-ink/5">
                  <td className="py-3 pr-4 text-ink-muted">{r.label}</td>
                  {ordered.map((p) => (
                    <td key={p.id} className="py-3 px-4 text-ink font-medium">
                      {r.render(p)}
                    </td>
                  ))}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </section>
  )
}

// ── FAQ strip ──────────────────────────────────────────────────────────

function FaqStrip() {
  const items = [
    {
      q: 'Можно начать без оплаты?',
      a: 'Да — Free навсегда. 30 SKU, 7 дней горизонт, без карты. Перейти на Start можно в любой момент.',
    },
    {
      q: 'Что считается одним SKU?',
      a: 'Любая уникальная позиция, для которой строится прогноз. Если у вас 3 склада × 100 товаров — это 300 SKU.',
    },
    {
      q: 'Можно ли отказаться от подписки?',
      a: 'Да, в любой момент. После отмены тариф вернётся к Free, доступ к историческим прогнозам сохранится.',
    },
  ]
  return (
    <section className="py-16 lg:py-24">
      <div className="mx-auto max-w-4xl px-5 lg:px-8">
        <h2 className="text-2xl md:text-3xl font-bold text-ink mb-8">
          Частые вопросы
        </h2>
        <div className="space-y-4">
          {items.map((it) => (
            <details
              key={it.q}
              className="group p-5 rounded-xl bg-surface/40 border border-ink/5 hover:border-ink/15 transition-colors"
            >
              <summary className="cursor-pointer list-none flex items-center justify-between text-ink font-medium">
                <span>{it.q}</span>
                <span className="text-brand-500 text-xl transition-transform group-open:rotate-45">+</span>
              </summary>
              <p className="mt-3 text-sm text-ink-muted leading-relaxed">{it.a}</p>
            </details>
          ))}
        </div>
      </div>
    </section>
  )
}

// ── Skeleton ───────────────────────────────────────────────────────────

function PlansSkeleton() {
  return (
    <section className="pb-12">
      <div className="mx-auto max-w-6xl px-5 lg:px-8">
        <div className="grid md:grid-cols-3 gap-6 animate-pulse">
          {[1, 2, 3].map((i) => (
            <div key={i} className="h-72 rounded-2xl bg-surface/60 border border-ink/5" />
          ))}
        </div>
      </div>
    </section>
  )
}
