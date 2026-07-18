// src/pages/LandingPage.tsx
//
// Публичная главная — стиль referest.ru, цветовая схема royal blue
// (#2462EA). Header + Footer вынесены в PublicLayout — общие для всех
// публичных маршрутов.

import { Link } from 'react-router-dom'
import PublicLayout from '../components/PublicLayout'
import { useAuthStore } from '../features/auth/store'
import { cabPath } from '../shared/hostRouting'

export default function LandingPage() {
  const isAuthed = useAuthStore((s) => s.isAuthenticated())
  return (
    <PublicLayout>
      <Hero    isAuthed={isAuthed} />
      <QuickNav />
      <Benefits />
      <Audience />
      <PlansTeaser />
      <FinalCta isAuthed={isAuthed} />
    </PublicLayout>
  )
}

// ── Hero ───────────────────────────────────────────────────────────────

function Hero({ isAuthed }: { isAuthed: boolean }) {
  return (
    <section className="relative">
      <div className="mx-auto max-w-6xl px-5 lg:px-8 pt-16 pb-12 lg:pt-24 lg:pb-16">
        <div className="max-w-3xl">
          <h1 className="text-4xl md:text-5xl lg:text-6xl font-bold tracking-tight text-ink leading-[1.1]">
            Прогноз продаж SKU — точно и без data&nbsp;scientist
          </h1>
          <p className="mt-6 text-lg text-ink-muted max-w-2xl leading-relaxed">
            Платформа машинного обучения для розницы и e-commerce.
            Загружаете историю продаж — получаете прогнозы спроса по дням
            с метриками качества. Без аналитика и без своей ML-инфры.
          </p>

          <div className="mt-8 flex flex-wrap items-center gap-3">
            {isAuthed ? (
              <Link
                to={cabPath(cabPath('/app'))}
                className="inline-flex items-center px-6 py-3 rounded-lg bg-brand-500 text-white font-medium hover:bg-brand-600 transition-colors"
              >
                Открыть кабинет →
              </Link>
            ) : (
              <>
                <Link
                  to="/signup"
                  className="inline-flex items-center px-6 py-3 rounded-lg bg-brand-500 text-white font-medium hover:bg-brand-600 transition-colors"
                >
                  Начать бесплатно
                </Link>
                <Link
                  to="/login"
                  className="inline-flex items-center px-6 py-3 rounded-lg border border-ink/15 text-ink font-medium hover:border-ink/30 transition-colors"
                >
                  Войти
                </Link>
              </>
            )}
            <span className="ml-1 text-sm text-ink-muted">
              30 SKU на тарифе Free, без карты
            </span>
          </div>
        </div>
      </div>
    </section>
  )
}

// ── Quick nav (как «категории» на referest) ────────────────────────────

function QuickNav() {
  const pills = [
    'Точность 92%',
    'LightGBM + Chronos ensemble',
    'API + веб-кабинет',
    'Загрузка CSV / Excel',
    'P10 / P50 / P90 интервалы',
    'Учёт сезонности и праздников',
  ]
  return (
    <section className="border-t border-b border-ink/5 bg-surface/40">
      <div className="mx-auto max-w-6xl px-5 lg:px-8 py-5 flex flex-wrap gap-2">
        {pills.map((p) => (
          <span
            key={p}
            className="inline-flex items-center px-3 py-1.5 rounded-full bg-white border border-ink/10 text-xs text-ink-muted"
          >
            {p}
          </span>
        ))}
      </div>
    </section>
  )
}

// ── Benefits — «Чем полезен» ───────────────────────────────────────────

function Benefits() {
  const items = [
    {
      icon: '◎',
      title: 'Высокая точность',
      text: 'Ансамбль LightGBM + Chronos с учётом сезонности и календаря праздников. Метрики WMAPE / MASE / sMAPE в каждом прогнозе.',
    },
    {
      icon: '↗',
      title: 'Быстрый старт',
      text: 'От загрузки CSV до готового прогноза — 5 минут. Без настройки гиперпараметров, без своей ML-инфры, без сервера.',
    },
    {
      icon: '⌘',
      title: 'API и веб-кабинет',
      text: 'Интегрируйте в свой workflow через REST API или работайте через интерфейс. Прогнозы экспортируются в CSV / JSON.',
    },
  ]
  return (
    <section id="benefits" className="py-16 lg:py-24">
      <div className="mx-auto max-w-6xl px-5 lg:px-8">
        <div className="max-w-2xl mb-12">
          <p className="text-sm font-medium text-brand-500 uppercase tracking-wider mb-3">
            Возможности
          </p>
          <h2 className="text-3xl md:text-4xl font-bold text-ink leading-tight">
            Чем полезен Sprosly
          </h2>
        </div>
        <div className="grid md:grid-cols-3 gap-6 lg:gap-8">
          {items.map((b) => (
            <div
              key={b.title}
              className="p-7 rounded-2xl bg-surface/60 border border-ink/5 hover:border-ink/15 transition-colors"
            >
              <div className="h-12 w-12 rounded-xl bg-brand-500/10 grid place-items-center text-brand-500 text-2xl mb-5">
                {b.icon}
              </div>
              <h3 className="text-lg font-semibold text-ink mb-2">{b.title}</h3>
              <p className="text-sm text-ink-muted leading-relaxed">{b.text}</p>
            </div>
          ))}
        </div>
      </div>
    </section>
  )
}

// ── Audience — «Кому подходит» ─────────────────────────────────────────

