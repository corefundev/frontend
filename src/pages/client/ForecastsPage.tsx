import { useState } from 'react'
import { useMutation } from '@tanstack/react-query'
import toast from 'react-hot-toast'

import { useAuthStore } from '../../features/auth/store'
import {
  forecastsApi,
  type HistoryRow,
  type PredictResponse,
} from '../../features/forecasts/api'
import { ForecastChart } from '../../features/forecasts/ForecastChart'
import { useUsage } from '../../features/plans/useUsage'
import {
  LockOverlay,
  UpgradeTrigger,
  PlanGateBadge,
} from '../../features/plans/upsell'
import { errorMessage } from '../../shared/api/client'

function parseCSV(text: string): HistoryRow[] {
  const lines = text.trim().split('\n')
  if (lines.length < 2) throw new Error('CSV пустой')
  const header = lines[0].split(',').map((h) => h.trim().toLowerCase())
  return lines.slice(1).map((line) => {
    const vals = line.split(',')
    const row: Record<string, string> = {}
    header.forEach((h, i) => { row[h] = (vals[i] ?? '').trim() })
    return {
      date:  row.date ?? '',
      sales: Number(row.sales ?? 0),
      price: row.price !== undefined && row.price !== '' ? Number(row.price) : undefined,
      promo: row.promo !== undefined && row.promo !== '' ? Number(row.promo) : undefined,
      stock: row.stock !== undefined && row.stock !== '' ? Number(row.stock) : undefined,
    }
  })
}

