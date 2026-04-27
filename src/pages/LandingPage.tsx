import { Link } from 'react-router-dom'

import { useAuthStore } from '../features/auth/store'

// ─────────────────────────────────────────────────────────────────────────
//  LandingPage — публичная главная.
//
//  Эстетика: editorial / magazine spread, не SaaS-hero. Дизайн опирается
//  на существующие токены — Fraunces (display) + IBM Plex (body), глубокий
//  teal #004743, кремовая бумага #F4EFE5, антикварное золото.
//
//  Композиция работает как разворот журнала:
//    01. Манифест — крупный италик-заголовок, 1-2 строки эссенции.
//    02. Цифры — крупные числа на бумажной карточке (тираж, точность).
//    03. Метод — три шага «данные → модель → прогнозы» в виде колонн.
//    04. Тарифы — краткое превью + ссылка на /plans.
//    05. Финальный CTA с золотом.
//
//  Залогиненные видят шапку с «Перейти в кабинет», ссылка ведёт на /app.
// ─────────────────────────────────────────────────────────────────────────

export default function LandingPage() {
  const isAuthed = useAuthStore((s) => s.isAuthenticated())

  return (
    <div className="min-h-screen bg-surface text-ink overflow-hidden">
      <Header isAuthed={isAuthed} />

      <main>
        <Hero isAuthed={isAuthed} />
        <Numbers />
        <Method />
        <PlansPreview />
        <FinalCta isAuthed={isAuthed} />
      </main>

      <Footer />
    </div>
  )
}

// ── Header ───────────────────────────────────────────────────────────────

function Header({ isAuthed }: { isAuthed: boolean }) {
  return (
    <header className="border-b border-surface-border bg-surface/80 backdrop-blur-sm">
      <div className="mx-auto max-w-6xl px-6 lg:px-10 h-16 flex items-center justify-between">
        <Link to="/" className="flex items-baseline gap-3">
          <span className="display-em text-brand-700 text-xl">SKU</span>
          <span className="eyebrow !text-ink-muted">Forecasting</span>
        </Link>

        <nav className="flex items-center gap-1 sm:gap-2 text-sm">
          <a
            href="#method"
            className="hidden sm:inline-flex px-3 py-2 text-ink-muted hover:text-ink transition-colors"
          >
            Метод
          </a>
          <Link
            to="/plans"
            className="hidden sm:inline-flex px-3 py-2 text-ink-muted hover:text-ink transition-colors"
          >
            Тарифы
          </Link>

          {isAuthed ? (
            <Link to="/app" className="btn-primary !px-4 !py-2 text-sm">
              Перейти в кабинет →
            </Link>
          ) : (
            <>
              <Link
                to="/login"
                className="px-4 py-2 text-ink hover:text-brand-500 transition-colors"
              >
                Войти
              </Link>
              <Link to="/signup" className="btn-primary !px-4 !py-2 text-sm">
                Начать
              </Link>
            </>
          )}
        </nav>
      </div>
    </header>
  )
}

// ── Hero ─────────────────────────────────────────────────────────────────

