// ADM-13 (#281, Волна 2): «Система» — здоровье компонентов + свежесть
// cron-джобов (источник = pushgateway push_time_seconds, тот же, что у
// Prometheus — страница не может разойтись с алертингом). Grafana/MLflow
// не проксированы наружу — доступ по SSH-туннелю (runbook), без мёртвых
// ссылок.
import { useQuery } from '@tanstack/react-query'

import { apiClient } from '../../shared/api/client'

interface SystemInfo {
  components: Record<string, string>
  jobs: { job: string; age_sec: number; cadence_sec: number | null; stale: boolean }[]
  models_cached: number
  storage_backend: string
}

function fmtAge(sec: number): string {
  if (sec < 90) return `${Math.round(sec)} с`
  if (sec < 5400) return `${Math.round(sec / 60)} мин`
  if (sec < 129600) return `${Math.round(sec / 3600)} ч`
  return `${Math.round(sec / 86400)} дн`
}

export default function AdminSystemPage() {
  const { data } = useQuery({
    queryKey: ['admin-system'],
    queryFn: async () => {
      const { data } = await apiClient.get<SystemInfo>('/admin/system')
      return data
    },
    refetchInterval: 60_000,
    meta: { silent: true },
  })

  if (!data) return <div className="h-40" aria-hidden />

  return (
    <div className="space-y-6 max-w-4xl">
      <section className="card-paper p-5">
        <h3 className="font-semibold text-sm mb-3">Компоненты</h3>
        <div className="flex flex-wrap gap-3">
          {Object.entries(data.components).map(([name, st]) => (
            <span key={name}
                  className={st === 'ok' ? 'badge-success' : 'badge-danger'}>
              {name}: {st}
            </span>
          ))}
          <span className="badge-neutral">моделей в кеше: {data.models_cached}</span>
          <span className="badge-neutral">storage: {data.storage_backend}</span>
        </div>
      </section>

      <section className="card-paper overflow-hidden">
        <div className="px-5 py-3 border-b border-surface-border font-semibold text-sm">
          Фоновые задания (последний успешный прогон)
        </div>
        {!data.jobs.length ? (
          <div className="px-5 py-6 text-sm text-ink-muted">
            Метрики недоступны (pushgateway)
          </div>
        ) : (
          <table className="w-full text-sm">
            <tbody>
              {data.jobs.map((j) => (
                <tr key={j.job} className="border-b border-surface-border last:border-b-0">
                  <td className="px-5 py-2.5 font-mono text-xs">{j.job}</td>
                  <td className="px-3 py-2.5">
                    <span className={j.stale ? 'badge-danger' : 'badge-success'}>
                      {fmtAge(j.age_sec)} назад
                    </span>
                  </td>
                  <td className="px-3 py-2.5 text-xs text-ink-muted">
                    {j.cadence_sec ? `каденс ${fmtAge(j.cadence_sec)}` : 'каденс не объявлен'}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </section>

      <div className="text-xs text-ink-muted">
        Grafana / MLflow / Prometheus не опубликованы наружу — доступ по
        SSH-туннелю (см. deploy/runbook). Детальные дашборды — там.
      </div>
    </div>
  )
}
