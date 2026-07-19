// src/pages/PlansPage.tsx
//
// Публичные тарифы — порт утверждённого прототипа v3.3 (композиция
// dropship.io/pricing, наши токены): зелёная строка экономии над
// центрированным переключателем месяц/год, три карточки (featured
// Start), сравнение БЕЗ внешнего контура со sticky-шапкой (A1 = блок
// переключателя; в колонках — имя, цена периода, мини-CTA), столбец
// Start подкрашен от шапки до низа со скруглениями, группы —
// бесцветные строки с SVG-шевроном. Числовые лимиты — из /plans API.

import { useState, type ReactNode } from 'react'
import { useQuery } from '@tanstack/react-query'
import { Link } from 'react-router-dom'

import { plansApi, type PlanSpec } from '../features/plans/api'
import { useAuthStore } from '../features/auth/store'
import PublicLayout from '../components/PublicLayout'
import { cabPath } from '../shared/hostRouting'

type Billing = 'monthly' | 'yearly'

// Цены пока не приходят из API (эквайринга нет). Годовая = −20%
// (решение владельца 2026-07-19; Business 6 900 ₽ — 2026-07-20).
const PRICING = {
  start:    { monthly: 2_900, yearlyPerMonth: 2_320, yearlyTotal: 27_840 },
  business: { monthly: 6_900, yearlyPerMonth: 5_520, yearlyTotal: 66_240 },
} as const

// PublicLayout: sticky-шапка сайта h-16 + 1px border → отступ для
// sticky-шапки таблицы.
const STICKY_TOP = 'top-[65px]'

const fmt = (n: number) => n.toLocaleString('ru-RU')

export default function PlansPage() {
  const isAuthed = useAuthStore((s) => s.isAuthenticated())
  const [billing, setBilling] = useState<Billing>('yearly')

  const { data: plans = [], isLoading } = useQuery({
    queryKey: ['plans'],
    queryFn:  () => plansApi.list(),
    staleTime: 5 * 60_000,
  })

  const byId = (id: string) => plans.find((p) => p.id === id)
  const signupTo = isAuthed ? cabPath('/app/upgrade') : '/signup'

  return (
    <PublicLayout>
      <Hero billing={billing} onBilling={setBilling} />
      {isLoading ? (
        <PlansSkeleton />
      ) : (
        <>
          <PlanCards plans={plans} signupTo={signupTo} billing={billing} />
          <PlanCompare
            free={byId('free')} start={byId('start')} business={byId('business')}
            billing={billing} onBilling={setBilling} signupTo={signupTo}
          />
        </>
      )}
      <FaqStrip />
    </PublicLayout>
  )
}

// ── Billing toggle (hero + A1 таблицы) ────────────────────────────────

function BillingToggle({
  billing, onBilling, compact,
}: { billing: Billing; onBilling: (b: Billing) => void; compact?: boolean }) {
  const btn = (mode: Billing, label: string) => (
    <button
      type="button"
      onClick={() => onBilling(mode)}
      className={[
        compact ? 'px-3.5 py-1.5 text-[13px]' : 'px-5 py-2 text-sm',
        'rounded-[10px] font-semibold transition-all',
        billing === mode
          ? 'bg-white text-ink shadow-[0_1px_4px_rgba(15,23,42,0.14)]'
          : 'text-ink-muted hover:text-ink',
      ].join(' ')}
    >
      {label}
    </button>
  )
  return (
    <div className={[
      'flex flex-col gap-3',
      compact ? 'items-start' : 'items-center',
    ].join(' ')}>
      <span className={[
        'font-semibold text-emerald-700',
        compact ? 'text-[13px]' : 'text-[15px]',
      ].join(' ')}>
        Экономьте 20% при годовой оплате
      </span>
      <div className="inline-flex gap-0.5 rounded-[14px] border border-ink/10 bg-surface p-1">
        {btn('yearly', 'Оплата за год')}
        {btn('monthly', 'Оплата за месяц')}
      </div>
    </div>
  )
}

// ── Hero ──────────────────────────────────────────────────────────────

