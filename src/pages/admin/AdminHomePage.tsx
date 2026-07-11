// ADM-4 (#257, Волна 2): «Обзор» — операционный дашборд. Композиция
// существующих admin-endpoint'ов — свой backend не нужен.
// ADM-v3-9 (#394-5, прототип 1:1): KPI-ряд (Клиенты / Обучения 7д /
// WMAPE-медиана / Свежесть бэкапа) + «Требует внимания» (severity-полоса
// слева, hover-действие, чип справа) + «Последние обучения». Спарклайны
// прототипа не рисуем там, где нет реальной истории — никаких
// иллюстративных данных (честность > декорация).
import { useMemo } from 'react'
import { useQuery } from '@tanstack/react-query'
import { Link } from 'react-router-dom'

import { apiClient } from '../../shared/api/client'
import { clientsApi } from '../../features/clients/api'
import { adminNotificationsApi } from '../../features/notifications/api'
import AdminQueryError from './AdminQueryError'

const STALE_DAYS = 45
const WINDOW_DAYS = 7

interface RunRow {
  run_id: string; client_id: string; status: string
  ended_at: string | null; started_at: string | null
  wmape: number | null
  gate_passed: boolean | null; model_path: string | null
}

interface Attention {
  severity: 'high' | 'warn'
  text: string
  sub?: string
  chip: string
  action: string
  to: string
}

function Kpi({ label, value, unit, foot, chip, to, danger }: {
  label: string; value: string; unit?: string; foot: string
  chip?: { tone: 'ok' | 'danger'; text: string }
  to: string; danger?: boolean
}) {
  return (
    <Link to={to} className="card-paper p-4 pb-3 flex flex-col gap-0.5 hover:shadow-md transition-shadow">
      <span className="text-[11.5px] font-semibold tracking-wide text-ink-muted">{label}</span>
      <span className={`text-[26px] font-semibold tracking-tight leading-tight tabular-nums ${
        danger ? 'text-danger' : ''}`}>
        {value}{unit && <span className="text-[13px] font-medium text-ink-subtle ml-0.5">{unit}</span>}
      </span>
      <div className="flex items-center justify-between gap-2 mt-1 text-[11.5px] text-ink-subtle">
        <span className="truncate">{foot}</span>
        {chip && (
          <span className={`whitespace-nowrap ${chip.tone === 'ok' ? 'badge-success' : 'badge-danger'}`}>{chip.text}</span>
        )}
      </div>
    </Link>
  )
}

