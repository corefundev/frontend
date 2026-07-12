// ADM-13 (#281, Волна 2): «Система» — здоровье компонентов + свежесть
// cron-джобов (источник = pushgateway push_time_seconds, тот же, что у
// Prometheus — страница не может разойтись с алертингом). Grafana/MLflow
// не проксированы наружу — доступ по SSH-туннелю (runbook), без мёртвых
// ссылок.
import { useQuery } from '@tanstack/react-query'

import { apiClient } from '../../shared/api/client'
import AdminQueryError from './AdminQueryError'

interface AlertItem {
  name: string
  severity: string
  state: string      // firing | pending
  active_at: string | null
  summary: string
}

interface AlertsInfo {
  alerts: AlertItem[]
  counts: { firing: number; pending: number }
}

interface SecretAge {
  known: boolean
  reason?: string
  created_at?: string
  rotated_at?: string
  age_days?: number
  max_age_days?: number
  overdue?: boolean
}
interface SystemInfo {
  components: Record<string, string>
  jobs: { job: string; age_sec: number; cadence_sec: number | null; stale: boolean }[]
  models_cached: number
  storage_backend: string
  secrets?: { sa_key: SecretAge; admin_api_key: SecretAge }
}

// ADM-v3-8 #393: строка возраста секрета — warn по порогу, честный
// unknown/error никогда не рендерится зелёным.
function SecretRow({ label, s, hint }: { label: string; s: SecretAge; hint: string }) {
  return (
    <tr className="border-b border-surface-border last:border-b-0">
      <td className="px-5 py-2.5 text-xs">{label}</td>
      <td className="px-3 py-2.5">
        {!s.known ? (
          <span className={s.reason?.startsWith('error') ? 'badge-danger' : 'badge-warn'}>
            {s.reason?.startsWith('error') ? 'ошибка чтения' : 'неизвестен'}
          </span>
        ) : (
          <span className={s.overdue ? 'badge-danger' : 'badge-success'}>
            {s.age_days} дн{s.overdue ? ' — ротация просрочена!' : ''}
          </span>
        )}
      </td>
      <td className="px-3 py-2.5 text-xs text-ink-muted">
        {s.known ? `порог ${s.max_age_days} дн · ${hint}` : (s.reason ?? '')}
      </td>
    </tr>
  )
}

function fmtAge(sec: number): string {
  if (sec < 90) return `${Math.round(sec)} с`
  if (sec < 5400) return `${Math.round(sec / 60)} мин`
  if (sec < 129600) return `${Math.round(sec / 3600)} ч`
  return `${Math.round(sec / 86400)} дн`
}

export default function AdminSystemPage() {
  const { data, isError, refetch } = useQuery({
    queryKey: ['admin-system'],
    queryFn: async () => {
      const { data } = await apiClient.get<SystemInfo>('/admin/system')
      return data
    },
    refetchInterval: 60_000,
    meta: { silent: true },
  })
  // ADM-v3-1 (#386): живое состояние алертов. Отдельный запрос: 503 от
  // Prometheus («состояние неизвестно») не должен ронять остальную
  // страницу — и наоборот.
  const { data: alerts, isError: alertsError, refetch: refetchAlerts } = useQuery({
    queryKey: ['admin-alerts'],
    queryFn: async () => {
      const { data } = await apiClient.get<AlertsInfo>('/admin/alerts')
      return data
    },
    refetchInterval: 45_000,
    meta: { silent: true },
  })

  if (isError) {
    return (
      <div className="max-w-5xl">
        <AdminQueryError what="состояние системы" onRetry={() => void refetch()} />
      </div>
    )
  }
  if (!data) return <div className="h-40" aria-hidden />

  return (
    <div className="space-y-6 max-w-5xl">
      <section className="card-paper overflow-hidden">
        <div className="px-5 py-3 border-b border-surface-border font-semibold text-sm flex items-center gap-2">
          Алерты
          {alerts && alerts.counts.firing > 0 && (
            <span className="badge-danger">{alerts.counts.firing} горит</span>
          )}
          {alerts && alerts.counts.firing === 0 && alerts.counts.pending > 0 && (
            <span className="badge-warn">{alerts.counts.pending} pending</span>
          )}
        </div>
        {alertsError ? (
          <div className="p-4">
            <AdminQueryError what="состояние алертов" onRetry={() => void refetchAlerts()} />
          </div>
        ) : !alerts ? (
          <div className="h-16" aria-hidden />
        ) : !alerts.alerts.length ? (
          <div className="px-5 py-5 text-sm text-ink-muted">
            Не горит ничего. Prometheus опрошен, активных и pending-алертов нет.
          </div>
        ) : (
          <ul className="divide-y divide-surface-border text-sm">
            {alerts.alerts.map((a) => (
              <li key={a.name + a.state} className="px-5 py-2.5 flex items-center gap-3">
                <span className={
                  a.state === 'firing'
                    ? (a.severity === 'critical' ? 'badge-danger' : 'badge-warn')
                    : 'badge-neutral'
                }>
                  {a.state === 'firing' ? a.severity : 'pending'}
                </span>
                <span className="font-mono text-xs">{a.name}</span>
                <span className="text-ink-muted truncate flex-1">{a.summary}</span>
                {a.active_at && (
                  <span className="text-xs text-ink-faint whitespace-nowrap">
                    с {new Date(a.active_at).toLocaleTimeString('ru-RU', { hour: '2-digit', minute: '2-digit' })}
                  </span>
                )}
              </li>
            ))}
          </ul>
        )}
      </section>

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

      {data.secrets && (
        <section className="card-paper overflow-hidden">
          <div className="px-5 py-3 border-b border-surface-border font-semibold text-sm">
            Возраст секретов
          </div>
          <table className="w-full text-sm">
            <tbody>
              <SecretRow label="SA-ключ Lockbox (YC)" s={data.secrets.sa_key}
                         hint="еженедельная ротация (#353)" />
              <SecretRow label="ADMIN_API_KEY" s={data.secrets.admin_api_key}
                         hint="H6-регламент 90 дн (OPERATIONS.md)" />
            </tbody>
          </table>
        </section>
      )}

      <div className="text-xs text-ink-muted">
        Grafana / MLflow / Prometheus не опубликованы наружу — доступ по
        SSH-туннелю (см. deploy/runbook). Детальные дашборды — там.
      </div>
    </div>
  )
}
