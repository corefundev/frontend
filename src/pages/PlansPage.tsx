import { useQuery } from '@tanstack/react-query'
import { Link } from 'react-router-dom'

import { plansApi, type PlanSpec } from '../features/plans/api'
import { useAuthStore } from '../features/auth/store'

// ─────────────────────────────────────────────────────────────────────────
//  Editorial plan showcase.
//
//  Layout intent: like a magazine feature — a hero with italic display
//  type, then three "chapters" (01–03) with an angle and value prop for
//  each tier. Below: an understated comparison ledger.
//
//  Not a corporate SaaS pricing page.
// ─────────────────────────────────────────────────────────────────────────

// Per-plan editorial angle — the *voice* for the chapter. Kept short
// because Fraunces Italic carries weight.
interface ChapterCopy {
  number: string
  angle:  string
  promise: string
  body:    string
  cta:     string
  accent:  'brand' | 'gold'
}

const CHAPTERS: Record<'free' | 'start' | 'business', ChapterCopy> = {
  free: {
    number: '01',
    angle:   'Попробуй',
    promise: 'Точный прогноз за 5 минут',
    body:    'Загрузите CSV — получите прогноз по 30 позициям на неделю. Никаких настроек, никаких карт, никакого обмана.',
    cta:     'Начать бесплатно',
    accent:  'brand',
  },
  start: {
    number: '02',
    angle:   'Настрой под себя',
    promise: 'Модель слышит ваш бизнес',
    body:    'Расскажите модели про ваши праздники, промо и сезон — и она ответит прогнозом, который можно нести директору. До 1 500 SKU и 3 месяца вперёд.',
    cta:     'Попробовать Start',
    accent:  'gold',
  },
  business: {
    number: '03',
    angle:   'Разверни на весь бизнес',
    promise: 'Прогноз × стратегия',
    body:    'Промо-планирование, "что-если" сценарии, годовой горизонт, интеграции с 1С и API. Снимаются все лимиты.',
    cta:     'Связаться для Business',
    accent:  'brand',
  },
}

export default function PlansPage() {
  const isAuthed = useAuthStore((s) => s.isAuthenticated())

  const { data: plans = [], isLoading } = useQuery({
    queryKey: ['plans'],
    queryFn: () => plansApi.list(),
  })

  const byId = new Map(plans.map((p) => [p.id, p]))

  return (
    <div className="min-h-screen bg-surface">
      <Topbar isAuthed={isAuthed} />

      {/* ── HERO ──────────────────────────────────────────────── */}
      <section className="max-w-5xl mx-auto px-6 pt-20 pb-12">
        <div className="eyebrow mb-6">SKU Forecasting · Три модели</div>
        <h1 className="display-lg sm:text-[4.5rem] text-brand-700 max-w-4xl leading-[1.02]">
          Прогноз, который{' '}
          <span className="display-em text-gold-600">растёт вместе</span>
          {' '}с вашим ассортиментом.
        </h1>
        <p className="mt-8 max-w-xl text-ink-muted text-lg">
          Одна платформа, три уровня глубины. Начинайте с простого —
          переходите к сложному только когда почувствуете потребность.
        </p>

        <div className="mt-10 rule-dot" />
      </section>

      {/* ── CHAPTERS ──────────────────────────────────────────── */}
      <section className="max-w-6xl mx-auto px-6 space-y-24 pb-20">
        {isLoading && (
          <div className="py-20 text-center text-ink-muted">Загрузка тарифов…</div>
        )}

        {(['free', 'start', 'business'] as const).map((id, idx) => {
          const spec = byId.get(id)
          if (!spec) return null
          return (
            <Chapter
              key={id}
              spec={spec}
              copy={CHAPTERS[id]}
              reversed={idx % 2 === 1}
            />
          )
        })}
      </section>

      {/* ── COMPARISON LEDGER ────────────────────────────────── */}
      {plans.length > 0 && (
        <section className="max-w-6xl mx-auto px-6 pb-24">
          <div className="rule-dot mb-12" />
          <div className="eyebrow">Сравнение · ледгер</div>
          <h2 className="display-em text-brand-700 text-3xl mt-2 mb-8">
            Всё на одной странице.
          </h2>
          <ComparisonLedger plans={plans} />
        </section>
      )}

      <Footer />
    </div>
  )
}

// ══════════════════════════════════════════════════════════════════════════
//  Topbar — minimal, with an editorial rule below it
// ══════════════════════════════════════════════════════════════════════════