function Hero({ isAuthed }: { isAuthed: boolean }) {
  return (
    <section className="relative isolate">
      {/* атмосферный фоновый штрих — бледная полоса, как водяной знак */}
      <div
        aria-hidden
        className="absolute inset-x-0 top-32 h-[1px] bg-gradient-to-r from-transparent via-paper-line to-transparent opacity-60"
      />

      <div className="mx-auto max-w-6xl px-6 lg:px-10 pt-20 pb-24 lg:pt-32 lg:pb-32">
        <div className="grid gap-10 lg:gap-16 lg:grid-cols-12 items-end">
          {/* основной манифест — 7 колонок, асимметрия */}
          <div className="lg:col-span-7">
            <div className="eyebrow text-brand-500">— Россия · 2026 —</div>
            <h1 className="display-xl mt-6 leading-[0.95] tracking-tight">
              Прогноз спроса <br className="hidden sm:block" />
              <span className="display-em text-gold-600">без угадываний.</span>
            </h1>
            <p className="mt-8 max-w-xl text-base sm:text-lg text-ink-muted leading-relaxed">
              Платформа машинного обучения для розничных и e-commerce
              операций. Загрузите CSV с историей продаж — через несколько
              минут получаете прогноз по каждому SKU и REST API для интеграций.
            </p>

            <div className="mt-10 flex flex-wrap items-center gap-3">
              {isAuthed ? (
                <Link to="/app" className="btn-primary !px-6 !py-3 text-sm">
                  Открыть кабинет →
                </Link>
              ) : (
                <>
                  <Link to="/signup" className="btn-primary !px-6 !py-3 text-sm">
                    Попробовать бесплатно
                  </Link>
                  <Link to="/login" className="btn-tertiary !px-4 !py-3 text-sm">
                    Уже есть аккаунт →
                  </Link>
                </>
              )}
            </div>

            <div className="mt-12 flex flex-wrap items-center gap-x-6 gap-y-2 text-xs text-ink-subtle">
              <span className="inline-flex items-center gap-2">
                <Dot /> 14 дней Free без карты
              </span>
              <span className="inline-flex items-center gap-2">
                <Dot /> Данные не покидают РФ
              </span>
              <span className="inline-flex items-center gap-2">
                <Dot /> REST API из коробки
              </span>
            </div>
          </div>

          {/* боковая «бумажная» врезка — пэйперкард с примером прогноза */}
          <aside className="lg:col-span-5">
            <div className="card-paper p-7 sm:p-8 relative">
              <div className="eyebrow text-paper-ink">— пример —</div>
              <div className="mt-2 flex items-baseline gap-2">
                <span className="font-mono text-paper-ink/70 text-xs">
                  SKU&nbsp;A8421
                </span>
                <span className="ml-auto badge-gold !rounded">Forecast</span>
              </div>

              <div className="mt-5">
                <div className="display-md font-display text-paper-ink leading-none">
                  +1 248
                </div>
                <div className="text-xs text-paper-ink/70 mt-2 font-sans tracking-wide">
                  единиц на следующие 14 дней · доверительный интервал 80–95%
                </div>
              </div>

              {/* «спарклайн» — простой SVG, без рекчартов */}
              <Sparkline className="mt-6" />

              <div className="mt-6 grid grid-cols-3 gap-3 text-[11px] text-paper-ink/70 font-sans">
                <Stat k="MAPE" v="6.4%" />
                <Stat k="модель" v="LightGBM" />
                <Stat k="latency" v="< 200мс" />
              </div>
            </div>
          </aside>
        </div>
      </div>
    </section>
  )
}

// ── Numbers strip ────────────────────────────────────────────────────────

function Numbers() {
  return (
    <section className="border-y border-surface-border bg-surface-muted/40">
      <div className="mx-auto max-w-6xl px-6 lg:px-10 py-10 sm:py-14">
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-y-8 gap-x-6 sm:gap-x-10">
          <Big n="< 7%" k="средняя ошибка прогноза (MAPE) на горизонте 28 дней" />
          <Big n="200мс" k="время ответа REST-эндпоинта /predict" />
          <Big n="14d" k="бесплатный пробный период без карты" />
          <Big n="∞" k="SKU на тарифе Business" sub />
        </div>
      </div>
    </section>
  )
}

function Big({ n, k, sub }: { n: string; k: string; sub?: boolean }) {
  return (
    <div>
      <div
        className={`font-display ${
          sub ? 'text-brand-700/70' : 'text-brand-700'
        } text-4xl sm:text-5xl leading-none tabular-nums`}
      >
        {n}
      </div>
      <div className="mt-3 text-xs sm:text-sm text-ink-muted leading-snug max-w-[18ch]">
        {k}
      </div>
    </div>
  )
}

// ── Method ───────────────────────────────────────────────────────────────

function Method() {
  return (
    <section id="method" className="mx-auto max-w-6xl px-6 lg:px-10 py-24 sm:py-28">
      <div className="max-w-2xl">
        <div className="eyebrow text-brand-500">— как это работает —</div>
        <h2 className="display-lg mt-5 leading-[1.05]">
          Три шага от <span className="display-em text-gold-600">CSV</span> до
          прогноза.
        </h2>
      </div>

      <ol className="mt-14 grid gap-10 lg:gap-12 lg:grid-cols-3 list-none">
        <Step
          n="01"
          title="Загрузите историю"
          body="CSV или XLSX с колонками SKU, дата, количество. Файл шифруется на стороне браузера, проходит антивирус и валидируется в изолированной песочнице — пользовательские данные никогда не попадают на основной сервер в сыром виде."
        />
        <Step
          n="02"
          title="Обучение в фоне"
          body="LightGBM на ваших временных рядах + сезонные/праздничные признаки + календарь РФ. Модель сравнивается с базовой SeasonalNaive — если хуже, в продакшен идёт baseline (вы об этом узнаете)."
        />
        <Step
          n="03"
          title="UI и API"
          body="Прогноз доступен в личном кабинете и через POST /predict. Один JWT токен, один API-key, документация в /docs (OpenAPI). 1c, ERP, BI — подключаются за час."
        />
      </ol>
    </section>
  )
}

