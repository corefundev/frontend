import { useMemo } from 'react'
import { Link } from 'react-router-dom'
import { useQuery } from '@tanstack/react-query'

import { useAuthStore } from '../../features/auth/store'
import { trainingApi } from '../../features/training/api'
import {
  RUN_STATUS_BADGE,
  RUN_STATUS_LABEL,
  formatDuration,
  safeFormat,
} from '../../features/training/format'
import { uploadsApi } from '../../features/uploads/api'
import { cabPath } from '../../shared/hostRouting'

export default function TrainingHistoryPage() {
  const clientId = useAuthStore((s) => s.clientId)!

  const { data: history, isLoading } = useQuery({
    queryKey: ['training-runs', clientId, 'history-page'],
    queryFn: () => trainingApi.listRuns(clientId, 100),
    refetchInterval: (q) => {
      // If anything is mid-flight, refresh every 5s so the row
      // transitions queued → running → finished without a manual reload.
      const runs = q.state.data?.runs ?? []
      const live = runs.some((r) => r.status === 'queued' || r.status === 'running')
      return live ? 5000 : false
    },
    // PjaxLoader-silent — see PjaxLoader.tsx predicate.
    meta: { silent: true },
  })

  const { data: uploads = [] } = useQuery({
    queryKey: ['uploads', clientId],
    queryFn: () => uploadsApi.list(clientId),
  })

  const uploadName = useMemo(() => {
    const map = new Map<string, string>()
    for (const u of uploads) map.set(u.upload_id, u.filename)
    return map
  }, [uploads])

  const runs = history?.runs ?? []

  return (
    <div className="space-y-6 max-w-screen-2xl">
      <header className="flex items-baseline justify-between gap-4">
        <div>
          <h2 className="text-base font-semibold text-ink">Все запуски обучения</h2>
          <p className="text-xs text-ink-muted mt-1">
            Запись каждого обучения с метриками, длительностью и статусом.
            Сохраняется дольше, чем оперативный кеш RQ.
          </p>
        </div>
        <Link to={cabPath(cabPath('/app/training'))} className="btn-ghost text-sm whitespace-nowrap">
          ← К обучению
        </Link>
      </header>

      {isLoading && (
        // PJAX top-bar signals the wait; empty card holds layout.
        <section className="card p-5 h-20" aria-hidden="true" />
      )}

      {!isLoading && runs.length === 0 && (
        <section className="card p-8 text-center">
          <p className="text-sm text-ink-muted">
            Пока нет ни одной обученной модели.
          </p>
          <Link to={cabPath(cabPath('/app/training'))} className="btn-primary text-sm mt-4 inline-block">
            Запустить первое обучение
          </Link>
        </section>
      )}

      {!isLoading && runs.length > 0 && (
        <section className="card p-5">
          <div className="flex items-baseline justify-between mb-4">
            <h3 className="text-sm font-semibold text-ink-muted uppercase tracking-wide">
              История запусков
            </h3>
            <span className="text-xs text-ink-subtle">всего: {runs.length}</span>
          </div>

          <div className="overflow-x-auto -mx-5 px-5">
            <table className="w-full text-sm">
              <thead>
                <tr className="text-xs uppercase text-ink-subtle border-b border-surface-border">
                  <th className="text-left  py-2 pr-3 font-medium">Когда</th>
                  <th className="text-left  py-2 pr-3 font-medium">Датасет</th>
                  <th className="text-left  py-2 pr-3 font-medium">Тариф</th>
                  <th className="text-right py-2 pr-3 font-medium">SKU</th>
                  <th className="text-right py-2 pr-3 font-medium">WMAPE</th>
                  <th className="text-right py-2 pr-3 font-medium">MASE</th>
                  <th className="text-right py-2 pr-3 font-medium">Длит.</th>
                  <th className="text-right py-2 font-medium">Статус</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-surface-border">
                {runs.map((r) => {
                  const dsName = r.upload_id
                    ? (uploadName.get(r.upload_id) ?? `${r.upload_id.slice(0, 8)}…`)
                    : '—'
                  return (
                    <tr key={r.run_id} className="hover:bg-surface-muted/40">
                      <td className="py-2 pr-3 text-ink whitespace-nowrap">
                        {safeFormat(r.enqueued_at)}
                      </td>
                      <td className="py-2 pr-3 text-ink truncate max-w-[18rem]" title={dsName}>
                        {dsName}
                      </td>
                      <td className="py-2 pr-3 text-ink-muted text-xs uppercase">{r.plan}</td>
                      <td className="py-2 pr-3 text-right tabular-nums">
                        {r.n_skus ?? '—'}
                      </td>
                      <td className="py-2 pr-3 text-right tabular-nums font-mono">
                        {r.wmape != null ? r.wmape.toFixed(3) : '—'}
                      </td>
                      <td className="py-2 pr-3 text-right tabular-nums font-mono">
                        {r.mase != null ? r.mase.toFixed(3) : '—'}
                      </td>
                      <td className="py-2 pr-3 text-right tabular-nums text-ink-muted">
                        {r.elapsed_sec != null ? formatDuration(r.elapsed_sec) : '—'}
                      </td>
                      <td className="py-2 text-right">
                        <span className={RUN_STATUS_BADGE[r.status] ?? 'badge-neutral'}>
                          {RUN_STATUS_LABEL[r.status] ?? r.status}
                        </span>
                      </td>
                    </tr>
                  )
                })}
              </tbody>
            </table>
          </div>
        </section>
      )}
    </div>
  )
}
