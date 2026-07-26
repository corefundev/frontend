import { useMemo, useState } from 'react'
import toast from 'react-hot-toast'

import { useUsage } from '../../features/plans/useUsage'
import { LockOverlay } from '../../features/plans/upsell'

// ─────────────────────────────────────────────────────────────────────────
//  ScenariosPage — "что-если" planning sandbox (Business-only).
//
//  What the user does here:
//    1. Picks a scope (all SKUs / category / specific SKU)
//    2. Tweaks three business levers — price, marketing spend, supplier lag
//    3. Sees base vs modified forecast side-by-side (both totals + chart)
//    4. Saves the scenario to localStorage for later comparison
//
//  What's real vs mocked:
//    • Levers + UI                      — real, final design
//    • Forecast simulation              — client-side synthesis (same pattern
//                                         as SettingsPage LivePreview)
//    • Persistence                      — localStorage; backend endpoint
//                                         for scenarios doesn't exist yet
//
//  When the backend /scenarios endpoint ships, only `simulate()` and
//  persistence change; the UI and UX stay.
// ─────────────────────────────────────────────────────────────────────────

interface Scenario {
  id:           string
  name:         string
  priceChange:  number     // −30 .. +30 (%)
  marketingBudget: number  // 0 .. 200 (% of baseline)
  supplierLag:  number     // 0 .. 14 (days of delivery delay)
  scope:        string     // 'all' | 'category:food' | 'sku:SKU-001'
  savedAt:      string
}

const STORAGE_KEY = 'sku-scenarios'

function loadScenarios(): Scenario[] {
  try {
    return JSON.parse(localStorage.getItem(STORAGE_KEY) || '[]')
  } catch {
    return []
  }
}
function saveScenarios(list: Scenario[]) {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(list))
}

