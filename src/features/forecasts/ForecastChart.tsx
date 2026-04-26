// src/features/forecasts/ForecastChart.tsx
//
// Small line chart used on ForecastsPage. The backend returns
// `forecast: number[]` + `forecast_dates: string[]` of equal length.
import { useMemo } from 'react'
import {
  CartesianGrid,
  Line,
  LineChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from 'recharts'

interface Props {
  dates: string[]
  values: number[]
  title?: string
  height?: number
}

export function ForecastChart({ dates, values, title, height = 260 }: Props) {
  const data = useMemo(
    () =>
      dates.map((d, i) => ({
        date: d,
        value: values[i] ?? 0,
      })),
    [dates, values],
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
        <LineChart data={data} margin={{ top: 8, right: 16, left: 0, bottom: 8 }}>
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
            formatter={(v: number) => [v.toFixed(2), 'Прогноз']}
          />
          <Line
            type="monotone"
            dataKey="value"
            stroke="#004743"
            strokeWidth={2}
            dot={{ r: 3, fill: '#004743' }}
            activeDot={{ r: 5, fill: '#003E3A' }}
            isAnimationActive={false}
          />
        </LineChart>
      </ResponsiveContainer>
    </div>
  )
}
