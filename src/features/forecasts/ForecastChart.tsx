// src/features/forecasts/ForecastChart.tsx
//
// Forecast chart for /app/forecasts. Shows the median (P50) forecast
// as a line, with an optional 80% confidence band (P10..P90) drawn as
// a translucent area behind it. The band hides when the model lacks
// quantile sub-models (every value in p10/p90 is null/undefined),
// keeping legacy forecasts that pre-date the v0.8.26 schema migration
// rendering cleanly.
import { useMemo } from 'react'
import {
  Area,
  CartesianGrid,
  ComposedChart,
  Line,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from 'recharts'

interface Props {
  dates:  string[]
  values: number[]
  /** P10 — same length as values, null when missing. */
  p10?:   (number | null | undefined)[]
  /** P90 — same length as values, null when missing. */
  p90?:   (number | null | undefined)[]
  title?: string
  height?: number
}

interface ChartRow {
  date:  string
  value: number
  /** Lower edge of the band — passed to <Area> as the BASELINE. */
  p10:   number | null
  /** Width of the band on top of p10 — that's what <Area> renders. */
  band:  number | null
}

export function ForecastChart({
  dates, values, p10, p90, title, height = 280,
}: Props) {
  const data: ChartRow[] = useMemo(
    () =>
      dates.map((d, i) => {
        const lo = p10?.[i]
        const hi = p90?.[i]
        const hasBand = lo != null && hi != null && hi >= lo
        return {
          date:  d,
          value: values[i] ?? 0,
          p10:   hasBand ? lo : null,
          band:  hasBand ? hi - lo : null,
        }
      }),
    [dates, values, p10, p90],
  )

  // Hide the ribbon entirely when no point in the series has band data.
  const showBand = useMemo(
    () => data.some((r) => r.p10 !== null && r.band !== null),
    [data],
  )

  if (!data.length) {
    return (
      <div className="card p-6 text-ink-muted text-sm text-center">
        Нет данных для графика
      </div>
    )
  }

  return (
    <div className="card p-5">
      {title && (
        <h3 className="text-sm font-semibold text-ink-muted uppercase tracking-wide mb-3">
          {title}
        </h3>
      )}
      <ResponsiveContainer width="100%" height={height}>
        <ComposedChart data={data} margin={{ top: 8, right: 16, left: 0, bottom: 8 }}>
          <CartesianGrid strokeDasharray="3 3" stroke="#E2E5E5" />
          <XAxis
            dataKey="date"
            tick={{ fill: '#525757', fontSize: 12 }}
            tickLine={{ stroke: '#E2E5E5' }}
            axisLine={{ stroke: '#E2E5E5' }}
          />
          <YAxis
            tick={{ fill: '#525757', fontSize: 12 }}
            tickLine={{ stroke: '#E2E5E5' }}
            axisLine={{ stroke: '#E2E5E5' }}
            width={48}
          />
          <Tooltip
            contentStyle={{
              background: '#FFFFFF',
              border: '1px solid #E2E5E5',
              borderRadius: 8,
              boxShadow: '0 4px 12px rgba(0,43,41,0.08)',
              fontSize: 12,
            }}
            labelStyle={{ color: '#1A1A1A', fontWeight: 600 }}
            formatter={(value, name, item) => {
              const v = typeof value === 'number' ? value : Number(value) || 0
              // Hide the invisible stacked baseline used for the band trick.
              if (name === '__baseline__') return ['', ''] as [string, string]
              if (name === 'Прогноз') return [v.toFixed(2), 'Прогноз (P50)']
              if (name === 'Диапазон 80%') {
                // recharts types `item.payload` as optional/any; cast
                // through unknown to our row shape so we can read
                // p10/band without TS yelling.
                const row = (item?.payload as unknown) as ChartRow | undefined
                const lo = row?.p10 ?? 0
                const hi = lo + (row?.band ?? 0)
                return [`${lo.toFixed(2)} – ${hi.toFixed(2)}`, 'Диапазон 80% (P10–P90)']
              }
              return [v.toFixed(2), String(name)]
            }}
          />

          {/* The 80% confidence band — drawn first so the line stacks
              on top. Stacked Area trick: baseline=p10, height=band so
              the visible area covers [p10, p10 + band] = [p10, p90].
              The invisible baseline gets the magic name '__baseline__'
              which the tooltip formatter strips out. */}
          {showBand && (
            <>
              <Area
                type="monotone"
                dataKey="p10"
                stackId="band"
                stroke="none"
                fill="transparent"
                isAnimationActive={false}
                legendType="none"
                name="__baseline__"
              />
              <Area
                type="monotone"
                dataKey="band"
                stackId="band"
                stroke="none"
                fill="#004743"
                fillOpacity={0.12}
                isAnimationActive={false}
                name="Диапазон 80%"
              />
            </>
          )}

          <Line
            type="monotone"
            dataKey="value"
            stroke="#004743"
            strokeWidth={2}
            dot={{ r: 3, fill: '#004743' }}
            activeDot={{ r: 5, fill: '#003E3A' }}
            isAnimationActive={false}
            name="Прогноз"
          />
        </ComposedChart>
      </ResponsiveContainer>

      {showBand && (
        <p className="mt-2 text-xs text-ink-subtle text-center">
          Полупрозрачная полоса — 80% доверительный диапазон (P10–P90).
          В нём с вероятностью 4 из 5 окажется фактическая продажа.
        </p>
      )}
    </div>
  )
}