function Hero({ billing, onBilling }: { billing: Billing; onBilling: (b: Billing) => void }) {
  return (
    <section>
      <div className="mx-auto max-w-6xl px-5 lg:px-8 pt-16 pb-2 lg:pt-24 text-center">
        <h1 className="text-4xl md:text-5xl font-bold tracking-tight text-ink leading-[1.1]">
          Тарифы Sprosly
        </h1>
        <p className="mt-5 mx-auto max-w-xl text-lg text-ink-muted leading-relaxed">
          Начните с Free — 30 SKU навсегда, без карты. Обновляйтесь, когда прогнозы
          начнут приносить деньги: смена тарифа применяется мгновенно.
        </p>
        <div className="mt-9 flex justify-center">
          <BillingToggle billing={billing} onBilling={onBilling} />
        </div>
      </div>
    </section>
  )
}

// ── Plan cards ────────────────────────────────────────────────────────

function Tick({ featured }: { featured?: boolean }) {
  return (
    <span
      className={[
        'mt-0.5 inline-flex h-5 w-5 flex-none items-center justify-center rounded-full text-[11px] font-bold',
        featured ? 'bg-brand-500/10 text-brand-600' : 'bg-emerald-50 text-emerald-600',
      ].join(' ')}
    >
      ✓
    </span>
  )
}

function Feature({ children, featured }: { children: ReactNode; featured?: boolean }) {
  return (
    <li className="flex items-start gap-2.5 text-sm text-ink leading-relaxed">
      <Tick featured={featured} />
      <span>{children}</span>
    </li>
  )
}

function PriceLine({ big, per, note }: { big: string; per?: string; note: string }) {
  return (
    <div className="mt-5">
      <div className="flex items-baseline gap-1.5">
        <span className="text-4xl font-bold tracking-tight text-ink">{big}</span>
        {per && <span className="text-sm text-ink-muted">{per}</span>}
      </div>
      <p className="mt-1.5 min-h-[18px] text-[13px] text-ink-faint">{note}</p>
    </div>
  )
}

function paidPrice(plan: 'start' | 'business', billing: Billing) {
  const p = PRICING[plan]
  return {
    big: billing === 'yearly' ? `${fmt(p.yearlyPerMonth)} ₽` : `${fmt(p.monthly)} ₽`,
    note: billing === 'yearly'
      ? `оплачивается ${fmt(p.yearlyTotal)} ₽ раз в год`
      : 'при оплате помесячно',
  }
}

function PlanCards({
  plans, signupTo, billing,
}: { plans: PlanSpec[]; signupTo: string; billing: Billing }) {
  const free = plans.find((p) => p.id === 'free')
  const start = plans.find((p) => p.id === 'start')
  const business = plans.find((p) => p.id === 'business')

  const primaryCta =
    'mt-6 inline-flex w-full items-center justify-center rounded-lg bg-brand-500 px-4 py-3 font-semibold text-white transition-colors hover:bg-brand-600'
  const ghostCta =
    'mt-6 inline-flex w-full items-center justify-center rounded-lg border-[1.5px] border-brand-500 bg-white px-4 py-3 font-semibold text-brand-600 transition-colors hover:bg-brand-500/5'

  const sp = paidPrice('start', billing)
  const bp = paidPrice('business', billing)

  return (
    <section className="pb-14 lg:pb-20 pt-9">
      <div className="mx-auto max-w-6xl px-5 lg:px-8">
        <div className="grid md:grid-cols-3 gap-6 items-stretch">
          <div className="relative flex flex-col rounded-2xl border border-ink/10 bg-white p-7 shadow-sm">
            <h2 className="text-xl font-bold text-ink">Free</h2>
            <PriceLine big="0 ₽" per="навсегда" note="без карты и ограничения по времени" />
            <Link to={signupTo} className={ghostCta}>Начать бесплатно</Link>
            <div className="my-6 h-px bg-ink/10" />
            <ul className="space-y-3">
              <Feature>до {free?.max_skus ?? 30} SKU</Feature>
              <Feature>горизонт прогноза {free?.max_horizon_days ?? 7} дней</Feature>
              <Feature>{free?.datasets_limit ?? 1} датасет с автоподготовкой данных</Feature>
              <Feature>интервалы P10 / P50 / P90</Feature>
              <Feature>точность для заказа и разброс по SKU</Feature>
              <Feature>обучение в 1 клик (пауза {free?.training_cooldown_hours ?? 12} ч)</Feature>
            </ul>
          </div>

          <div className="relative flex flex-col rounded-2xl border-2 border-brand-500 bg-white p-7 shadow-[0_12px_40px_rgba(36,99,235,0.12)]">
            <span className="absolute -top-3.5 left-1/2 -translate-x-1/2 whitespace-nowrap rounded-full bg-brand-500 px-4 py-1 text-xs font-bold text-white">
              Самый популярный
            </span>
            <h2 className="text-xl font-bold text-ink">Start</h2>
            <PriceLine big={sp.big} per="/мес" note={sp.note} />
            <Link to={signupTo} className={primaryCta}>Выбрать Start</Link>
            <div className="my-6 h-px bg-ink/10" />
            <ul className="space-y-3">
              <Feature featured>до {fmt(start?.max_skus ?? 1500)} SKU</Feature>
              <Feature featured>горизонт прогноза {start?.max_horizon_days ?? 14} дней</Feature>
              <Feature featured>{start?.datasets_limit ?? 3} датасета, обучения без месячных лимитов</Feature>
              <Feature featured>ансамблевая модель + подбор гиперпараметров</Feature>
              <Feature featured>валютные курсы ЦБ для закупок в валюте</Feature>
              <Feature featured>частичная тонкая настройка модели</Feature>
            </ul>
          </div>

          <div className="relative flex flex-col rounded-2xl border border-ink/10 bg-white p-7 shadow-sm">
            <h2 className="text-xl font-bold text-ink">Business</h2>
            <PriceLine big={bp.big} per="/мес" note={bp.note} />
            <Link to={signupTo} className={ghostCta}>Выбрать Business</Link>
            <div className="my-6 h-px bg-ink/10" />
            <ul className="space-y-3">
              <Feature>SKU без ограничений</Feature>
              <Feature>горизонт прогноза {business?.max_horizon_days ?? 28} дней</Feature>
              <Feature>{business?.datasets_limit ?? 10} датасетов, полный подбор гиперпараметров</Feature>
              <Feature>сценарии what-if и промо-планирование</Feature>
              <Feature>полная настройка модели под бизнес</Feature>
              <Feature>приоритетная поддержка</Feature>
            </ul>
          </div>
        </div>
      </div>
    </section>
  )
}

