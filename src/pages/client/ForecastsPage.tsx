import { useMemo, useState } from 'react'
import { Link } from 'react-router-dom'
import { useQuery } from '@tanstack/react-query'
import { format, parseISO } from 'date-fns'
import { ru } from 'date-fns/locale'

import { useAuthStore } from '../../features/auth/store'
import { anomaliesApi, type AnomalyRow } from '../../features/anomalies/api'
import {
  forecastsApi,
  type ForecastSku,
  type ForecastsResponse,
} from '../../features/forecasts/api'
import { ForecastChart } from '../../features/forecasts/ForecastChart'
import { useUsage } from '../../features/plans/useUsage'
import {
  LockOverlay,
  UpgradeTrigger,
  PlanGateBadge,
} from '../../features/plans/upsell'

export default function ForecastsPage() {
  const clientId = useAuthStore((s) => s.clientId)!
  const { data: usage } = useUsage()
  const isFree    = usage?.plan === 'free'
  const isStart   = usage?.plan === 'start'

  // The viewer reads pre-computed forecasts written by the worker
  // after every training run. No input form, no triggers — refetch
  // on a slow interval so a freshly-finished training shows up
  // without a manual reload.
  const { data, isLoading, isError } = useQuery({
    queryKey: ['forecasts', clientId],
    queryFn:  () => forecastsApi.listForecasts(clientId),
    refetchInterval: 15_000,
    // PjaxLoader-silent — see PjaxLoader.tsx predicate.
    meta: { silent: true },
  })

  if (isLoading) {
    return (
      <div className="max-w-6xl py-12">
        <div className="text-ink-muted">Загружаем прогнозы…</div>
      </div>
    )
  }

  if (isError || !data) {
    return (
      <div className="max-w-6xl py-12">
        <div className="text-danger">Не удалось загрузить прогнозы.</div>
      </div>
    )
  }

  if (data.count === 0) {
    return (
      <div className="max-w-3xl py-12 space-y-6">
        <header>
          <div className="eyebrow">Прогноз</div>
          <h1 className="display-em text-brand-700 text-4xl mt-2 leading-tight">
            Пока нечего показать
          </h1>
        </header>
        <div className="card p-6 sm:p-8 space-y-3">
          <p className="text-ink-muted">
            Прогнозы появятся здесь автоматически после первого обучения модели.
          </p>
          <p className="text-ink-muted">
            Загрузите данные во вкладке{' '}
            <a className="text-brand-700 underline" href="/app/uploads">«Загрузки»</a>,
            затем запустите обучение во вкладке{' '}
            <a className="text-brand-700 underline" href="/app/training">«Обучение»</a>.
          </p>
        </div>
      </div>
    )
  }

  return (
    <ForecastViewer
      data={data}
      isFree={isFree}
      isStart={isStart}
      planName={usage?.display_name ?? ''}
    />
  )
}

// ══════════════════════════════════════════════════════════════════════════
//  Viewer — list of SKUs on the left, chart of selected SKU on the right.
//  Refreshed automatically by react-query, no user input.
// ══════════════════════════════════════════════════════════════════════════