function Audience() {
  const items = [
    {
      tag:   'Розница',
      title: 'Сетям магазинов',
      text:  'От 100 до 1 000 000 SKU. Прогнозы по магазинам и регионам для оптимизации закупок.',
    },
    {
      tag:   'E-commerce',
      title: 'Маркетплейсам и интернет-магазинам',
      text:  'Дневной прогноз спроса с учётом промо, акций и сезонности — для планирования остатков.',
    },
    {
      tag:   'B2B',
      title: 'Производству и опту',
      text:  'Прогноз отгрузок по контрагентам, планирование производства, снижение overstock.',
    },
  ]
  return (
    <section id="audience" className="py-16 lg:py-24 bg-surface/30 border-y border-ink/5">
      <div className="mx-auto max-w-6xl px-5 lg:px-8">
        <div className="max-w-2xl mb-12">
          <p className="text-sm font-medium text-brand-500 uppercase tracking-wider mb-3">
            Для кого
          </p>
          <h2 className="text-3xl md:text-4xl font-bold text-ink leading-tight">
            Кому подходит
          </h2>
        </div>
        <div className="grid md:grid-cols-3 gap-6 lg:gap-8">
          {items.map((a) => (
            <div
              key={a.title}
              className="p-7 rounded-2xl bg-white border border-ink/10"
            >
              <span className="inline-flex items-center px-2.5 py-1 rounded-full bg-brand-500/10 text-brand-700 text-xs font-medium mb-4">
                {a.tag}
              </span>
              <h3 className="text-lg font-semibold text-ink mb-2">{a.title}</h3>
              <p className="text-sm text-ink-muted leading-relaxed">{a.text}</p>
            </div>
          ))}
        </div>
      </div>
    </section>
  )
}

// ── Plans teaser ───────────────────────────────────────────────────────

function PlansTeaser() {
  const plans = [
    { name: 'Free',     skus: 30,   horizon: '7 дней',  badge: 'Старт',    featured: false },
    { name: 'Start',    skus: 1500, horizon: '30 дней', badge: 'Бизнес',   featured: true  },
    { name: 'Business', skus: '∞',  horizon: '90 дней', badge: 'Корпорат', featured: false },
  ]
  return (
    <section className="py-16 lg:py-24">
      <div className="mx-auto max-w-6xl px-5 lg:px-8">
        <div className="max-w-2xl mb-12">
          <p className="text-sm font-medium text-brand-500 uppercase tracking-wider mb-3">
            Тарифы
          </p>
          <h2 className="text-3xl md:text-4xl font-bold text-ink leading-tight">
            Три тарифа, без скрытых платежей
          </h2>
        </div>
        <div className="grid md:grid-cols-3 gap-6">
          {plans.map((p) => (
            <div
              key={p.name}
              className={[
                'p-7 rounded-2xl border transition-colors',
                p.featured
                  ? 'bg-brand-500 text-white border-brand-500'
                  : 'bg-white border-ink/10 hover:border-ink/20',
              ].join(' ')}
            >
              <div className="flex items-baseline justify-between mb-6">
                <h3 className={`text-xl font-bold ${p.featured ? 'text-white' : 'text-ink'}`}>
                  {p.name}
                </h3>
                <span
                  className={[
                    'text-xs px-2 py-1 rounded-full font-medium',
                    p.featured ? 'bg-white/20 text-white' : 'bg-brand-500/10 text-brand-700',
                  ].join(' ')}
                >
                  {p.badge}
                </span>
              </div>
              <dl className="space-y-2.5 text-sm">
                <div className="flex items-center justify-between">
                  <dt className={p.featured ? 'text-white/70' : 'text-ink-muted'}>SKU</dt>
                  <dd className={p.featured ? 'text-white font-medium' : 'text-ink font-medium'}>{p.skus}</dd>
                </div>
                <div className="flex items-center justify-between">
                  <dt className={p.featured ? 'text-white/70' : 'text-ink-muted'}>Горизонт</dt>
                  <dd className={p.featured ? 'text-white font-medium' : 'text-ink font-medium'}>{p.horizon}</dd>
                </div>
              </dl>
            </div>
          ))}
        </div>
        <div className="mt-8">
          <Link
            to="/plans"
            className="inline-flex items-center text-sm text-brand-500 font-medium hover:text-brand-700 transition-colors"
          >
            Подробное сравнение тарифов →
          </Link>
        </div>
      </div>
    </section>
  )
}

// ── Final CTA ──────────────────────────────────────────────────────────

function FinalCta({ isAuthed }: { isAuthed: boolean }) {
  return (
    <section className="py-16 lg:py-24 bg-surface/30 border-t border-ink/5">
      <div className="mx-auto max-w-4xl px-5 lg:px-8 text-center">
        <h2 className="text-3xl md:text-4xl font-bold text-ink leading-tight">
          Готовы перестать прогнозировать вручную?
        </h2>
        <p className="mt-4 text-lg text-ink-muted">
          30 SKU бесплатно навсегда — оцените качество прогнозов на ваших данных без обязательств.
        </p>
        <div className="mt-8 flex flex-wrap items-center justify-center gap-3">
          {isAuthed ? (
            <Link
              to={cabPath(cabPath('/app'))}
              className="inline-flex items-center px-6 py-3 rounded-lg bg-brand-500 text-white font-medium hover:bg-brand-600 transition-colors"
            >
              Открыть кабинет →
            </Link>
          ) : (
            <Link
              to="/signup"
              className="inline-flex items-center px-6 py-3 rounded-lg bg-brand-500 text-white font-medium hover:bg-brand-600 transition-colors"
            >
              Начать бесплатно
            </Link>
          )}
        </div>
      </div>
    </section>
  )
}