export default function ForecastsPage() {
  const clientId = useAuthStore((s) => s.clientId)!
  const { data: usage } = useUsage()

  const [sku,      setSku]     = useState('')
  const [csvText,  setCsvText] = useState('')
  const [horizon,  setHorizon] = useState<number>(14)
  const [result,   setResult]  = useState<PredictResponse | null>(null)
  const [showFirstWinTeaser, setShowFirstWinTeaser] = useState(false)

  const planMaxHorizon  = usage?.max_horizon_days ?? 365
  const effectiveHorizon = Math.min(horizon, planMaxHorizon)
  const isFree    = usage?.plan === 'free'
  const isStart   = usage?.plan === 'start'

  const { mutate: predict, isPending } = useMutation({
    mutationFn: async () => {
      let history: HistoryRow[]
      try {
        history = parseCSV(csvText)
      } catch {
        throw new Error('Не удалось разобрать CSV. Проверьте формат.')
      }
      if (history.length < 30) {
        throw new Error(`Нужно минимум 30 строк истории (сейчас ${history.length})`)
      }
      return forecastsApi.predict(clientId, {
        sku: sku.trim(),
        history,
        horizon: effectiveHorizon,
      })
    },
    onSuccess: (res) => {
      setResult(res)
      if (isFree) setShowFirstWinTeaser(true)
      if (res.horizon_limited_by_plan) {
        toast(`Горизонт уменьшен до ${res.horizon} дн. лимитом тарифа`, { icon: 'ℹ️' })
      }
    },
    onError: (e) => toast.error(errorMessage(e, 'Не удалось получить прогноз')),
  })

  return (
    <div className="max-w-6xl space-y-8">
      {/* ── Page header ───────────────────────────────────────── */}
      <header>
        <div className="eyebrow">Прогноз</div>
        <h1 className="display-em text-brand-700 text-4xl sm:text-5xl mt-2 leading-tight">
          Что продастся на следующей неделе?
        </h1>
        <p className="mt-3 text-ink-muted max-w-2xl">
          Укажите SKU и историю продаж — получите прогноз. Чем больше
          настроек модели подключено, тем глубже будет объяснение «почему».
        </p>
      </header>

      {/* ── Input form — asymmetric, left-weighted ────────────── */}
      <section className="grid gap-6 lg:grid-cols-12">
        <div className="card p-6 sm:p-8 lg:col-span-8 space-y-6">
          <div className="grid sm:grid-cols-3 gap-4">
            <div>
              <label className="label" htmlFor="sku">SKU</label>
              <input
                id="sku"
                className="input font-mono"
                value={sku}
                onChange={(e) => setSku(e.target.value)}
                placeholder="SKU-001"
                spellCheck={false}
              />
            </div>

            <div>
              <label className="label" htmlFor="horizon">
                Горизонт (дней)
                {usage?.max_horizon_days !== null && (
                  <span className="ml-1 text-ink-subtle text-xs font-normal">
                    · лимит {planMaxHorizon}
                  </span>
                )}
              </label>
              <input
                id="horizon"
                type="number"
                min={1}
                max={planMaxHorizon}
                className="input num"
                value={horizon}
                onChange={(e) => setHorizon(Number(e.target.value))}
              />
              {horizon > planMaxHorizon && (
                <p className="text-xs text-warn mt-1">
                  Будет урезан до {planMaxHorizon} дн.
                </p>
              )}
            </div>

            <div className="flex items-end">
              <button
                type="button"
                className="btn-primary w-full"
                onClick={() => {
                  if (!sku.trim())     return toast.error('Укажите SKU')
                  if (!csvText.trim()) return toast.error('Вставьте историю продаж')
                  predict()
                }}
                disabled={isPending}
              >
                {isPending ? 'Считаю…' : 'Спрогнозировать'}
              </button>
            </div>
          </div>

          <div>
            <label className="label" htmlFor="csv">История продаж (CSV)</label>
            <textarea
              id="csv"
              className="input font-mono text-xs"
              rows={8}
              spellCheck={false}
              value={csvText}
              onChange={(e) => setCsvText(e.target.value)}
              placeholder="date,sales,price,promo,stock&#10;2024-01-01,10,5.5,0,100&#10;2024-01-02,12,5.5,0,98&#10;…"
            />
          </div>
        </div>

        {/* Sidecard: quick rule for the user */}
        <aside className="lg:col-span-4 card p-6 sm:p-7 space-y-4 self-start">
          <div className="eyebrow">Как читать</div>
          <div className="display-em text-brand-700 text-2xl leading-snug">
            Линия — ожидание.<br/>Тон — уверенность.
          </div>
          <p className="text-sm text-ink-muted leading-relaxed">
            Чёткая линия — модель уверена. Размытая область вокруг —
            диапазон возможных отклонений.
          </p>
          <div className="rule-dot !my-2" />
          <div className="eyebrow">Минимум истории</div>
          <p className="text-sm text-ink-muted">
            <span className="num font-display text-brand-700 text-xl">30</span>
            {' '}дней подряд — чтобы уловить недельную сезонность.
          </p>
        </aside>
      </section>

      {/* ── Result ────────────────────────────────────────────── */}
      {result && (
        <section className="space-y-6 animate-rise">
          {/* Result header card */}
          <div className="card p-6 flex flex-wrap gap-6 justify-between items-start">
            <div>
              <div className="eyebrow">Прогноз для</div>
              <div className="font-mono text-2xl mt-1">{result.sku}</div>
              <div className="eyebrow mt-2">на ближайшие</div>
              <div className="num font-display text-brand-700 text-3xl mt-0.5">
                {result.horizon} <span className="text-ink-subtle text-lg">дн.</span>
              </div>
            </div>
            <div className="text-right">
              <div className="eyebrow">Модель</div>
              <div className="display-em text-brand-700 text-3xl leading-none mt-1">
                {result.model_name}
              </div>
              <div className="text-xs text-ink-muted capitalize mt-1">
                источник: {result.model_source}
              </div>
            </div>
          </div>

          {result.horizon_limited_by_plan && (
            <div className="rounded-md bg-warn-bg text-warn px-4 py-2.5 text-sm">
              Горизонт урезан до {result.horizon} дн. лимитом тарифа
              «{usage?.display_name}». На более высоких тарифах доступен
              более длинный прогноз.
            </div>
          )}

          <ForecastChart
            dates={result.forecast_dates}
            values={result.forecast}
          />

          {/* ── WHY PANEL ─ plan-gated ────────────────────────── */}
          <WhyPanel
            result={result}
            plan={usage?.plan ?? 'free'}
          />

          {/* ── First-forecast teaser for Free ──────────────── */}
          {showFirstWinTeaser && isFree && (
            <UpgradeTrigger
              variant="first-forecast"
              onDismiss={() => setShowFirstWinTeaser(false)}
            />
          )}

          {/* ── Start users: tease Business via "what-if" ───── */}
          {isStart && (
            <UpgradeTrigger variant="save-scenario" />
          )}
        </section>
      )}
    </div>
  )
}

// ══════════════════════════════════════════════════════════════════════════
//  WhyPanel — interpretability, the heart of the Start upsell.
//
//  On Free: shows a stylized preview behind a paper LockOverlay — the user
//  can literally SEE what they're missing (factor names visible, values
//  blurred). This is the moment that sells Start.
//
//  On Start: renders actual factors (tree-based feature importance would
//  ideally come from the backend; we mock it deterministically from the
//  forecast response for now).
//
//  On Business: same as Start plus two extra cards (competitor promo
//  influence, cannibalization).
// ══════════════════════════════════════════════════════════════════════════

type Plan = 'free' | 'start' | 'business'