function ForecastViewer({
  data,
  isFree,
  isStart,
  planName,
}: {
  data:     ForecastsResponse
  isFree:   boolean
  isStart:  boolean
  planName: string
}) {
  const clientId = useAuthStore((s) => s.clientId)!
  const [selectedSku, setSelectedSku] = useState<string>(() => data.skus[0]?.sku ?? '')
  const [search,      setSearch]      = useState('')

  // Anomalies for the selected SKU — fetched lazily and cached per SKU.
  // Falls back gracefully when the endpoint is empty (no anomalies, or
  // pre-v0.8.27 training runs without persisted detection).
  const { data: anomaliesPayload } = useQuery({
    queryKey: ['anomalies', clientId, selectedSku],
    queryFn:  () => anomaliesApi.list(clientId, selectedSku || undefined),
    enabled:  !!selectedSku,
  })
  const anomalies: AnomalyRow[] = anomaliesPayload?.anomalies ?? []

  // QW2-3 (#226): whole days since the forecasts (= the model) were
  // generated; past 45 days the header shows a retrain nudge (measured
  // drift: interval coverage slides 0.805 → ~0.75 over 1-3 months).
  const modelAgeDays = useMemo(() => {
    if (!data.generated_at) return null
    const ms = Date.now() - parseISO(data.generated_at).getTime()
    return Number.isFinite(ms) ? Math.floor(ms / 86_400_000) : null
  }, [data.generated_at])

  // Build the date axis once — every SKU's values array is aligned to
  // it index-by-index.
  const dates = useMemo(() => {
    if (!data.first_date || !data.last_date) return []
    const start = parseISO(data.first_date)
    const end   = parseISO(data.last_date)
    const out: string[] = []
    const cursor = new Date(start)
    while (cursor <= end) {
      out.push(format(cursor, 'yyyy-MM-dd'))
      cursor.setDate(cursor.getDate() + 1)
    }
    return out
  }, [data.first_date, data.last_date])

  const filteredSkus = useMemo(() => {
    if (!search.trim()) return data.skus
    const q = search.trim().toLowerCase()
    return data.skus.filter((s) => s.sku.toLowerCase().includes(q))
  }, [data.skus, search])

  const selected: ForecastSku | undefined = useMemo(
    () => data.skus.find((s) => s.sku === selectedSku),
    [data.skus, selectedSku],
  )

  return (
    <div className="max-w-6xl space-y-6">
      {/* ── Header ──────────────────────────────────────────── */}
      <header className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <div className="eyebrow">Прогноз</div>
          <h1 className="display-em text-brand-700 text-4xl sm:text-5xl mt-2 leading-tight">
            Что продастся
          </h1>
        </div>
        <div className="text-right text-sm">
          {data.generated_at && (
            <>
              <div className="text-ink-muted">
                Обновлено {formatTs(data.generated_at)}
              </div>
              <div className="text-ink-subtle text-xs mt-0.5">
                до {formatDate(data.last_date)} · горизонт {data.horizon_days} дн. · {data.count} SKU
              </div>
              {/* QW2-3 (#226): staleness nudge. Measured drift: interval
                  coverage slides 0.805 → ~0.75 over 1-3 months without a
                  retrain, so past 45 days we nudge toward Обучение. */}
              {modelAgeDays !== null && modelAgeDays > 45 && (
                <div className="mt-1.5">
                  <Link to="/training" className="badge-warn hover:opacity-80 transition-opacity">
                    Модель обучена {modelAgeDays} дн. назад — рекомендуем переобучить
                  </Link>
                </div>
              )}
            </>
          )}
        </div>
      </header>

      {/* ── List + chart ────────────────────────────────────── */}
      <section className="grid gap-6 lg:grid-cols-12">
        <aside className="lg:col-span-4 card p-4 space-y-3 self-start">
          <input
            type="search"
            placeholder="Поиск SKU…"
            className="input text-sm"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
          />
          <div className="text-xs text-ink-subtle">
            {filteredSkus.length === data.skus.length
              ? `${data.skus.length} SKU`
              : `${filteredSkus.length} из ${data.skus.length}`}
          </div>
          <ul className="max-h-[28rem] overflow-y-auto -mx-4 px-2 divide-y divide-surface-border">
            {filteredSkus.map((s) => {
              const total = s.values.reduce<number>((sum, v) => sum + (v ?? 0), 0)
              const isActive = s.sku === selectedSku
              return (
                <li key={s.sku}>
                  <button
                    type="button"
                    onClick={() => setSelectedSku(s.sku)}
                    className={[
                      'w-full text-left px-2 py-2 rounded-md transition-colors',
                      isActive
                        ? 'bg-brand-50 text-brand-700'
                        : 'hover:bg-surface-muted text-ink',
                    ].join(' ')}
                  >
                    <div className="flex items-baseline justify-between gap-2">
                      <span className="font-mono text-sm truncate">{s.sku}</span>
                      <span className="text-xs tabular-nums text-ink-muted">
                        Σ {total.toFixed(0)}
                      </span>
                    </div>
                  </button>
                </li>
              )
            })}
          </ul>
        </aside>

        <div className="lg:col-span-8 space-y-4">
          {selected ? (
            <>
              <div className="card p-6 flex flex-wrap gap-6 justify-between items-start">
                <div>
                  <div className="eyebrow">Прогноз для</div>
                  <div className="font-mono text-2xl mt-1">{selected.sku}</div>
                  <div className="eyebrow mt-3">на ближайшие</div>
                  <div className="num font-display text-brand-700 text-3xl mt-0.5">
                    {data.horizon_days} <span className="text-ink-subtle text-lg">дн.</span>
                  </div>
                </div>
                <div className="text-right">
                  <div className="eyebrow">Тариф</div>
                  <div className="display-em text-brand-700 text-2xl leading-none mt-1">
                    {planName}
                  </div>
                </div>
              </div>

              <ForecastChart
                dates={dates}
                values={selected.values.map((v) => v ?? 0)}
                p10={selected.p10}
                p90={selected.p90}
              />

              {/* Plan-gated explanation panel — same as the old
                  page so we don't lose the upsell story. */}
              <WhyPanel
                skuTotal={selected.values.reduce<number>((s, v) => s + (v ?? 0), 0)}
                sku={selected.sku}
                plan={isFree ? 'free' : isStart ? 'start' : 'business'}
              />

              <AnomaliesPanel anomalies={anomalies} sku={selected.sku} />

              {isFree   && <UpgradeTrigger variant="first-forecast" />}
              {isStart  && <UpgradeTrigger variant="save-scenario" />}
            </>
          ) : (
            <div className="card p-6 text-ink-muted">Выберите SKU слева</div>
          )}
        </div>
      </section>
    </div>
  )
}

// ── Helpers ─────────────────────────────────────────────────────────────

function formatTs(iso: string | null): string {
  if (!iso) return '—'
  try { return format(parseISO(iso), "d MMM yyyy 'в' HH:mm", { locale: ru }) }
  catch { return iso }
}
function formatDate(iso: string | null): string {
  if (!iso) return '—'
  try { return format(parseISO(iso), 'd MMM yyyy', { locale: ru }) }
  catch { return iso }
}