function Step({ n, title, body }: { n: string; title: string; body: string }) {
  return (
    <li className="relative">
      <div className="font-display italic text-gold-500/80 text-5xl leading-none">
        {n}
      </div>
      <h3 className="font-display text-2xl text-brand-700 mt-4 leading-tight">
        {title}
      </h3>
      <p className="mt-4 text-sm text-ink-muted leading-relaxed">{body}</p>
    </li>
  )
}

// ── Plans preview ────────────────────────────────────────────────────────

function PlansPreview() {
  return (
    <section className="border-t border-surface-border bg-surface-muted/30">
      <div className="mx-auto max-w-6xl px-6 lg:px-10 py-24 sm:py-28">
        <div className="flex items-end justify-between flex-wrap gap-6 mb-12">
          <div className="max-w-xl">
            <div className="eyebrow text-brand-500">— тарифы —</div>
            <h2 className="display-lg mt-5 leading-[1.05]">
              Простая <span className="display-em text-gold-600">плата</span>
              {' '}за объём.
            </h2>
            <p className="mt-5 text-sm text-ink-muted leading-relaxed">
              Free — для проверки гипотезы. Start — для одного небольшого
              магазина. Business — без ограничений по SKU и горизонту,
              приоритетный supports.
            </p>
          </div>
          <Link
            to="/plans"
            className="btn-tertiary !px-4 !py-2 text-sm self-start sm:self-end"
          >
            Все детали →
          </Link>
        </div>

        <div className="grid gap-5 sm:grid-cols-3">
          <Plan
            name="Free"
            price="0 ₽"
            tagline="14 дней без карты"
            bullets={['до 50 SKU', 'горизонт 14 дней', '1 модель в день']}
          />
          <Plan
            name="Start"
            price="2 900 ₽"
            tagline="в месяц"
            featured
            bullets={['до 500 SKU', 'горизонт 28 дней', 'API + UI']}
          />
          <Plan
            name="Business"
            price="по запросу"
            tagline="индивидуально"
            premium
            bullets={[
              'без ограничений по SKU',
              'выделенный SLA + supports',
              'on-prem опция',
            ]}
          />
        </div>
      </div>
    </section>
  )
}

function Plan({
  name,
  price,
  tagline,
  bullets,
  featured,
  premium,
}: {
  name: string
  price: string
  tagline: string
  bullets: string[]
  featured?: boolean
  premium?: boolean
}) {
  const card = premium ? 'card-paper' : 'card'
  const accent = featured
    ? 'ring-2 !ring-brand-500'
    : premium
      ? 'ring-1 ring-paper-deep'
      : ''
  return (
    <div className={`${card} ${accent} p-7 relative`}>
      {featured && (
        <span className="absolute -top-3 left-7 badge-info !rounded">
          популярный
        </span>
      )}
      {premium && (
        <span className="absolute -top-3 left-7 badge-gold !rounded">
          premium
        </span>
      )}
      <div className="font-display text-2xl text-brand-700">{name}</div>
      <div className="mt-3 flex items-baseline gap-2">
        <span className="font-display text-3xl text-ink tabular-nums">
          {price}
        </span>
        <span className="text-xs text-ink-subtle">{tagline}</span>
      </div>
      <ul className="mt-6 space-y-2 text-sm text-ink-muted">
        {bullets.map((b) => (
          <li key={b} className="flex items-baseline gap-2">
            <span className="text-gold-600">✦</span> {b}
          </li>
        ))}
      </ul>
    </div>
  )
}

// ── Final CTA ────────────────────────────────────────────────────────────