function Topbar({ isAuthed }: { isAuthed: boolean }) {
  return (
    <header className="border-b border-surface-border">
      <div className="max-w-6xl mx-auto px-6 h-16 flex items-center justify-between">
        <Link to="/" className="flex items-center gap-3 text-brand-700">
          <span className="h-8 w-8 rounded-md bg-brand-500 flex items-center justify-center text-ink-invert text-[11px] font-semibold tracking-wider">
            SKU
          </span>
          <span className="font-display italic text-lg">Forecasting</span>
        </Link>
        <nav className="flex items-center gap-6 text-sm">
          <Link to="/plans" className="text-brand-700 font-medium">Тарифы</Link>
          {isAuthed ? (
            <Link to="/" className="btn-secondary">В кабинет</Link>
          ) : (
            <Link to="/login" className="btn-primary">Войти</Link>
          )}
        </nav>
      </div>
    </header>
  )
}

// ══════════════════════════════════════════════════════════════════════════
//  Chapter — two-column layout with editorial angle + plan card
// ══════════════════════════════════════════════════════════════════════════

function Chapter({
  spec,
  copy,
  reversed,
}: {
  spec: PlanSpec
  copy: ChapterCopy
  reversed: boolean
}) {
  return (
    <article className={`grid gap-10 lg:gap-16 lg:grid-cols-12 items-start ${reversed ? 'lg:[&>*:first-child]:order-2' : ''}`}>
      {/* ── Voice column ─────────────────────────────────────── */}
      <div className="lg:col-span-5">
        <div className="chapter-num text-base">Chapter {copy.number}</div>
        <div className="eyebrow mt-2">{copy.angle}</div>
        <h2 className="display-md sm:text-5xl text-brand-700 mt-3 leading-[1.05]">
          {copy.promise}
        </h2>
        <p className="text-ink-muted mt-6 leading-relaxed">{copy.body}</p>
      </div>

      {/* ── Plan card column ─────────────────────────────────── */}
      <div className="lg:col-span-7">
        <PlanCard spec={spec} cta={copy.cta} accent={copy.accent} />
      </div>
    </article>
  )
}

// ══════════════════════════════════════════════════════════════════════════
//  PlanCard — the actual pricing object
// ══════════════════════════════════════════════════════════════════════════

function PlanCard({
  spec,
  cta,
  accent,
}: {
  spec: PlanSpec
  cta:  string
  accent: 'brand' | 'gold'
}) {
  const featured = accent === 'gold'
  return (
    <div
      className={[
        'relative rounded-2xl p-8 sm:p-10',
        featured
          ? 'card-paper shadow-paper'
          : 'bg-brand-700 text-ink-invert shadow-panel',
      ].join(' ')}
    >
      {featured && (
        <span
          className="absolute top-4 right-4 eyebrow text-gold-600"
          aria-label="рекомендуется"
        >
          · рекомендуется
        </span>
      )}

      <div className={featured ? 'text-paper-ink' : 'text-ink-invert'}>
        <div className={featured ? 'eyebrow text-paper-ink/60' : 'eyebrow !text-brand-50/70'}>
          Модель
        </div>
        <div className={[
          'display-em mt-1',
          featured ? 'text-brand-700' : 'text-gold-300',
          'text-4xl sm:text-5xl',
        ].join(' ')}>
          {spec.model_display_name}
        </div>
        <div className={[
          'mt-1 font-sans',
          featured ? 'text-paper-ink/70' : 'text-brand-50/70',
        ].join(' ')}>
          тариф {spec.display_name}
        </div>

        {/* Key numbers in editorial style */}
        <dl className="mt-8 grid grid-cols-2 gap-y-5 gap-x-6">
          <KeyFigure
            featured={featured}
            label="SKU в прогнозе"
            value={spec.max_skus === null ? '∞' : `до ${spec.max_skus.toLocaleString('ru-RU')}`}
          />
          <KeyFigure
            featured={featured}
            label="Горизонт"
            value={
              spec.max_horizon_days === null
                ? '∞'
                : spec.max_horizon_days >= 365
                ? 'до года'
                : spec.max_horizon_days >= 30
                ? `до ${Math.round(spec.max_horizon_days / 30)} мес.`
                : `до ${spec.max_horizon_days} дн.`
            }
          />
          <KeyFigure
            featured={featured}
            label="Запусков/мес"
            value={
              spec.training_runs_per_month === null ? '∞'
                : String(spec.training_runs_per_month)
            }
          />
          <KeyFigure
            featured={featured}
            label="Настройки"
            value={
              spec.config_allowed_keys === null ? 'полная'
              : spec.config_allowed_keys.length === 0 ? '—'
              : 'базовые'
            }
          />
        </dl>

        <div
          className={[
            'mt-8 h-px',
            featured ? 'bg-paper-deep' : 'bg-brand-500/40',
          ].join(' ')}
        />

        <Link
          to="/login"
          className={[
            'mt-6 inline-flex w-full sm:w-auto',
            featured ? 'btn-gold' : 'btn bg-gold-500 text-brand-800 hover:bg-gold-300',
          ].join(' ')}
        >
          {cta} →
        </Link>
      </div>
    </div>
  )
}

