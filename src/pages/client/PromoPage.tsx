import { useMemo, useState } from 'react'
import toast from 'react-hot-toast'

import { useUsage } from '../../features/plans/useUsage'
import { LockOverlay } from '../../features/plans/upsell'

// ─────────────────────────────────────────────────────────────────────────
//  PromoPage — promo campaign planner (Business-only).
//
//  Differs from ScenariosPage: this is narrower — one lever (discount
//  depth) applied to a specific SKU/category over a date range — plus
//  explicit cannibalization forecasting (adjacent SKUs will lose
//  volume).
//
//  Output is an approve-and-commit button; on approval we currently
//  persist to localStorage. Backend /promo/approve is future work.
// ─────────────────────────────────────────────────────────────────────────

interface PromoPlan {
  id:           string
  scope:        string
  startDate:    string
  endDate:      string
  discountPct:  number
  approvedAt:   string
  expectedLift: number
  cannibalized: number
}

const STORAGE_KEY = 'sku-promo-plans'

function loadPromos(): PromoPlan[] {
  try { return JSON.parse(localStorage.getItem(STORAGE_KEY) || '[]') }
  catch { return [] }
}
function savePromos(list: PromoPlan[]) {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(list))
}

function todayISO(offsetDays = 0): string {
  const d = new Date()
  d.setDate(d.getDate() + offsetDays)
  return d.toISOString().slice(0, 10)
}

export default function PromoPage() {
  const { data: usage } = useUsage()
  const isBusiness = usage?.plan === 'business'

  const [scope,       setScope]       = useState('sku:SKU-042')
  const [startDate,   setStartDate]   = useState(todayISO(7))
  const [endDate,     setEndDate]     = useState(todayISO(14))
  const [discountPct, setDiscountPct] = useState(15)
  const [history,     setHistory]     = useState<PromoPlan[]>(() => loadPromos())

  const sim = useMemo(
    () => simulatePromo({ scope, startDate, endDate, discountPct }),
    [scope, startDate, endDate, discountPct],
  )

  function approve() {
    if (!startDate || !endDate || endDate < startDate) {
      toast.error('Проверьте даты акции')
      return
    }
    const plan: PromoPlan = {
      id: crypto.randomUUID(),
      scope, startDate, endDate, discountPct,
      approvedAt:   new Date().toISOString(),
      expectedLift: sim.lift,
      cannibalized: sim.cannib,
    }
    const next = [plan, ...history]
    setHistory(next)
    savePromos(next)
    toast.success('Промо утверждено, прогноз пересчитан')
  }

  function revoke(id: string) {
    const next = history.filter((p) => p.id !== id)
    setHistory(next)
    savePromos(next)
  }

  const content = (
    <div className="space-y-10">
      <header>
        <div className="eyebrow">Промо</div>
        <h1 className="display-em text-brand-700 text-4xl sm:text-5xl mt-2 leading-[1.05]">
          Увидьте эффект акции<br/>до её запуска.
        </h1>
        <p className="mt-4 text-ink-muted max-w-2xl">
          Выберите SKU или категорию, период и глубину скидки — модель
          посчитает, сколько придёт клиентов и сколько откусит
          от соседей по витрине.
        </p>
      </header>

      <section className="grid gap-6 lg:grid-cols-12">
        {/* ── Form ────────────────────────────────────────── */}
        <div className="lg:col-span-7 space-y-6">
          <div className="card p-6 sm:p-7">
            <div className="flex items-baseline gap-3 mb-4">
              <span className="chapter-num">— 01</span>
              <h2 className="display-em text-brand-700 text-2xl">Параметры акции</h2>
            </div>

            <div className="grid sm:grid-cols-2 gap-4">
              <div>
                <div className="label">Что со скидкой</div>
                <select
                  className="input"
                  value={scope}
                  onChange={(e) => setScope(e.target.value)}
                >
                  <optgroup label="Категория">
                    <option value="category:food">Продукты</option>
                    <option value="category:drinks">Напитки</option>
                    <option value="category:home">Товары для дома</option>
                  </optgroup>
                  <optgroup label="Отдельный SKU">
                    <option value="sku:SKU-042">SKU-042</option>
                    <option value="sku:SKU-017">SKU-017</option>
                    <option value="sku:SKU-101">SKU-101</option>
                  </optgroup>
                </select>
              </div>

              <div>
                <div className="label">Глубина скидки</div>
                <div className="flex items-center gap-3">
                  <input
                    type="range"
                    min={5}
                    max={50}
                    step={5}
                    value={discountPct}
                    onChange={(e) => setDiscountPct(Number(e.target.value))}
                    className="slider flex-1"
                  />
                  <span className="num font-display text-brand-700 text-xl min-w-[60px] text-right">
                    −{discountPct}%
                  </span>
                </div>
              </div>

              <div>
                <div className="label">Начало</div>
                <input
                  type="date"
                  className="input"
                  value={startDate}
                  onChange={(e) => setStartDate(e.target.value)}
                />
              </div>
              <div>
                <div className="label">Окончание</div>
                <input
                  type="date"
                  className="input"
                  value={endDate}
                  onChange={(e) => setEndDate(e.target.value)}
                />
              </div>
            </div>
          </div>

          {/* ── Cannib breakdown ──────────────────────────── */}
          <div className="card p-6 sm:p-7">
            <div className="flex items-baseline gap-3 mb-4">
              <span className="chapter-num">— 02</span>
              <h2 className="display-em text-brand-700 text-2xl">Каннибализация</h2>
            </div>
            <p className="text-sm text-ink-muted mb-4">
              Модель оценивает, сколько продаж перетечёт с соседних товаров
              на акционный. Низкая каннибализация — акция «расширяет»
              рынок; высокая — клиенты просто перекладывают деньги в ту
              же корзину.
            </p>
            <ul className="divide-y divide-surface-border">
              {sim.cannibBreakdown.map((c, i) => (
                <li key={i} className="py-3 flex items-center justify-between">
                  <div>
                    <div className="font-mono text-sm">{c.sku}</div>
                    <div className="eyebrow mt-0.5">{c.name}</div>
                  </div>
                  <div className="num font-display text-terra text-lg">
                    −{c.pct.toFixed(1)}%
                  </div>
                </li>
              ))}
            </ul>
          </div>

          <div className="flex items-center justify-end gap-3">
            <button type="button" className="btn-primary" onClick={approve}>
              Утвердить промо →
            </button>
          </div>
        </div>

        {/* ── Results sidecard ─────────────────────────────── */}
        <aside className="lg:col-span-5">
          <div className="sticky top-6 space-y-5">
            <PromoImpactCard sim={sim} />
            <StackedBars sim={sim} />
          </div>
        </aside>
      </section>

      {history.length > 0 && (
        <section>
          <div className="rule-dot mb-6" />
          <div className="eyebrow">Утверждённые акции</div>
          <h2 className="display-em text-brand-700 text-2xl mt-1 mb-4">
            История
          </h2>
          <ul className="card divide-y divide-surface-border">
            {history.map((p) => <HistoryRow key={p.id} p={p} onRevoke={revoke} />)}
          </ul>
        </section>
      )}
    </div>
  )

  if (!isBusiness) {
    return (
      <div className="max-w-6xl">
        <div className="relative min-h-[720px]">
          <LockOverlay
            required="business"
            title="Проигрывайте акции до запуска"
            blurb="Выбирайте SKU и период, корректируйте глубину скидки — модель сразу покажет прирост, каннибализацию и итоговый эффект на прогноз. Доступно на Business."
          >
            {content}
          </LockOverlay>
        </div>
      </div>
    )
  }

  return <div className="max-w-6xl">{content}</div>
}

