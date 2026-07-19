// ADM-2 (#255, Волна 2): «Обучение» — операторский надзор за quality-
// машинерией: кросс-клиентская лента ранов (gate-вердикты подсвечены),
// возраст моделей со stale-подсветкой.
// ADM-v3-4 (#389): running-строка старше stuck_threshold_min (порог из
// backend-ответа — единый источник) подсвечивается «зависла?» + кнопка
// Reconcile (общий #265-механизм, живые джобы скипаются на сервере).
import { useState } from 'react'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { Link } from 'react-router-dom'
import toast from 'react-hot-toast'

import { apiClient, errorMessage } from '../../shared/api/client'
import AdminConfirmDialog, { type ConfirmSpec } from '../../components/AdminConfirmDialog'
import AdminQueryError from './AdminQueryError'
import { ShowMore, SkeletonRows, StateRow, Th } from './adminTable'
import { THEAD_CLS, useSort } from './adminTableUtils'
import { admPath } from '../../shared/hostRouting'

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
  stuck_threshold_min?: number
}

const STALE_DAYS = 45

function isStuck(r: RunRow, thresholdMin: number): boolean {
  if (r.status !== 'running' || !r.started_at) return false
  return Date.now() - new Date(r.started_at).getTime() > thresholdMin * 60_000
}

function GateBadge({ r }: { r: RunRow }) {
  if (r.status !== 'finished') return <span className="badge-neutral">{r.status}</span>
  if (r.gate_passed === false && !r.model_path) return <span className="badge-danger">gate: блок</span>
  if (r.gate_passed === false) return <span className="badge-warn">gate: fail (перв.)</span>
  if (r.gate_passed === true) return <span className="badge-success">gate: pass</span>
  return <span className="badge-neutral">до гейта</span>
}

export default function AdminTrainingPage() {
  const qc = useQueryClient()
  const [limit, setLimit] = useState(50)   // #394-2: «показать ещё», сервер ≤200
  const [confirm, setConfirm] = useState<ConfirmSpec | null>(null)
  const { data, isError, isLoading, refetch } = useQuery({
    queryKey: ['admin-training-oversight', limit],
    queryFn: async () => {
      const { data } = await apiClient.get<Oversight>('/admin/training-runs',
        { params: { limit } })
      return data
    },
    refetchInterval: 60_000,
    meta: { silent: true },
  })
  const sort = useSort(data?.runs ?? [], 'ended_at')

  const reconcileMut = useMutation({
    mutationFn: async () => {
      const { data } = await apiClient.post<{ healed: number }>(
        '/admin/training/reconcile')
      return data
    },
    onSuccess: (r) => {
      toast.success(r.healed
        ? `Исцелено зависших тренировок: ${r.healed}`
        : 'Зависших тренировок не найдено (живые не тронуты)')
      qc.invalidateQueries({ queryKey: ['admin-training-oversight'] })
    },
    onError: (e) => toast.error(errorMessage(e, 'Reconcile не выполнен')),
  })

  const threshold = data?.stuck_threshold_min ?? 90
  const stuckCount = (data?.runs ?? []).filter((r) => isStuck(r, threshold)).length

  const ages = Object.entries(data?.model_age_days ?? {})
    .sort((a, b) => b[1] - a[1])

  return (
    <div className="space-y-6 max-w-5xl">
      {isError && <AdminQueryError what="ленту обучений" onRetry={() => void refetch()} />}
      <section className="card-paper overflow-hidden">
        <div className="px-5 py-3 border-b border-surface-border font-semibold text-sm">
          Возраст моделей
        </div>
        {isError ? (
          <div className="px-5 py-6" aria-hidden />
        ) : !ages.length ? (
          <div className="px-5 py-6 text-sm text-ink-muted">Промоутнутых моделей нет</div>
        ) : (
          <ul className="divide-y divide-surface-border text-sm">
            {ages.map(([cid, days]) => (
              <li key={cid} className="px-5 py-2.5 flex items-center gap-4">
                <Link to={admPath(`/admin/clients/${encodeURIComponent(cid)}`)}
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
        <div className="px-5 py-3 border-b border-surface-border flex items-center justify-between gap-3">
          <span className="font-semibold text-sm">Лента обучений</span>
          <div className="flex items-center gap-3">
            {stuckCount > 0 && (
              <span className="badge-danger">зависших: {stuckCount}</span>
            )}
            <button type="button" className="btn-secondary text-xs"
                    disabled={reconcileMut.isPending}
                    onClick={() => setConfirm({
                      title: 'Reconcile зависших тренировок',
                      body: 'Освобождаются только раны с мёртвым RQ-джобом — живые обучения не затрагиваются.',
                      actionLabel: 'Reconcile',
                      onConfirm: () => reconcileMut.mutate(),
                    })}>
              Reconcile
            </button>
          </div>
        </div>
        {/* #394-2: sticky-шапка + сортировка + три состояния */}
        <div className="overflow-x-auto max-h-[60vh] overflow-y-auto">
          <table className="w-full text-sm">
            <thead className={THEAD_CLS}>
              <tr>
                <Th label="Время" sortKey="ended_at" sort={sort} />
                <Th label="Клиент" sortKey="client_id" sort={sort} />
                <Th label="Вердикт" />
                <Th label="WMAPE" sortKey="wmape" sort={sort} />
                <Th label="Ошибка" />
              </tr>
            </thead>
            <tbody>
              {isLoading ? (
                <SkeletonRows cols={5} />
              ) : isError ? (
                <StateRow cols={5} kind="error" what="ленту обучений" />
              ) : !sort.sorted.length ? (
                <StateRow cols={5} kind="empty" what="обучения" />
              ) : (
                sort.sorted.map((r) => (
                  <tr key={r.run_id}
                      className={`border-b border-surface-border last:border-b-0 ${
                        isStuck(r, threshold) ? 'bg-red-50/50'
                          : r.gate_passed === false && !r.model_path ? 'bg-red-50/50' : ''}`}>
                    <td className="px-4 py-2 text-xs text-ink-muted whitespace-nowrap">
                      {(r.ended_at ?? r.started_at)
                        ? new Date(r.ended_at ?? r.started_at!).toLocaleString('ru-RU') : '—'}
                    </td>
                    <td className="px-4 py-2">
                      <Link to={admPath(`/admin/clients/${encodeURIComponent(r.client_id)}`)}
                            className="font-mono text-xs text-brand-700">{r.client_id}</Link>
                    </td>
                    <td className="px-4 py-2 whitespace-nowrap">
                      {isStuck(r, threshold)
                        ? <span className="badge-danger"
                                title={`running дольше ${threshold} мин — вероятно, джоб мёртв (класс R11-H4)`}>
                            зависла?
                          </span>
                        : <GateBadge r={r} />}
                    </td>
                    <td className="px-4 py-2 font-mono text-xs">
                      {r.wmape != null ? Number(r.wmape).toFixed(3) : '—'}
                    </td>
                    <td className="px-4 py-2 text-xs text-ink-muted max-w-xs truncate">
                      {r.error ?? ''}
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
        {!isLoading && !isError && (data?.runs.length ?? 0) >= limit && (
          <ShowMore shown={limit} step={50} max={200} onMore={setLimit} />
        )}
      </section>
      <AdminConfirmDialog spec={confirm} onClose={() => setConfirm(null)} />
    </div>
  )
}