function KeyFigure({
  featured,
  label,
  value,
}: {
  featured: boolean
  label: string
  value: string
}) {
  return (
    <div>
      <div
        className={[
          'eyebrow',
          featured ? 'text-paper-ink/55' : '!text-brand-50/60',
        ].join(' ')}
      >
        {label}
      </div>
      <div
        className={[
          'num font-display mt-1 text-xl sm:text-2xl leading-none',
          featured ? 'text-brand-700' : 'text-ink-invert',
        ].join(' ')}
      >
        {value}
      </div>
    </div>
  )
}

// ══════════════════════════════════════════════════════════════════════════
//  ComparisonLedger — thin-rule table that reads like a printed ledger
// ══════════════════════════════════════════════════════════════════════════

interface LedgerRow {
  label: string
  get:   (p: PlanSpec) => React.ReactNode
}

const LEDGER: LedgerRow[] = [
  { label: 'SKU',                      get: (p) => p.max_skus === null ? '∞' : `${p.max_skus.toLocaleString('ru-RU')}` },
  { label: 'Горизонт прогноза',        get: (p) => p.max_horizon_days === null ? '∞' : `${p.max_horizon_days} дн.` },
  { label: 'Обучений в месяц',         get: (p) => p.training_runs_per_month === null ? '∞' : String(p.training_runs_per_month) },
  { label: 'Cooldown между обучениями', get: (p) => p.training_cooldown_hours === null ? '—' : `${p.training_cooldown_hours} ч` },
  {
    label: 'Пользовательский конфиг',
    get: (p) => p.config_allowed_keys === null ? 'полный'
               : p.config_allowed_keys.length === 0 ? 'нет'
               : `${p.config_allowed_keys.length} полей`,
  },
  {
    label: 'Детализация объяснения',
    get: (p) => p.id === 'business' ? 'макс.'
               : p.id === 'start' ? 'факторы'
               : 'только цифры',
  },
  {
    label: 'Экспорт',
    get: (p) => p.id === 'business' ? 'API · авторассылки'
               : p.id === 'start' ? 'Excel · PDF'
               : 'только экран',
  },
  {
    label: 'Сценарии / промо',
    get: (p) => p.id === 'business' ? 'да' : '—',
  },
]

function ComparisonLedger({ plans }: { plans: PlanSpec[] }) {
  const ordered = ['free', 'start', 'business']
    .map((id) => plans.find((p) => p.id === id))
    .filter((p): p is PlanSpec => !!p)

  return (
    <div className="overflow-x-auto">
      <table className="w-full min-w-[640px] border-collapse">
        <thead>
          <tr>
            <th className="eyebrow text-left py-3 pr-6 border-b border-surface-border font-normal">
              Возможность
            </th>
            {ordered.map((p) => (
              <th
                key={p.id}
                className="py-3 pr-6 border-b border-surface-border text-left"
              >
                <div className="eyebrow">{p.display_name}</div>
                <div className="display-em text-brand-700 text-xl leading-none mt-0.5">
                  {p.model_display_name}
                </div>
              </th>
            ))}
          </tr>
        </thead>
        <tbody className="font-sans text-sm">
          {LEDGER.map((row) => (
            <tr key={row.label} className="border-b border-surface-border/60">
              <td className="py-3 pr-6 text-ink-muted">{row.label}</td>
              {ordered.map((p) => (
                <td key={p.id} className="py-3 pr-6 num text-ink">
                  {row.get(p)}
                </td>
              ))}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  )
}

// ══════════════════════════════════════════════════════════════════════════
//  Footer — understated, one rule line
// ══════════════════════════════════════════════════════════════════════════

function Footer() {
  return (
    <footer className="border-t border-surface-border">
      <div className="max-w-6xl mx-auto px-6 py-10 flex items-center justify-between text-sm text-ink-subtle">
        <div className="font-display italic">SKU Forecasting</div>
        <div className="flex gap-6">
          <Link to="/plans" className="hover:text-ink">Тарифы</Link>
          <Link to="/login" className="hover:text-ink">Войти</Link>
        </div>
      </div>
    </footer>
  )
}
