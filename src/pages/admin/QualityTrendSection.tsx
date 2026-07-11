// ADM-v3-3 (#388): тренд качества клиента — WMAPE/MASE по finished-
// тренировкам + gate-лента. Две малые кратности вместо двойной оси
// (шкалы разные); чемпион (последний promoted run, model_path NOT NULL,
// семантика #248/#268) выделен точкой на графике и в ленте.
import { useMemo } from 'react'
import {
  CartesianGrid, Line, LineChart, ReferenceDot, ResponsiveContainer,
  Tooltip, XAxis, YAxis,
} from 'recharts'

export interface TrendRun {
  run_id: string
  status: string
  ended_at: string | null
  wmape: number | null
  mase: number | null
  gate_passed: boolean | null
  model_path: string | null
}

interface Row {
  idx: number
  date: string
  wmape: number | null
  mase: number | null
  gate: boolean | null
  champion: boolean
}

const GRID = '#E2E8F0'
const BRAND = '#1A4AB8'
const CHAMPION = '#D97706'

function MetricChart({ rows, metric, label }: {
  rows: Row[]; metric: 'wmape' | 'mase'; label: string
}) {
  const champ = rows.find((r) => r.champion && r[metric] != null)
  return (
    <div>
      <div className="text-xs text-ink-muted mb-1">{label}</div>
      <ResponsiveContainer width="100%" height={110}>
        <LineChart data={rows} margin={{ top: 6, right: 8, bottom: 0, left: 0 }}>
          <CartesianGrid strokeDasharray="3 3" stroke={GRID} vertical={false} />
          <XAxis dataKey="date" hide />
          <YAxis
            width={44} tick={{ fontSize: 10, fill: '#64748B' }}
            tickLine={{ stroke: GRID }} axisLine={{ stroke: GRID }}
            domain={['auto', 'auto']} tickFormatter={(v: number) => v.toFixed(2)}
          />
          <Tooltip
            formatter={(v: number) => [v.toFixed(3), label]}
            labelFormatter={(d: string) => d}
            contentStyle={{ fontSize: 12, borderRadius: 8, borderColor: GRID }}
          />
          <Line
            type="monotone" dataKey={metric} stroke={BRAND} strokeWidth={2}
            dot={{ r: 2.5, fill: BRAND, strokeWidth: 0 }} connectNulls
            isAnimationActive={false}
          />
          {champ && (
            <ReferenceDot
              x={champ.date} y={champ[metric] as number} r={5}
              fill={CHAMPION} stroke="#fff" strokeWidth={1.5}
            />
          )}
        </LineChart>
      </ResponsiveContainer>
    </div>
  )
}

// bare (#394-5): рендер без собственной card-обёртки — для таба
// «Качество» карточки-hub
export default function QualityTrendSection({ runs, bare = false }: {
  runs: TrendRun[]; bare?: boolean
}) {
  const { chartRows, ribbonRows } = useMemo(() => {
    // API отдаёт DESC по enqueued_at; чемпион = самый свежий promoted.
    const championId = runs.find(
      (r) => r.status === 'finished' && r.model_path != null)?.run_id
    const toRow = (r: TrendRun, idx: number): Row => ({
      idx,
      date: new Date(r.ended_at as string).toLocaleDateString('ru-RU'),
      wmape: r.wmape,
      mase: r.mase,
      gate: r.gate_passed,
      champion: r.run_id === championId,
    })
    const finished = runs
      .filter((r) => r.status === 'finished' && r.ended_at != null
        && (r.wmape != null || r.mase != null))
      .slice()
      .reverse()
    // ЛИНИЯ — только promoted-чемпионы: реальная линия качества сервиса.
    // Смешивание всех прогонов (эксперименты, gate-блоки) давало «пилу»,
    // не отражающую то, что реально служило прогнозом. Все вердикты —
    // в gate-ленте ниже.
    const promoted = runs
      .filter((r) => r.status === 'finished' && r.ended_at != null
        && r.model_path != null && (r.wmape != null || r.mase != null))
      .slice()
      .reverse()
    return { chartRows: promoted.map(toRow), ribbonRows: finished.map(toRow) }
  }, [runs])

  return (
    <section className={bare ? '' : 'card-paper p-5'}>
      <h3 className="font-semibold text-sm mb-3">Качество модели</h3>
      {ribbonRows.length < 1 ? (
        <div className="text-sm text-ink-muted">
          Завершённых тренировок ещё нет.
        </div>
      ) : (
        <div className="space-y-4">
          {chartRows.length >= 2 ? (
            <div className="grid grid-cols-2 gap-6">
              <MetricChart rows={chartRows} metric="wmape" label="WMAPE (promoted-чемпионы)" />
              <MetricChart rows={chartRows} metric="mase" label="MASE (promoted-чемпионы)" />
            </div>
          ) : (
            <div className="text-sm text-ink-muted">
              Для линии качества нужно ≥ 2 promoted-обучений (gate-блоки и
              эксперименты в линию не входят — они в ленте ниже).
            </div>
          )}
          <div>
            <div className="text-xs text-ink-muted mb-1.5">
              Gate-вердикты ({ribbonRows.length} тренировок, старые → новые;{' '}
              <span className="inline-block w-2 h-2 rounded-full align-middle"
                    style={{ background: CHAMPION }} /> — текущий чемпион)
            </div>
            <div className="flex flex-wrap gap-1">
              {ribbonRows.map((r) => (
                <span
                  key={r.idx}
                  title={`${r.date} · WMAPE ${r.wmape != null ? r.wmape.toFixed(3) : '—'} · ${
                    r.gate === true ? 'gate: pass'
                      : r.gate === false ? 'gate: блок (чемпион сохранён)'
                        : 'до гейта'}${r.champion ? ' · ЧЕМПИОН' : ''}`}
                  className={`h-3.5 rounded-sm ${
                    r.champion ? 'w-3.5 ring-2 ring-offset-1 ring-amber-600' : 'w-2.5'}`}
                  style={{
                    background: r.gate === true ? '#16A34A'
                      : r.gate === false ? '#DC2626' : '#CBD5E1',
                  }}
                />
              ))}
            </div>
          </div>
        </div>
      )}
    </section>
  )
}