export default function ScenariosPage() {
  const { data: usage } = useUsage()
  const isBusiness = usage?.plan === 'business'

  const [scope,           setScope]           = useState('all')
  const [priceChange,     setPriceChange]     = useState(0)
  const [marketingBudget, setMarketingBudget] = useState(100)
  const [supplierLag,     setSupplierLag]     = useState(0)
  const [saved, setSaved] = useState<Scenario[]>(() => loadScenarios())
  const [name, setName]   = useState('')

  const sim = useMemo(
    () => simulate({ priceChange, marketingBudget, supplierLag }),
    [priceChange, marketingBudget, supplierLag],
  )

  function handleSave() {
    const n = name.trim() || `Сценарий ${saved.length + 1}`
    const scenario: Scenario = {
      id: crypto.randomUUID(),
      name: n,
      priceChange,
      marketingBudget,
      supplierLag,
      scope,
      savedAt: new Date().toISOString(),
    }
    const next = [scenario, ...saved]
    setSaved(next)
    saveScenarios(next)
    setName('')
    toast.success(`Сохранён: ${n}`)
  }

  function handleDelete(id: string) {
    const next = saved.filter((s) => s.id !== id)
    setSaved(next)
    saveScenarios(next)
  }

  function handleLoad(s: Scenario) {
    setScope(s.scope)
    setPriceChange(s.priceChange)
    setMarketingBudget(s.marketingBudget)
    setSupplierLag(s.supplierLag)
    toast(`Загружен: ${s.name}`, { icon: '📥' })
  }

  const content = (
    <div className="space-y-10">
      {/* ── Hero ─────────────────────────────────────────────── */}
      <header>
        <div className="eyebrow">Сценарии · «что-если»</div>
        <h1 className="display-em text-brand-700 text-4xl sm:text-5xl mt-2 leading-[1.05]">
          Проиграйте решение<br/>до того, как примете его.
        </h1>
        <p className="mt-4 text-ink-muted max-w-2xl">
          Измените цену, маркетинг или условия поставки — модель сразу покажет,
          как поменяется прогноз. Сохраняйте варианты и сравнивайте.
        </p>
      </header>

      {/* ── Controls ─────────────────────────────────────────── */}
      <section className="grid gap-6 lg:grid-cols-12">
        <div className="lg:col-span-7 space-y-6">

          <div className="card p-6 sm:p-7">
            <div className="flex items-baseline gap-3 mb-4">
              <span className="chapter-num">— 01</span>
              <h2 className="display-em text-brand-700 text-2xl">Что меняем</h2>
            </div>

            <div className="grid sm:grid-cols-2 gap-4 mb-5">
              <div>
                <div className="label">Охват</div>
                <select
                  className="input"
                  value={scope}
                  onChange={(e) => setScope(e.target.value)}
                >
                  <option value="all">Все SKU</option>
                  <option value="category:food">Категория: продукты</option>
                  <option value="category:drinks">Категория: напитки</option>
                  <option value="category:home">Категория: дом</option>
                  <option value="sku:SKU-001">Один SKU: SKU-001</option>
                </select>
              </div>
            </div>

            <Lever
              label="Изменение цены"
              value={priceChange}
              min={-30}
              max={30}
              unit="%"
              hint={
                priceChange === 0 ? 'без изменения'
                : priceChange > 0 ? 'повышение цены уменьшит спрос (эластичность)'
                : 'снижение цены увеличит спрос, но снизит маржу'
              }
              onChange={setPriceChange}
            />
            <Lever
              label="Маркетинговый бюджет"
              value={marketingBudget}
              min={0}
              max={200}
              unit="%"
              baseline={100}
              hint={
                marketingBudget === 100 ? 'без изменения'
                : marketingBudget > 100 ? `+${marketingBudget - 100}% к текущему бюджету — ожидаем рост спроса`
                : `−${100 - marketingBudget}% — отказ от части промо`
              }
              onChange={setMarketingBudget}
            />
            <Lever
              label="Задержка поставки"
              value={supplierLag}
              min={0}
              max={14}
              unit=" дн."
              hint={
                supplierLag === 0 ? 'без задержек'
                : `+${supplierLag} дней на поставку — риск out-of-stock`
              }
              onChange={setSupplierLag}
            />
          </div>

          {/* ── Save row ──────────────────────────────────── */}
          <div className="card p-5 flex items-end gap-3">
            <div className="flex-1">
              <div className="label">Имя сценария</div>
              <input
                className="input"
                placeholder="Напр., «Февральская акция −10%»"
                value={name}
                onChange={(e) => setName(e.target.value)}
              />
            </div>
            <button type="button" className="btn-primary" onClick={handleSave}>
              Сохранить сценарий
            </button>
          </div>
        </div>

        {/* ── Right — results ─────────────────────────────── */}
        <aside className="lg:col-span-5">
          <div className="sticky top-6 space-y-5">
            <ResultsCard sim={sim} />
            <ComparisonBars sim={sim} />
          </div>
        </aside>
      </section>

      {/* ── Saved ────────────────────────────────────────── */}
      {saved.length > 0 && (
        <section>
          <div className="rule-dot mb-6" />
          <div className="eyebrow">Сохранённые сценарии</div>
          <h2 className="display-em text-brand-700 text-2xl mt-1 mb-4">
            Сравните решения
          </h2>
          <ul className="card divide-y divide-surface-border">
            {saved.map((s) => <SavedRow key={s.id} s={s} onLoad={handleLoad} onDelete={handleDelete} />)}
          </ul>
        </section>
      )}
    </div>
  )

  // ── Free / Start — full-page paper lock ───────────────────
  if (!isBusiness) {
    return (
      <div className="max-w-6xl">
        <div className="relative min-h-[720px]">
          <LockOverlay
            required="business"
            title="Проиграйте сценарий до того, как его реализовать"
            blurb="Цены, маркетинг, поставщики — регулируйте и сразу смотрите, как поменяется прогноз и прибыль. Сохраняйте и сравнивайте. Доступно на Business."
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
//  Lever — a slider + numeric readout for business parameters
// ─────────────────────────────────────────────────────────────────────────

function Lever({
  label, value, min, max, unit = '', baseline, hint, onChange,
}: {
  label: string
  value: number
  min: number
  max: number
  unit?: string
  baseline?: number
  hint?: string
  onChange: (v: number) => void
}) {
  const displayValue =
    baseline !== undefined ? value - baseline : value
  const signed =
    displayValue === 0 ? '—' :
    `${displayValue > 0 ? '+' : ''}${displayValue}${unit}`

  return (
    <div className="mb-5 last:mb-0">
      <div className="flex items-baseline justify-between">
        <div className="text-sm font-medium text-ink">{label}</div>
        <div className="num font-display text-brand-700 text-xl">{signed}</div>
      </div>
      <input
        type="range"
        min={min}
        max={max}
        value={value}
        onChange={(e) => onChange(Number(e.target.value))}
        className="slider mt-2"
      />
      {hint && <div className="eyebrow mt-1.5 max-w-md">{hint}</div>}
    </div>
  )
}

// ─────────────────────────────────────────────────────────────────────────
//  Results card — key metrics (baseline vs scenario)
// ─────────────────────────────────────────────────────────────────────────

function ResultsCard({ sim }: { sim: Simulation }) {
  return (
    <div className="card p-6">
      <div className="chapter-num">— результат</div>
      <h3 className="display-em text-brand-700 text-xl mt-1">Модифицированный прогноз</h3>

      <dl className="mt-5 space-y-4">
        <Metric
          label="Ожидаемые продажи (30 дн.)"
          base={sim.baselineSales}
          modified={sim.modifiedSales}
          unit=" шт."
        />
        <Metric
          label="Ожидаемая выручка"
          base={sim.baselineRevenue}
          modified={sim.modifiedRevenue}
          unit=" ₽"
          large
        />
        <Metric
          label="Риск out-of-stock"
          base={sim.baselineStockout}
          modified={sim.modifiedStockout}
          unit="%"
          higherIsBad
        />
      </dl>
    </div>
  )
}

function Metric({
  label, base, modified, unit, large, higherIsBad,
}: {
  label: string
  base: number
  modified: number
  unit: string
  large?: boolean
  higherIsBad?: boolean
}) {
  const diff = modified - base
  const pct  = base === 0 ? 0 : (diff / base) * 100
  const good = higherIsBad ? diff < 0 : diff > 0
  const tone = diff === 0 ? 'text-ink-muted' : good ? 'text-moss' : 'text-terra'

  return (
    <div>
      <div className="eyebrow">{label}</div>
      <div className="flex items-baseline gap-3 mt-1">
        <span className={`num font-display ${large ? 'text-3xl' : 'text-xl'} text-brand-700`}>
          {fmt(modified, unit)}
        </span>
        <span className="text-xs text-ink-subtle">было {fmt(base, unit)}</span>
        <span className={`ml-auto eyebrow ${tone}`}>
          {diff === 0 ? '—' : `${diff > 0 ? '+' : ''}${pct.toFixed(1)}%`}
        </span>
      </div>
    </div>
  )
}

function fmt(v: number, unit: string): string {
  const abs = Math.abs(v)
  let out: string
  if (abs >= 1_000_000) out = (v / 1_000_000).toFixed(2) + ' млн'
  else if (abs >= 1_000) out = (v / 1_000).toFixed(1) + ' тыс'
  else out = v.toFixed(0)
  return out + unit
}

// ─────────────────────────────────────────────────────────────────────────
//  Side-by-side bar chart: weekly baseline vs scenario
// ─────────────────────────────────────────────────────────────────────────

function ComparisonBars({ sim }: { sim: Simulation }) {
  const weeks = sim.weekly   // 4 weeks
  const maxVal = Math.max(...weeks.map((w) => Math.max(w.base, w.modified)))

  return (
    <div className="card p-6">
      <div className="chapter-num">— по неделям</div>
      <h3 className="display-em text-brand-700 text-xl mt-1">База vs сценарий</h3>

      <div className="mt-5 flex items-end gap-3 h-32">
        {weeks.map((w, i) => (
          <div key={i} className="flex-1 flex flex-col items-center gap-1">
            <div className="flex items-end gap-1 h-full w-full">
              <div
                className="flex-1 bg-surface-border rounded-sm"
                style={{ height: `${(w.base / maxVal) * 100}%` }}
                title={`База: ${w.base.toFixed(0)}`}
              />
              <div
                className={`flex-1 rounded-sm ${w.modified >= w.base ? 'bg-brand-500' : 'bg-terra'}`}
                style={{ height: `${(w.modified / maxVal) * 100}%` }}
                title={`Сценарий: ${w.modified.toFixed(0)}`}
              />
            </div>
            <div className="eyebrow">нед. {i + 1}</div>
          </div>
        ))}
      </div>

      <div className="flex items-center gap-4 mt-4 eyebrow">
        <span className="flex items-center gap-1.5">
          <span className="w-2 h-2 bg-surface-border rounded-sm" /> база
        </span>
        <span className="flex items-center gap-1.5">
          <span className="w-2 h-2 bg-brand-500 rounded-sm" /> сценарий
        </span>
      </div>
    </div>
  )
}

// ─────────────────────────────────────────────────────────────────────────
//  Saved scenario row
// ─────────────────────────────────────────────────────────────────────────

function SavedRow({ s, onLoad, onDelete }: {
  s: Scenario
  onLoad: (s: Scenario) => void
  onDelete: (id: string) => void
}) {
  return (
    <li className="p-4 flex items-center gap-4">
      <div className="flex-1 min-w-0">
        <div className="text-sm font-medium text-ink truncate">{s.name}</div>
        <div className="eyebrow mt-0.5">
          {s.scope === 'all' ? 'все SKU' : s.scope}
          {' · '}цена {s.priceChange > 0 ? '+' : ''}{s.priceChange}%
          {' · '}маркетинг {s.marketingBudget}%
          {' · '}лаг {s.supplierLag} дн.
        </div>
      </div>
      <button type="button" className="btn-ghost !px-3 !py-1.5" onClick={() => onLoad(s)}>
        Загрузить
      </button>
      <button
        type="button"
        className="btn-ghost !px-3 !py-1.5 text-ink-subtle hover:!text-danger"
        onClick={() => onDelete(s.id)}
        title="Удалить"
      >
        ×
      </button>
    </li>
  )
}

// ─────────────────────────────────────────────────────────────────────────
//  Simulation — deterministic client-side synthesis.
//
//  Models the three levers with simple elasticities:
//    • Price:     elasticity -1.2 (1% price up → 1.2% demand down)
//    • Marketing: marginal ROI 0.3 (1% budget up → 0.3% demand up)
//    • Supplier:  out-of-stock risk rises with lag; capped at 80%
//
//  Replace with a real /scenarios/simulate endpoint when ready.
// ─────────────────────────────────────────────────────────────────────────

interface Simulation {
  baselineSales:    number
  modifiedSales:    number
  baselineRevenue:  number
  modifiedRevenue:  number
  baselineStockout: number
  modifiedStockout: number
  weekly: { base: number; modified: number }[]
}

function simulate(input: {
  priceChange: number
  marketingBudget: number
  supplierLag: number
}): Simulation {
  const baselineSalesPerDay = 42
  const basePrice = 120
  const days = 30

  const priceElasticity = -1.2
  const priceMultiplier = 1 + (input.priceChange / 100) * priceElasticity
  const mktMultiplier   = 1 + ((input.marketingBudget - 100) / 100) * 0.3

  const stockoutBase = 2 + input.supplierLag * 1.8
  const stockoutMult = Math.max(0, 1 - stockoutBase / 100)

  const baselineSales    = baselineSalesPerDay * days
  const modifiedSales    = baselineSales * priceMultiplier * mktMultiplier * stockoutMult
  const baselineRevenue  = baselineSales * basePrice
  const modifiedRevenue  = modifiedSales * basePrice * (1 + input.priceChange / 100)

  const weekly = [0, 1, 2, 3].map((i) => ({
    base: baselineSales / 4 * (1 + Math.sin(i) * 0.08),
    modified: modifiedSales / 4 * (1 + Math.sin(i + 1) * 0.08),
  }))

  return {
    baselineSales,
    modifiedSales,
    baselineRevenue,
    modifiedRevenue,
    baselineStockout: 2,
    modifiedStockout: Math.min(80, stockoutBase),
    weekly,
  }
}