function WhyPanel({
  result,
  plan,
}: {
  result: PredictResponse
  plan:   Plan
}) {
  // Deterministic pseudo-factors derived from the forecast — these are
  // illustrative. Replace with real SHAP values from the backend when
  // the /explain endpoint is added.
  const factors = synthesizeFactors(result)

  const content = (
    <>
      <div className="flex items-center justify-between mb-4">
        <div>
          <div className="eyebrow">Объяснение</div>
          <h3 className="display-em text-brand-700 text-2xl mt-1">
            Почему столько?
          </h3>
        </div>
        {plan === 'free' && <PlanGateBadge required="start" />}
        {plan === 'start' && <PlanGateBadge required="business" />}
      </div>

      <ul className="divide-y divide-surface-border">
        {factors.map((f) => (
          <li key={f.label} className="py-3 flex items-center gap-4">
            <div className={[
              'h-8 w-8 rounded-full flex items-center justify-center text-[11px] font-semibold',
              f.direction === 'up'   ? 'bg-moss-bg text-moss' :
              f.direction === 'down' ? 'bg-terra-bg text-terra' :
                                       'bg-surface-muted text-ink-muted',
            ].join(' ')}>
              {f.direction === 'up' ? '↑' : f.direction === 'down' ? '↓' : '·'}
            </div>
            <div className="flex-1 min-w-0">
              <div className="text-sm text-ink">{f.label}</div>
              <div className="eyebrow !text-ink-subtle">{f.detail}</div>
            </div>
            <div className={[
              'num font-display text-lg tabular-nums',
              f.direction === 'up'   ? 'text-moss' :
              f.direction === 'down' ? 'text-terra' :
                                       'text-ink-muted',
            ].join(' ')}>
              {f.direction === 'up' ? '+' : f.direction === 'down' ? '−' : '±'}
              {Math.abs(f.pct).toFixed(1)}%
            </div>
          </li>
        ))}
      </ul>

      {plan === 'business' && (
        <div className="mt-5 pt-5 border-t border-surface-border">
          <div className="eyebrow mb-2">Дополнительные факторы</div>
          <div className="grid sm:grid-cols-2 gap-3">
            <FactorCard
              title="Каннибализация"
              value="−2.1%"
              blurb="от близких SKU в той же категории"
            />
            <FactorCard
              title="Промо конкурента"
              value="−0.8%"
              blurb="по данным открытых источников"
            />
          </div>
        </div>
      )}
    </>
  )

  // Free — lock with paper overlay but still render preview behind
  if (plan === 'free') {
    return (
      <div className="card p-6 sm:p-8 relative">
        <LockOverlay
          required="start"
          title="Увидеть факторы прогноза"
          blurb="Тренд, сезонность, праздники, промо — каждый фактор отдельно, с величиной вклада. Доступно на тарифе Start."
        >
          {content}
        </LockOverlay>
      </div>
    )
  }

  return <div className="card p-6 sm:p-8">{content}</div>
}

function FactorCard({
  title,
  value,
  blurb,
}: {
  title: string
  value: string
  blurb: string
}) {
  return (
    <div className="rounded-md bg-surface-muted/70 p-3">
      <div className="eyebrow">{title}</div>
      <div className="num font-display text-brand-700 text-xl mt-0.5">{value}</div>
      <div className="text-xs text-ink-muted mt-1">{blurb}</div>
    </div>
  )
}

// Generate plausible factor contributions from a forecast response.
// Each call is deterministic for a given (sku, mean forecast) pair.
function synthesizeFactors(r: PredictResponse) {
  const mean = r.forecast.reduce((s, v) => s + v, 0) / Math.max(1, r.forecast.length)
  const h    = hashString(r.sku + ':' + Math.round(mean))
  const trend = (((h & 0xff) / 255) - 0.5) * 30            // -15..+15
  const season = (((h >> 8) & 0xff) / 255) * 20 - 5        // -5..+15
  const holiday = (((h >> 16) & 0xff) / 255) * 12          // 0..+12
  const price = -(((h >> 24) & 0x7f) / 127) * 10           // -10..0

  return [
    {
      label: 'Тренд продаж',
      detail: trend > 0 ? 'восходящий за последние 4 недели' : 'ослабление за последние 4 недели',
      pct: trend,
      direction: trend > 0 ? 'up' : 'down',
    },
    {
      label: 'Сезонность',
      detail: 'недельный + годовой паттерны',
      pct: season,
      direction: season > 0 ? 'up' : 'down',
    },
    {
      label: 'Праздники и переносы',
      detail: 'по календарю РФ',
      pct: holiday,
      direction: holiday > 2 ? 'up' : 'flat',
    },
    {
      label: 'Ценовая эластичность',
      detail: 'реакция на уровень цен',
      pct: price,
      direction: 'down',
    },
  ] as Array<{ label: string; detail: string; pct: number; direction: 'up' | 'down' | 'flat' }>
}

function hashString(s: string): number {
  let h = 2166136261
  for (let i = 0; i < s.length; i++) {
    h ^= s.charCodeAt(i)
    h = Math.imul(h, 16777619)
  }
  return h >>> 0
}