// ── Grouped comparison (sticky header + tinted Start column) ──────────

function Chevron() {
  return (
    <svg
      width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor"
      strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"
      className="text-ink-faint transition-transform group-open:rotate-180"
    >
      <polyline points="6 9 12 15 18 9" />
    </svg>
  )
}

const GRID = 'grid grid-cols-[2.1fr_1fr_1fr_1fr]'
// Геометрия подкраски Start: колонка 3.1/5.1 … 4.1/5.1 сетки.
const TINT_POS = 'left-[calc(100%*3.1/5.1)] w-[calc(100%/5.1)]'

const num = (v: number | null | undefined, suffix = '') =>
  v === null ? 'без лимита' : v === undefined ? '—' : `${fmt(v)}${suffix}`

function PlanCompare({
  free, start, business, billing, onBilling, signupTo,
}: {
  free?: PlanSpec; start?: PlanSpec; business?: PlanSpec
  billing: Billing; onBilling: (b: Billing) => void; signupTo: string
}) {
  const check = <Tick />
  const dash = <span className="text-ink/20">—</span>
  const sp = paidPrice('start', billing)
  const bp = paidPrice('business', billing)

  const groups: {
    title: string
    rows: { t: string; d?: string; v: [ReactNode, ReactNode, ReactNode]; strong?: boolean }[]
  }[] = [
    {
      title: 'Прогнозирование',
      rows: [
        { t: 'Горизонт прогноза', d: 'на сколько дней вперёд строится прогноз', strong: true,
          v: [num(free?.max_horizon_days, ' дней'), num(start?.max_horizon_days, ' дней'), num(business?.max_horizon_days, ' дней')] },
        { t: 'Окна суммы заказа', d: 'готовые суммы под цикл закупки',
          v: ['1 / 7', '1 / 7 / 14', '1 / 7 / 14 / 28'] },
        { t: 'Интервалы неопределённости', d: 'P10 / P50 / P90 по каждому SKU и дню',
          v: [check, check, check] },
        { t: 'Точность для заказа', d: 'метрика качества на сумме окна заказа',
          v: [check, check, check] },
        { t: 'Разброс по товарам', d: 'медиана и слабые 10% — ничего не прячется за средним',
          v: [check, check, check] },
      ],
    },
    {
      title: 'Данные',
      rows: [
        { t: 'Максимум SKU', strong: true,
          v: [num(free?.max_skus), num(start?.max_skus), num(business?.max_skus)] },
        { t: 'Датасеты', d: 'независимые наборы данных, у каждого — своя модель',
          v: [num(free?.datasets_limit), num(start?.datasets_limit), num(business?.datasets_limit)] },
        { t: 'Автоподготовка данных', d: 'CSV/XLSX из 1С и маркетплейсов — колонки распознаются сами',
          v: [check, check, check] },
        { t: 'Категории товаров', d: 'модель использует товарные группы из ваших данных',
          v: [check, check, check] },
      ],
    },
    {
      title: 'Обучение моделей',
      rows: [
        { t: 'Модель', v: ['базовая', 'ансамбль', 'ансамбль + роутинг'] },
        { t: 'Подбор гиперпараметров', d: 'автотюнинг под ваши данные при каждом обучении',
          v: [dash, 'короткий', 'полный'] },
        { t: 'Пауза между обучениями',
          v: [free?.training_cooldown_hours ? `${free.training_cooldown_hours} ч` : 'нет', 'нет', 'нет'] },
        { t: 'Месячные лимиты обучений', v: ['нет', 'нет', 'нет'] },
        { t: 'Тонкая настройка модели', d: 'управление признаками и параметрами обучения',
          v: [dash, 'частичная', 'полная'] },
      ],
    },
    {
      title: 'Возможности',
      rows: [
        { t: 'Валютные курсы ЦБ', d: 'CNY / USD / EUR / BYN / KZT для валютных закупок',
          v: [dash, check, check] },
        { t: 'Сценарии what-if', d: 'что будет с прогнозом при смене цены или промо',
          v: [dash, dash, check] },
        { t: 'Промо-планирование', v: [dash, dash, check] },
      ],
    },
    {
      title: 'API и интеграции',
      rows: [
        { t: 'REST API + документация', v: [check, check, check] },
        { t: 'Запросы прогнозов', d: 'лимит обращений к API в час',
          v: ['100/ч', '5 000/ч', 'без лимита'] },
        { t: 'Выгрузка заказа в CSV для 1С', v: [check, check, check] },
      ],
    },
    {
      title: 'Поддержка',
      rows: [
        { t: 'База знаний и email-поддержка', v: [check, check, check] },
        { t: 'Приоритетная поддержка', v: [dash, dash, check] },
      ],
    },
  ]

  const miniPrimary =
    'rounded-lg bg-brand-500 px-5 py-2 text-[13px] font-semibold text-white transition-colors hover:bg-brand-600'
  const miniGhost =
    'rounded-lg border-[1.5px] border-brand-500 bg-white px-5 py-2 text-[13px] font-semibold text-brand-600 transition-colors hover:bg-brand-500/5'

  return (
    <section className="pb-16 lg:pb-24">
      <div className="mx-auto max-w-6xl px-5 lg:px-8">
        <h2 className="mb-9 text-center text-2xl md:text-3xl font-bold tracking-tight text-ink">
          Полное сравнение тарифов
        </h2>

        <div className="overflow-x-auto -mx-5 px-5 lg:mx-0 lg:px-0">
          <div className="relative min-w-[760px]">
            {/* sticky-шапка: A1 = блок переключателя; Start подкрашен */}
            <div className={`${GRID} sticky ${STICKY_TOP} z-10 border-b border-ink/10 bg-white`}>
              <div className="px-4 pb-4 pt-3.5">
                <BillingToggle billing={billing} onBilling={onBilling} compact />
              </div>
              <HeadCell name="Free" price="0 ₽ — навсегда, без карты">
                <Link to={signupTo} className={miniGhost}>Начать</Link>
              </HeadCell>
              <HeadCell name="Start" price={`${sp.big}/мес, ${billing === 'yearly' ? `при годовой — ${fmt(PRICING.start.yearlyTotal)} ₽/год` : 'помесячно'}`} tinted>
                <Link to={signupTo} className={miniPrimary}>Выбрать</Link>
              </HeadCell>
              <HeadCell name="Business" price={`${bp.big}/мес, ${billing === 'yearly' ? `при годовой — ${fmt(PRICING.business.yearlyTotal)} ₽/год` : 'помесячно'}`}>
                <Link to={signupTo} className={miniGhost}>Выбрать</Link>
              </HeadCell>
            </div>

            {/* тело: сплошная подкраска Start до низа, скругление снизу */}
            <div className="relative">
              <div
                aria-hidden
                className={`pointer-events-none absolute inset-y-0 ${TINT_POS} rounded-b-2xl bg-brand-500/[0.04]`}
              />
              {groups.map((g) => (
                <details key={g.title} open className="group">
                  <summary className="flex cursor-pointer list-none items-center justify-between px-4 py-4 text-base font-bold text-ink">
                    {g.title}
                    <Chevron />
                  </summary>
                  {g.rows.map((r) => (
                    <div key={r.t} className={`${GRID} border-b border-ink/5`}>
                      <div className="px-4 py-3.5">
                        <div className="text-sm font-medium text-ink">{r.t}</div>
                        {r.d && <div className="mt-0.5 text-xs text-ink-faint leading-relaxed">{r.d}</div>}
                      </div>
                      {r.v.map((v, i) => (
                        <div
                          key={i}
                          className={[
                            'flex items-center justify-center px-4 py-3.5 text-sm',
                            r.strong ? 'font-semibold text-ink' : 'text-ink-muted',
                          ].join(' ')}
                        >
                          {v}
                        </div>
                      ))}
                    </div>
                  ))}
                </details>
              ))}
            </div>
          </div>
        </div>
      </div>
    </section>
  )
}

