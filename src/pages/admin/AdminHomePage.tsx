// ADM-4 (#257, Волна 2): «Обзор» — операционный дашборд. Композиция
// существующих admin-endpoint'ов (клиенты / лента обучений+возраст /
// история анонсов) — свой backend не нужен. «Требует внимания» —
// ранжированный список реальных проблем со ссылками в разделы.
// KPI «ошибки загрузок» появится с ADM-6 (Данные, Волна 3).
import { useMemo } from 'react'
import { useQuery } from '@tanstack/react-query'
import { Link } from 'react-router-dom'

import { apiClient } from '../../shared/api/client'
import { clientsApi } from '../../features/clients/api'
import { adminNotificationsApi } from '../../features/notifications/api'

const STALE_DAYS = 45
const WINDOW_DAYS = 7

interface RunRow {
  run_id: string; client_id: string; status: string
  ended_at: string | null; started_at: string | null
  gate_passed: boolean | null; model_path: string | null
}

interface Attention {
  severity: 'high' | 'warn'
  text: string
  to: string
}

export default function AdminHomePage() {
  const { data: clients = [] } = useQuery({
    queryKey: ['admin-clients'], queryFn: () => clientsApi.list(),
  })
  const { data: oversight } = useQuery({
    queryKey: ['admin-training-oversight'],
    queryFn: async () => {
      const { data } = await apiClient.get<{
        runs: RunRow[]; model_age_days: Record<string, number>
      }>('/admin/training-runs', { params: { limit: 50 } })
      return data
    },
    refetchInterval: 60_000,
    meta: { silent: true },
  })
  const { data: history } = useQuery({
    queryKey: ['admin-notifications-history'],
    queryFn: () => adminNotificationsApi.history(5),
  })

  const { week, attention, staleList } = useMemo(() => {
    const cutoff = Date.now() - WINDOW_DAYS * 86_400_000
    const recent = (oversight?.runs ?? []).filter((r) => {
      const t = r.ended_at ?? r.started_at
      return t != null && new Date(t).getTime() >= cutoff
    })
    const week = {
      finished: recent.filter((r) => r.status === 'finished' && r.model_path).length,
      blocked:  recent.filter((r) => r.gate_passed === false && !r.model_path).length,
      failed:   recent.filter((r) => r.status === 'failed').length,
    }
    const staleList = Object.entries(oversight?.model_age_days ?? {})
      .filter(([, d]) => d > STALE_DAYS)
      .sort((a, b) => b[1] - a[1])

    const attention: Attention[] = []
    for (const r of recent.filter((x) => x.gate_passed === false && !x.model_path))
      attention.push({ severity: 'high', to: '/admin/training',
        text: `Гейт заблокировал обучение «${r.client_id}» — чемпион продолжает работать` })
    for (const [cid, days] of staleList)
      attention.push({ severity: 'warn', to: `/admin/clients/${encodeURIComponent(cid)}`,
        text: `Модель «${cid}» устарела: ${days} дн. (nudge отправлен, NC-3)` })
    for (const c of clients.filter((x) => x.suspended_at))
      attention.push({ severity: 'warn', to: `/admin/clients/${encodeURIComponent(c.client_id)}`,
        text: `Клиент «${c.client_id}» заблокирован оператором` })
    for (const r of recent.filter((x) => x.status === 'failed'))
      attention.push({ severity: 'warn', to: '/admin/training',
        text: `Обучение «${r.client_id}» завершилось ошибкой` })
    attention.sort((a, b) => (a.severity === b.severity ? 0 : a.severity === 'high' ? -1 : 1))
    return { week, attention, staleList }
  }, [oversight, clients])

  const byPlan = clients.reduce<Record<string, number>>((acc, c) => {
    acc[c.plan] = (acc[c.plan] ?? 0) + 1
    return acc
  }, {})

  return (
    <div className="space-y-6 max-w-5xl">
      <div className="grid grid-cols-4 gap-4">
        <Link to="/admin/clients" className="card-paper p-5 hover:shadow-md transition-shadow">
          <div className="text-3xl font-semibold tracking-tight">{clients.length}</div>
          <div className="text-sm text-ink-muted mt-1">Клиентов</div>
          <div className="text-xs text-ink-faint mt-2">
            {Object.entries(byPlan).map(([p, n]) => `${p}: ${n}`).join(' · ') || '—'}
            {clients.some((c) => c.suspended_at) &&
              ` · заблок.: ${clients.filter((c) => c.suspended_at).length}`}
          </div>
        </Link>
        <Link to="/admin/training" className="card-paper p-5 hover:shadow-md transition-shadow">
          <div className="text-3xl font-semibold tracking-tight">{week.finished}</div>
          <div className="text-sm text-ink-muted mt-1">Обучений за 7 дн.</div>
          <div className="text-xs text-ink-faint mt-2">
            gate-блоков: {week.blocked} · ошибок: {week.failed}
          </div>
        </Link>
        <Link to="/admin/training" className="card-paper p-5 hover:shadow-md transition-shadow">
          <div className={`text-3xl font-semibold tracking-tight ${staleList.length ? 'text-red-600' : ''}`}>
            {staleList.length}
          </div>
          <div className="text-sm text-ink-muted mt-1">Устаревших моделей</div>
          <div className="text-xs text-ink-faint mt-2">порог {STALE_DAYS} дн.</div>
        </Link>
        <Link to="/admin/notifications" className="card-paper p-5 hover:shadow-md transition-shadow">
          <div className="text-3xl font-semibold tracking-tight">{history?.count ?? '—'}</div>
          <div className="text-sm text-ink-muted mt-1">Последние анонсы</div>
          <div className="text-xs text-ink-faint mt-2 truncate">
            {history?.notifications?.[0]?.title ?? 'пока не отправлялись'}
          </div>
        </Link>
      </div>

      <section className="card-paper overflow-hidden">
        <div className="px-5 py-3 border-b border-surface-border font-semibold text-sm">
          Требует внимания
        </div>
        {!attention.length ? (
          <div className="px-5 py-6 text-sm text-ink-muted">
            Всё спокойно — проблем за последние {WINDOW_DAYS} дн. не найдено.
          </div>
        ) : (
          <ul className="divide-y divide-surface-border text-sm">
            {attention.map((a, i) => (
              <li key={i}>
                <Link to={a.to} className="flex items-center gap-3 px-5 py-2.5 hover:bg-surface-muted/50">
                  <span className={a.severity === 'high' ? 'badge-danger' : 'badge-warn'}>
                    {a.severity === 'high' ? 'важно' : 'внимание'}
                  </span>
                  <span>{a.text}</span>
                </Link>
              </li>
            ))}
          </ul>
        )}
      </section>

      <div className="text-xs text-ink-muted">
        Здоровье сервисов, версии и бэкапы — раздел «Система» (ADM-13, в работе);
        ошибки загрузок — «Данные» (ADM-6, Волна 3).
      </div>
    </div>
  )
}