// ─────────────────────────────────────────────────────────────────────────
//  Results
// ─────────────────────────────────────────────────────────────────────────

function PromoImpactCard({ sim }: { sim: PromoSim }) {
  return (
    <div className="card p-6">
      <div className="chapter-num">— эффект</div>
      <h3 className="display-em text-brand-700 text-xl mt-1">
        {sim.net > 0 ? 'Чистый прирост' : 'Ожидаемые потери'}
      </h3>
      <div className={[
        'num font-display text-5xl leading-none mt-3',
        sim.net > 0 ? 'text-moss' : 'text-terra',
      ].join(' ')}>
        {sim.net > 0 ? '+' : ''}{sim.net.toLocaleString('ru-RU', { maximumFractionDigits: 0 })}
        <span className="text-xl text-ink-muted"> шт.</span>
      </div>
      <div className="mt-5 grid grid-cols-2 gap-4 text-sm">
        <div>
          <div className="eyebrow">Прирост на акции</div>
          <div className="num font-display text-moss text-xl mt-0.5">
            +{sim.lift.toLocaleString('ru-RU', { maximumFractionDigits: 0 })}
          </div>
        </div>
        <div>
          <div className="eyebrow">Каннибализация</div>
          <div className="num font-display text-terra text-xl mt-0.5">
            −{sim.cannib.toLocaleString('ru-RU', { maximumFractionDigits: 0 })}
          </div>
        </div>
      </div>
      <div className="rule-dot !my-5" />
      <div className="text-xs text-ink-muted">
        Период: <span className="num">{sim.days}</span> дней · эластичность промо 2.1
      </div>
    </div>
  )
}