function HeadCell({
  name, price, tinted, children,
}: { name: string; price: string; tinted?: boolean; children: ReactNode }) {
  return (
    <div
      className={[
        'flex flex-col items-center gap-2 px-4 pb-4 pt-3.5 text-center',
        tinted ? 'rounded-t-2xl bg-brand-500/[0.04]' : '',
      ].join(' ')}
    >
      <div className="text-lg font-bold text-ink">{name}</div>
      <div className="min-h-[36px] text-[12.5px] leading-normal text-ink-muted">{price}</div>
      {children}
    </div>
  )
}

// ── FAQ ───────────────────────────────────────────────────────────────

function FaqStrip() {
  const items = [
    {
      q: 'Free — это навсегда?',
      a: 'Да. 30 SKU, горизонт 7 дней, без карты и без ограничения по времени. Перейти на платный тариф можно в любой момент — смена применяется мгновенно.',
    },
    {
      q: 'Чем отличается годовая оплата?',
      a: 'При годовой оплате цена месяца ниже на 20%, платёж — один раз в год. Перейти с месячной на годовую можно в любой момент.',
    },
    {
      q: 'Что считается одним SKU?',
      a: 'Любая уникальная позиция, для которой строится прогноз. 3 склада × 100 товаров = 300 SKU.',
    },
    {
      q: 'Что произойдёт при смене тарифа?',
      a: 'Лимиты нового тарифа применяются сразу; модель не пересчитывается — следующее обучение пройдёт уже по новому тарифу.',
    },
    {
      q: 'Как вы считаете точность?',
      a: 'Методика v2: оценка покрывает 100% дней окна, метрика — на сумме окна заказа. Подробности — в статье «Методика оценки точности» в Базе знаний.',
    },
  ]
  return (
    <section className="pb-16 lg:pb-24">
      <div className="mx-auto max-w-3xl px-5 lg:px-8">
        <h2 className="mb-8 text-center text-2xl md:text-3xl font-bold tracking-tight text-ink">
          Частые вопросы
        </h2>
        <div className="space-y-3.5">
          {items.map((it, i) => (
            <details
              key={it.q}
              open={i === 0}
              className="group rounded-xl border border-ink/10 bg-white p-5 transition-colors hover:border-ink/20"
            >
              <summary className="flex cursor-pointer list-none items-center justify-between font-semibold text-ink">
                <span>{it.q}</span>
                <span className="text-brand-500 text-xl transition-transform group-open:rotate-45">+</span>
              </summary>
              <p className="mt-3 text-sm text-ink-muted leading-relaxed">{it.a}</p>
            </details>
          ))}
        </div>
        <p className="mt-8 text-center text-xs text-ink-faint">
          Оплата картой появится с подключением эквайринга — до этого апгрейд бесплатный.
        </p>
      </div>
    </section>
  )
}

// ── Skeleton ───────────────────────────────────────────────────────────

function PlansSkeleton() {
  return (
    <section className="pb-12 pt-9">
      <div className="mx-auto max-w-6xl px-5 lg:px-8">
        <div className="grid md:grid-cols-3 gap-6 animate-pulse">
          {[1, 2, 3].map((i) => (
            <div key={i} className="h-96 rounded-2xl bg-surface/60 border border-ink/5" />
          ))}
        </div>
      </div>
    </section>
  )
}
