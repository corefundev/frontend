// ADM-2 (#255, Волна 2): «Обучение» — операторский надзор за quality-
// машинерией: кросс-клиентская лента ранов (gate-вердикты подсвечены),
// возраст моделей со stale-подсветкой. Read-only v1.
import { useQuery } from '@tanstack/react-query'
import { Link } from 'react-router-dom'

import { apiClient } from '../../shared/api/client'

interface RunRow {
  run_id: string
  client_id: string
  status: string
  ended_at: string | null
  started_at: string | null
  wmape: number | null
  mase: number | null
  gate_passed: boolean | null
  model_path: string | null
  error: string | null
}

interface Oversight {
  runs: RunRow[]
  model_age_days: Record<string, number>
  count: number
}

const STALE_DAYS = 45

function GateBadge({ r }: { r: RunRow }) {
  if (r.status !== 'finished') return <span className="badge-neutral">{r.status}</span>
  if (r.gate_passed === false && !r.model_path) return <span className="badge-danger">gate: блок</span>
  if (r.gate_passed === false) return <span className="badge-warn">gate: fail (перв.)</span>
  if (r.gate_passed === true) return <span className="badge-success">gate: pass</span>
  return <span className="badge-neutral">до гейта</span>
}

export default function AdminTrainingPage() {
  const { data } = useQuery({
    queryKey: ['admin-training-oversight'],
    queryFn: async () => {
      const { data } = await apiClient.get<Oversight>('/admin/training-runs',
        { params: { limit: 50 } })
      return data
    },
    refetchInterval: 60_000,
    meta: { silent: true },
  })

  const ages = Object.entries(data?.model_age_days ?? {})
    .sort((a, b) => b[1] - a[1])

  return (
    <div className="space-y-6 max-w-5xl">
      <section className="card-paper overflow-hidden">
        <div className="px-5 py-3 border-b border-surface-border font-semibold text-sm">
          Возраст моделей
        </div>
        {!ages.length ? (
          <div className="px-5 py-6 text-sm text-ink-muted">Промоутнутых моделей нет</div>
        ) : (
          <ul className="divide-y divide-surface-border text-sm">
            {ages.map(([cid, days]) => (
              <li key={cid} className="px-5 py-2.5 flex items-center gap-4">
                <Link to={`/admin/clients/${encodeURIComponent(cid)}`}
                      className="font-mono text-brand-700">{cid}</Link>
                <span className={days > STALE_DAYS ? 'badge-danger' : 'badge-neutral'}>
                  {days} дн.
                </span>
                {days > STALE_DAYS && (
                  <span className="text-xs text-ink-muted">
                    stale — клиенту отправлен nudge (NC-3)
                  </span>
                )}
              </li>
            ))}
          </ul>
        )}
      </section>

      <section className="card-paper overflow-hidden">
        <div className="px-5 py-3 border-b border-surface-border flex items-baseline justify-between">
          <span className="font-semibold text-sm">Лента обучений</span>
          <span className="text-xs text-ink-muted">read-only · v2-действия — по дорожной карте</span>
        </div>
        {!data?.runs?.length ? (
          <div className="px-5 py-6 text-sm text-ink-muted">Пусто</div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <tbody>
                {data.runs.map((r) => (
                  <tr key={r.run_id}
                      className={`border-b border-surface-border last:border-b-0 ${
                        r.gate_passed === false && !r.model_path ? 'bg-red-50/50' : ''}`}>
                    <td className="px-5 py-2.5 text-xs text-ink-muted whitespace-nowrap">
                      {(r.ended_at ?? r.started_at)
                        ? new Date(r.ended_at ?? r.started_at!).toLocaleString('ru-RU') : '—'}
                    </td>
                    <td className="px-3 py-2.5">
                      <Link to={`/admin/clients/${encodeURIComponent(r.client_id)}`}
                            className="font-mono text-xs text-brand-700">{r.client_id}</Link>
                    </td>
                    <td className="px-3 py-2.5"><GateBadge r={r} /></td>
                    <td className="px-3 py-2.5 font-mono text-xs">
                      {r.wmape != null ? `WMAPE ${Number(r.wmape).toFixed(3)}` : '—'}
                    </td>
                    <td className="px-3 py-2.5 text-xs text-ink-muted max-w-xs truncate">
                      {r.error ?? ''}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </section>
    </div>
  )
}