function StackedBars({ sim }: { sim: PromoSim }) {
  const total = sim.baseline + sim.lift
  return (
    <div className="card p-6">
      <div className="chapter-num">— состав</div>
      <h3 className="display-em text-brand-700 text-xl mt-1">Из чего состоит прогноз</h3>
      <div className="mt-4">
        <div className="flex rounded-md overflow-hidden h-4 ring-1 ring-surface-border">
          <div
            className="bg-brand-500 h-full"
            style={{ width: `${(sim.baseline / total) * 100}%` }}
            title={`База: ${sim.baseline.toFixed(0)}`}
          />
          <div
            className="bg-moss h-full"
            style={{ width: `${(sim.lift / total) * 100}%` }}
            title={`Прирост: +${sim.lift.toFixed(0)}`}
          />
        </div>
        <div className="flex items-center gap-4 mt-3 eyebrow">
          <span className="flex items-center gap-1.5">
            <span className="w-2 h-2 bg-brand-500 rounded-sm" /> база {sim.baseline.toFixed(0)}
          </span>
          <span className="flex items-center gap-1.5">
            <span className="w-2 h-2 bg-moss rounded-sm" /> прирост {sim.lift.toFixed(0)}
          </span>
        </div>
      </div>

      <div className="mt-5">
        <div className="eyebrow mb-1">Каннибализация соседей</div>
        <div className="flex rounded-md overflow-hidden h-4 ring-1 ring-surface-border bg-surface-muted">
          <div
            className="bg-terra h-full"
            style={{ width: `${Math.min(100, sim.cannibPct)}%` }}
          />
        </div>
        <div className="eyebrow mt-1.5">
          −{sim.cannib.toFixed(0)} шт. ({sim.cannibPct.toFixed(1)}% от базы соседних SKU)
        </div>
      </div>
    </div>
  )
}

function HistoryRow({ p, onRevoke }: { p: PromoPlan; onRevoke: (id: string) => void }) {
  return (
    <li className="p-4 flex items-center gap-4">
      <div className="flex-1 min-w-0">
        <div className="text-sm font-medium text-ink">{p.scope} · −{p.discountPct}%</div>
        <div className="eyebrow mt-0.5">
          {p.startDate} → {p.endDate}
          {' · '}прирост +{p.expectedLift.toFixed(0)} шт.
          {' · '}каннибализация −{p.cannibalized.toFixed(0)} шт.
        </div>
      </div>
      <button
        type="button"
        className="btn-ghost !px-3 !py-1.5 text-ink-subtle hover:!text-danger"
        onClick={() => onRevoke(p.id)}
        title="Отменить"
      >
        ×
      </button>
    </li>
  )
}

// ─────────────────────────────────────────────────────────────────────────
//  Promo simulation — same client-side philosophy as ScenariosPage.simulate
// ─────────────────────────────────────────────────────────────────────────

interface PromoSim {
  days:          number
  baseline:      number      // expected sales without promo
  lift:          number      // additional from promo
  cannib:        number      // absolute
  cannibPct:     number      // % of adjacent SKUs affected
  net:           number      // lift − cannib
  cannibBreakdown: { sku: string; name: string; pct: number }[]
}

function simulatePromo(p: {
  scope: string
  startDate: string
  endDate: string
  discountPct: number
}): PromoSim {
  const start = new Date(p.startDate)
  const end   = new Date(p.endDate)
  const days  = Math.max(1, Math.round((end.getTime() - start.getTime()) / 86400000) + 1)

  const baselinePerDay = 38
  const promoElasticity = 2.1

  const baseline = baselinePerDay * days
  const lift     = baseline * (p.discountPct / 100) * promoElasticity

  // Cannibalization — function of scope + discount depth
  const cannibRate = (p.discountPct / 100) * (p.scope.startsWith('category') ? 0.1 : 0.35)
  const cannib     = lift * cannibRate
  const cannibPct  = cannibRate * 100

  // Rough breakdown per 3 neighbor SKUs
  const cannibBreakdown = [
    { sku: 'SKU-041', name: 'Соседний артикул',      pct: cannibPct * 0.5 },
    { sku: 'SKU-043', name: 'Из той же категории',   pct: cannibPct * 0.3 },
    { sku: 'SKU-055', name: 'Взаимозаменяемый',      pct: cannibPct * 0.2 },
  ]

  return {
    days, baseline, lift, cannib, cannibPct,
    net: lift - cannib,
    cannibBreakdown,
  }
}