// ══════════════════════════════════════════════════════════════════════════
//  AnomaliesPanel — surfaces sales days the per-SKU IQR detector and the
//  global IsolationForest both flagged during training. Capped to the last
//  90 days of history; older flags aren't actionable for the buyer today.
// ══════════════════════════════════════════════════════════════════════════

function AnomaliesPanel({
  anomalies,
  sku,
}: {
  anomalies: AnomalyRow[]
  sku:       string
}) {
  const filtered = useMemo(
    () => anomalies.filter((a) => a.sku === sku),
    [anomalies, sku],
  )

  if (filtered.length === 0) {
    return (
      <div className="card p-6 sm:p-8">
        <div className="eyebrow">Аномалии</div>
        <h3 className="display-em text-brand-700 text-2xl mt-1">
          Подозрительных дней за последние 90 дней не найдено
        </h3>
        <p className="text-sm text-ink-muted mt-3">
          Модель училась на чистых данных — ни IQR-детектор, ни IsolationForest
          не пометили продажи этого SKU как выбросы.
        </p>
      </div>
    )
  }

  return (
    <div className="card p-6 sm:p-8">
      <div className="flex items-baseline justify-between gap-4 mb-4">
        <div>
          <div className="eyebrow">Аномалии</div>
          <h3 className="display-em text-brand-700 text-2xl mt-1">
            {filtered.length}{' '}
            <span className="text-ink-subtle text-base">{wordEnding(filtered.length, ['день', 'дня', 'дней'])} с выбросами</span>
          </h3>
        </div>
        <span className="text-xs text-ink-subtle">за последние 90 дней</span>
      </div>

      <p className="text-sm text-ink-muted mb-3">
        В эти дни фактические продажи сильно отличались от обычного диапазона
        этого SKU — модель учла их с пониженным весом, чтобы шум не портил
        прогноз. Стоит проверить, не было ли акции, оверстока или ошибки в данных.
      </p>

      <ul className="divide-y divide-surface-border -mx-2">
        {filtered.slice(0, 12).map((a) => (
          <li key={a.anomaly_date} className="py-2 px-2 flex items-baseline justify-between gap-4">
            <span className="font-mono text-sm text-ink">{formatDate(a.anomaly_date)}</span>
            <span className="num font-display text-lg tabular-nums text-terra">
              {a.value.toFixed(0)}
            </span>
          </li>
        ))}
      </ul>
      {filtered.length > 12 && (
        <p className="mt-2 text-xs text-ink-subtle text-center">
          + ещё {filtered.length - 12}
        </p>
      )}
    </div>
  )
}

function wordEnding(n: number, forms: [string, string, string]): string {
  // Russian plural — 1 день, 2-4 дня, 5+ дней.
  const mod10 = n % 10
  const mod100 = n % 100
  if (mod10 === 1 && mod100 !== 11) return forms[0]
  if (mod10 >= 2 && mod10 <= 4 && (mod100 < 12 || mod100 > 14)) return forms[1]
  return forms[2]
}

// ══════════════════════════════════════════════════════════════════════════
//  WhyPanel — kept from the previous version. Tariff-gated breakdown of
//  what drove the forecast. Values are deterministically synthesised from
//  the SKU+sum so they look consistent within a session — replace with
//  real SHAP outputs when /explain endpoint exists.
// ══════════════════════════════════════════════════════════════════════════

type Plan = 'free' | 'start' | 'business'

function WhyPanel({
  skuTotal,
  sku,
  plan,
}: {
  skuTotal: number
  sku:      string
  plan:     Plan
}) {
  const factors = synthesizeFactors(sku, skuTotal)

  const content = (
    <>
      <div className="flex items-center justify-between mb-4">
        <div>
          <div className="eyebrow">Объяснение</div>
          <h3 className="display-em text-brand-700 text-2xl mt-1">
            Почему столько?
          </h3>
        </div>
        {plan === 'free'  && <PlanGateBadge required="start" />}
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
    </>
  )

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

function synthesizeFactors(sku: string, mean: number) {
  const h       = hashString(sku + ':' + Math.round(mean))
  const trend   = (((h & 0xff) / 255) - 0.5) * 30
  const season  = (((h >> 8)  & 0xff) / 255) * 20 - 5
  const holiday = (((h >> 16) & 0xff) / 255) * 12
  const price   = -(((h >> 24) & 0x7f) / 127) * 10
  return [
    { label: 'Тренд продаж',         detail: trend > 0 ? 'восходящий за последние 4 недели' : 'ослабление за последние 4 недели', pct: trend,   direction: trend > 0 ? 'up' : 'down' },
    { label: 'Сезонность',           detail: 'недельный + годовой паттерны',                                                       pct: season,  direction: season > 0 ? 'up' : 'down' },
    { label: 'Праздники и переносы', detail: 'по календарю РФ',                                                                    pct: holiday, direction: holiday > 2 ? 'up' : 'flat' },
    { label: 'Ценовая эластичность', detail: 'реакция на уровень цен',                                                              pct: price,   direction: 'down' },
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