export default function AdminHomePage() {
  // AUD-12 (#364): the dashboard's KPIs + «Требует внимания» derive from
  // these queries — a failed one must render as an OUTAGE, never as
  // zeros + «Всё спокойно» (a 503 disguised as all-clear on an ops console).
  const { data: clients = [], isError: clientsError, refetch: refetchClients } = useQuery({
    queryKey: ['admin-clients'], queryFn: () => clientsApi.list(),
  })
  const { data: oversight, isError: oversightError, refetch: refetchOversight } = useQuery({
    queryKey: ['admin-training-oversight', 50],
    queryFn: async () => {
      const { data } = await apiClient.get<{
        runs: RunRow[]; model_age_days: Record<string, number>
        stuck_threshold_min?: number
      }>('/admin/training-runs', { params: { limit: 50 } })
      return data
    },
    refetchInterval: 60_000,
    meta: { silent: true },
  })
  const { data: system } = useQuery({
    queryKey: ['admin-system'],
    queryFn: async () => {
      const { data } = await apiClient.get<{
        jobs: { job: string; age_sec: number; stale: boolean }[]
      }>('/admin/system')
      return data
    },
    refetchInterval: 60_000,
    meta: { silent: true },
    retry: 1,
  })
  const { isError: historyError, refetch: refetchHistory } = useQuery({
    queryKey: ['admin-notifications-history'],
    queryFn: () => adminNotificationsApi.history(5),
  })
  const anyError = clientsError || oversightError || historyError
  const retryAll = () => {
    if (clientsError) void refetchClients()
    if (oversightError) void refetchOversight()
    if (historyError) void refetchHistory()
  }

  const { week, attention, wmapeMedian, wmapeN, lastRuns } = useMemo(() => {
    const cutoff = Date.now() - WINDOW_DAYS * 86_400_000
    const threshold = oversight?.stuck_threshold_min ?? 90
    const runs = oversight?.runs ?? []
    const recent = runs.filter((r) => {
      const t = r.ended_at ?? r.started_at
      return t != null && new Date(t).getTime() >= cutoff
    })
    const week = {
      finished: recent.filter((r) => r.status === 'finished' && r.model_path).length,
      blocked:  recent.filter((r) => r.gate_passed === false && !r.model_path).length,
      failed:   recent.filter((r) => r.status === 'failed').length,
    }
    // Медиана WMAPE по finished-обучениям в ленте (реальные числа, без
    // иллюстративных дельт)
    const wmapes = runs.filter((r) => r.status === 'finished' && r.wmape != null)
      .map((r) => r.wmape as number).sort((a, b) => a - b)
    const wmapeMedian = wmapes.length
      ? wmapes[Math.floor(wmapes.length / 2)] : null
    const staleList = Object.entries(oversight?.model_age_days ?? {})
      .filter(([, d]) => d > STALE_DAYS)
      .sort((a, b) => b[1] - a[1])

    const attention: Attention[] = []
    for (const r of runs.filter((x) => x.status === 'running' && x.started_at
      && Date.now() - new Date(x.started_at).getTime() > threshold * 60_000)) {
      const mins = Math.round((Date.now() - new Date(r.started_at as string).getTime()) / 60000)
      attention.push({ severity: 'high', to: '/admin/training',
        text: `Обучение «${r.client_id}» выполняется ${mins} минут`,
        sub: `run ${r.run_id.slice(0, 6)} · порог ${threshold} мин`,
        chip: 'зависла?', action: 'Reconcile' })
    }
    for (const r of recent.filter((x) => x.gate_passed === false && !x.model_path))
      attention.push({ severity: 'high', to: '/admin/training',
        text: `Гейт заблокировал обучение «${r.client_id}»`,
        sub: 'чемпион продолжает работать', chip: 'gate-блок', action: 'Обучение' })
    for (const [cid, days] of staleList)
      attention.push({ severity: 'warn', to: `/admin/clients/${encodeURIComponent(cid)}`,
        text: `Модель «${cid}» устарела: ${days} дней`,
        sub: 'nudge отправлен (NC-3)', chip: `${days} дн`, action: 'Карточка' })
    for (const c of clients.filter((x) => x.suspended_at))
      attention.push({ severity: 'warn', to: `/admin/clients/${encodeURIComponent(c.client_id)}`,
        text: `Клиент «${c.client_id}» заблокирован оператором`,
        chip: 'заблокирован', action: 'Карточка' })
    for (const r of recent.filter((x) => x.status === 'failed'))
      attention.push({ severity: 'warn', to: '/admin/training',
        text: `Обучение «${r.client_id}» завершилось ошибкой`,
        chip: 'ошибка', action: 'Обучение' })
    attention.sort((a, b) => (a.severity === b.severity ? 0 : a.severity === 'high' ? -1 : 1))

    const lastRuns = runs
      .filter((r) => r.status === 'finished' || r.status === 'failed')
      .slice(0, 5)
    return { week, attention, wmapeMedian, wmapeN: wmapes.length, lastRuns }
  }, [oversight, clients])

  const byPlan = clients.reduce<Record<string, number>>((acc, c) => {
    acc[c.plan] = (acc[c.plan] ?? 0) + 1
    return acc
  }, {})
  const suspended = clients.filter((c) => c.suspended_at).length
  const backup = (system?.jobs ?? []).find((j) => j.job === 'backup')
  const fmtAge = (sec: number) =>
    sec < 5400 ? `${Math.round(sec / 60)} мин` : `${Math.round(sec / 3600)} ч`

  return (
    <div className="space-y-4 max-w-5xl">
      {anyError && <AdminQueryError what="данные дашборда" onRetry={retryAll} />}

      {/* ── KPI-ряд (прототип) ── */}
      <div className="grid grid-cols-4 gap-3">
        <Kpi label="Клиенты" value={String(clients.length)} to="/admin/clients"
             foot={`${Object.entries(byPlan).map(([p, n]) => `${p}: ${n}`).join(' · ') || '—'} · заблок.: ${suspended}`} />
        <Kpi label={`Обучений за ${WINDOW_DAYS} дней`} value={String(week.finished)} to="/admin/training"
             foot={`gate-блоков: ${week.blocked} · ошибок: ${week.failed}`} />
        <Kpi label="Точность (WMAPE, медиана)" to="/admin/training"
             value={wmapeMedian != null ? wmapeMedian.toFixed(2) : '—'}
             foot={wmapeMedian != null ? `по ${wmapeN} обучениям в ленте` : 'нет завершённых обучений'} />
        <Kpi label="Свежесть бэкапа" to="/admin/system"
             value={backup ? fmtAge(backup.age_sec).split(' ')[0] : '—'}
             unit={backup ? fmtAge(backup.age_sec).split(' ')[1] : undefined}
             foot={backup ? 'dump · подробнее в «Системе»' : 'метрика недоступна'}
             chip={backup ? (backup.stale
               ? { tone: 'danger', text: 'отстаёт' }
               : { tone: 'ok', text: 'в норме' }) : undefined}
             danger={backup?.stale} />
      </div>

      <div className="grid grid-cols-[1.5fr_1fr] gap-3 items-start">
        {/* ── Требует внимания (severity-полоса + hover-действие + чип) ── */}
        <section className="card-paper overflow-hidden">
          <div className="px-4 py-2.5 border-b border-surface-border flex items-baseline justify-between">
            <span className="font-semibold text-[13px]">Требует внимания</span>
            <span className="text-[11.5px] text-ink-subtle">
              {attention.length ? `${attention.length} пункт(а)` : ''}
            </span>
          </div>
          {anyError ? (
            <div className="px-4 py-6 text-sm text-danger">
              Состояние неизвестно — данные не загрузились. Это не «всё спокойно».
            </div>
          ) : !attention.length ? (
            <div className="px-4 py-6 text-sm text-ink-muted">
              Всё спокойно — проблем за последние {WINDOW_DAYS} дн. не найдено.
            </div>
          ) : (
            <ul>
              {attention.map((a, i) => (
                <li key={i}
                    className={`group flex items-center gap-3 pl-3 pr-4 py-2.5 border-b border-surface-border last:border-b-0 border-l-[3px] hover:bg-surface-muted/60 transition-colors ${
                      a.severity === 'high' ? 'border-l-danger' : 'border-l-warn'}`}>
                  <div className="flex-1 text-[13px]">
                    {a.text}
                    {a.sub && <div className="text-[11.5px] text-ink-subtle mt-px">{a.sub}</div>}
                  </div>
                  <Link to={a.to}
                        className="btn-secondary text-[11.5px] py-1 opacity-0 group-hover:opacity-100 focus-visible:opacity-100 transition-opacity">
                    {a.action}
                  </Link>
                  <span className={a.severity === 'high' ? 'badge-danger' : 'badge-warn'}>{a.chip}</span>
                </li>
              ))}
            </ul>
          )}
        </section>

        {/* ── Последние обучения (прототип, правая колонка) ── */}
        <section className="card-paper overflow-hidden">
          <div className="px-4 py-2.5 border-b border-surface-border font-semibold text-[13px]">
            Последние обучения
          </div>
          {!lastRuns.length ? (
            <div className="px-4 py-6 text-sm text-ink-muted">Обучений пока не было</div>
          ) : (
            <table className="w-full text-[13px]">
              <tbody>
                {lastRuns.map((r) => (
                  <tr key={r.run_id} className="border-b border-surface-border last:border-b-0 hover:bg-surface-muted/60">
                    <td className="px-4 py-2">
                      <Link to={`/admin/clients/${encodeURIComponent(r.client_id)}`}
                            className="font-mono text-xs text-brand-700">{r.client_id}</Link>
                    </td>
                    <td className="px-2 py-2">
                      {r.status === 'failed'
                        ? <span className="badge-danger">ошибка</span>
                        : r.gate_passed === false && !r.model_path
                          ? <span className="badge-warn">gate-блок</span>
                          : <span className="badge-success">завершено</span>}
                    </td>
                    <td className="px-2 py-2 text-right font-mono text-xs tabular-nums">
                      {r.wmape != null ? r.wmape.toFixed(3) : '—'}
                    </td>
                    <td className="px-4 py-2 text-right text-xs text-ink-subtle whitespace-nowrap">
                      {r.ended_at ? new Date(r.ended_at).toLocaleDateString('ru-RU') : '—'}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </section>
      </div>
    </div>
  )
}