function FinalCta({ isAuthed }: { isAuthed: boolean }) {
  return (
    <section className="mx-auto max-w-6xl px-6 lg:px-10 py-24 sm:py-32">
      <div className="card-paper p-10 sm:p-14 relative overflow-hidden">
        <div
          aria-hidden
          className="absolute -right-10 -top-10 w-48 h-48 rounded-full bg-gold-500/8"
        />
        <div className="eyebrow text-paper-ink">— старт за 5 минут —</div>
        <h2 className="display-lg mt-5 leading-[1.05] text-paper-ink max-w-xl">
          Подключите{' '}
          <span className="display-em text-gold-600">первый прогноз</span> уже
          сегодня.
        </h2>
        <p className="mt-5 text-sm text-paper-ink/80 leading-relaxed max-w-xl">
          Регистрация по email — никаких звонков «менеджера». Free-период
          закрывается без напоминаний и без сохранения карты.
        </p>
        <div className="mt-10 flex flex-wrap gap-3">
          {isAuthed ? (
            <Link to="/app" className="btn-gold !px-6 !py-3 text-sm">
              В кабинет →
            </Link>
          ) : (
            <>
              <Link to="/signup" className="btn-gold !px-6 !py-3 text-sm">
                Зарегистрироваться
              </Link>
              <Link to="/login" className="btn-tertiary !px-4 !py-3 text-sm">
                Войти
              </Link>
            </>
          )}
        </div>
      </div>
    </section>
  )
}

// ── Footer ───────────────────────────────────────────────────────────────

function Footer() {
  return (
    <footer className="border-t border-surface-border">
      <div className="mx-auto max-w-6xl px-6 lg:px-10 py-10 flex flex-wrap items-center justify-between gap-4 text-xs text-ink-subtle">
        <div className="flex items-baseline gap-3">
          <span className="display-em text-brand-700">SKU</span>
          <span className="eyebrow !text-ink-subtle">Forecasting · 2026</span>
        </div>
        <div className="flex items-center gap-5">
          <Link to="/plans" className="hover:text-ink transition-colors">
            Тарифы
          </Link>
          <a
            href="https://api.testcore.ru/docs"
            target="_blank"
            rel="noreferrer"
            className="hover:text-ink transition-colors"
          >
            API
          </a>
          <Link to="/login" className="hover:text-ink transition-colors">
            Вход
          </Link>
        </div>
      </div>
    </footer>
  )
}

// ── Tiny reusable bits ───────────────────────────────────────────────────

function Dot() {
  return (
    <span className="inline-block w-1 h-1 rounded-full bg-gold-500" />
  )
}

function Stat({ k, v }: { k: string; v: string }) {
  return (
    <div>
      <div className="uppercase tracking-[0.16em] text-paper-ink/60">{k}</div>
      <div className="font-mono mt-1 text-paper-ink">{v}</div>
    </div>
  )
}

function Sparkline({ className }: { className?: string }) {
  // Грубая выдуманная серия + прогноз (последние 4 точки) — стилистически
  // важна форма, не точные цифры.
  const past = [22, 28, 24, 31, 29, 36, 34, 41, 38, 46]
  const fcst = [49, 52, 55, 60]
  const all = [...past, ...fcst]
  const max = Math.max(...all)
  const W = 320
  const H = 70
  const step = W / (all.length - 1)
  const yOf = (v: number) => H - (v / max) * (H - 6) - 3
  const points = all.map((v, i) => `${i * step},${yOf(v)}`).join(' ')
  const splitX = (past.length - 1) * step

  return (
    <svg
      viewBox={`0 0 ${W} ${H}`}
      className={className}
      preserveAspectRatio="none"
      aria-hidden
    >
      {/* область под прошлым — еле заметная полоса */}
      <rect
        x="0"
        y="0"
        width={splitX}
        height={H}
        fill="rgba(76, 68, 53, 0.04)"
      />
      {/* линия */}
      <polyline
        points={points}
        fill="none"
        stroke="#4C4435"
        strokeWidth="1.5"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
      {/* пунктир-разделитель */}
      <line
        x1={splitX}
        y1="2"
        x2={splitX}
        y2={H - 2}
        stroke="#C79A33"
        strokeWidth="1"
        strokeDasharray="2 3"
      />
      {/* финальная точка-маркер прогноза */}
      <circle
        cx={(all.length - 1) * step}
        cy={yOf(all[all.length - 1])}
        r="3"
        fill="#C79A33"
      />
    </svg>
  )
}
