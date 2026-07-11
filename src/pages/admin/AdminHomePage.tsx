// ADM-4 (#257, Волна 2): «Обзор» — операционный дашборд. Композиция
// существующих admin-endpoint'ов — свой backend не нужен.
// ADM-v3-9 (#394-5, прототип 1:1): KPI-ряд (Клиенты / Обучения 7д /
// WMAPE-медиана / Свежесть бэкапа) + «Требует внимания» (severity-полоса
// слева, hover-действие, чип справа) + «Последние обучения». Спарклайны
// прототипа не рисуем там, где нет реальной истории — никаких
// иллюстративных данных (честность > декорация).
import type React from 'react'
import { useMemo } from 'react'
import { useQuery } from '@tanstack/react-query'
import { Link } from 'react-router-dom'

import { apiClient } from '../../shared/api/client'
import { clientsApi } from '../../features/clients/api'
import { adminNotificationsApi } from '../../features/notifications/api'
import AdminQueryError from './AdminQueryError'

const STALE_DAYS = 45
const WINDOW_DAYS = 7

function plural(n: number, one: string, few: string, many: string): string {
  const m10 = n % 10, m100 = n % 100
  if (m10 === 1 && m100 !== 11) return one
  if (m10 >= 2 && m10 <= 4 && (m100 < 12 || m100 > 14)) return few
  return many
}

// относительное время прототипа: сегодня / вчера / N дн / дата
function relWhen(iso: string): string {
  const d = Math.floor((Date.now() - new Date(iso).getTime()) / 86_400_000)
  if (d <= 0) return 'сегодня'
  if (d === 1) return 'вчера'
  if (d < 30) return `${d} дн`
  return new Date(iso).toLocaleDateString('ru-RU')
}

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

// #394: мини-спарклайн прототипа — только для РЕАЛЬНЫХ рядов (никаких
// иллюстративных данных); 72×22, линия + точка на конце.
function Spark({ points, tone }: { points: number[]; tone: 'brand' | 'ok' }) {
  if (points.length < 2) return null
  const min = Math.min(...points)
  const max = Math.max(...points)
  const span = max - min || 1
  const xs = points.map((v, i) => [
    (i / (points.length - 1)) * 72,
    19 - ((v - min) / span) * 15,
  ])
  const color = tone === 'ok' ? 'rgb(var(--success))' : 'var(--admin-brand)'
  const last = xs[xs.length - 1]
  return (
    <svg width="72" height="22" viewBox="0 0 72 22" aria-hidden className="shrink-0">
      <polyline points={xs.map(([x, y]) => `${x.toFixed(1)},${y.toFixed(1)}`).join(' ')}
                fill="none" stroke={color} strokeWidth="2" strokeLinecap="round"
                strokeLinejoin="round" />
      <circle cx={last[0]} cy={last[1]} r="2.6" fill={color} />
    </svg>
  )
}

function Kpi({ label, value, unit, foot, chip, spark, to, danger }: {
  label: string; value: string; unit?: string; foot: React.ReactNode
  chip?: { tone: 'ok' | 'danger'; text: string }
  spark?: { points: number[]; tone: 'brand' | 'ok' }
  to: string; danger?: boolean
}) {
  return (
    <Link to={to} className="card-paper kpi-hover p-4 pb-3 flex flex-col gap-0.5 transition-[box-shadow,--tw-ring-color]">
      <span className="text-[11.5px] font-semibold tracking-wide text-ink-muted">{label}</span>
      <span className={`text-[26px] font-semibold tracking-tight leading-tight tabular-nums ${
        danger ? 'text-danger' : ''}`}>
        {value}{unit && <span className="text-[13px] font-medium text-ink-subtle ml-0.5">{unit}</span>}
      </span>
      <div className="flex items-center justify-between gap-2 mt-1 text-[11.5px] text-ink-subtle">
        <span className="truncate">{foot}</span>
        {spark && <Spark points={spark.points} tone={spark.tone} />}
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

  const { week, attention, wmapeMedian, wmapeN, monthDelta, lastRuns, perDay,
          wmapeSeries } = useMemo(() => {
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
    // Медиана WMAPE по finished-обучениям в ленте (реальные числа) +
    // прототипная дельта «за месяц»: медиана последних 30 дней против
    // предыдущих 30 — только если есть ОБЕ выборки (без выдумок)
    const median = (xs: number[]) => {
      if (!xs.length) return null
      const s2 = [...xs].sort((a, b) => a - b)
      return s2[Math.floor(s2.length / 2)]
    }
    const finishedW = runs.filter((r) => r.status === 'finished' && r.wmape != null)
    const wmapes = finishedW.map((r) => r.wmape as number)
    const wmapeMedian = median(wmapes)
    const tRun = (r: RunRow) => new Date((r.ended_at ?? r.started_at) as string).getTime()
    const m0 = Date.now() - 30 * 86_400_000
    const m1 = Date.now() - 60 * 86_400_000
    const curM = median(finishedW.filter((r) => tRun(r) >= m0).map((r) => r.wmape as number))
    const prevM = median(finishedW.filter((r) => tRun(r) >= m1 && tRun(r) < m0).map((r) => r.wmape as number))
    const monthDelta = curM != null && prevM != null ? curM - prevM : null
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
    // реальные ряды для спарклайнов прототипа: обучения по дням окна и
    // WMAPE по прогонам (хронологически)
    const perDay: number[] = Array.from({ length: WINDOW_DAYS }, (_, i) => {
      const d0 = Date.now() - (WINDOW_DAYS - i) * 86_400_000
      const d1 = d0 + 86_400_000
      return runs.filter((r) => {
        const t = r.ended_at ? new Date(r.ended_at).getTime() : null
        return t != null && t >= d0 && t < d1
      }).length
    })
    const wmapeSeries = runs
      .filter((r) => r.status === 'finished' && r.wmape != null && r.ended_at)
      .sort((a, b) => (a.ended_at as string).localeCompare(b.ended_at as string))
      .map((r) => r.wmape as number)
      .slice(-12)
    return { week, attention, wmapeMedian, wmapeN: wmapes.length, monthDelta,
             lastRuns, perDay, wmapeSeries }
  }, [oversight, clients])

  const byPlan = clients.reduce<Record<string, number>>((acc, c) => {
    acc[c.plan] = (acc[c.plan] ?? 0) + 1
    return acc
  }, {})
  const suspended = clients.filter((c) => c.suspended_at).length
  const jobs = system?.jobs ?? []
  const backup = jobs.find((j) => j.job === 'backup')
  const baseB = jobs.find((j) => j.job === 'base_backup')
  const wal = jobs.find((j) => j.job === 'wal_mirror')
  const fmtAge = (sec: number) =>
    sec < 5400 ? `${Math.round(sec / 60)} мин` : sec < 129_600
      ? `${Math.round(sec / 3600)} ч` : `${Math.round(sec / 86_400)} дн`
  const backupFoot = backup
    ? ['dump', baseB ? `base ${fmtAge(baseB.age_sec)}` : null,
       wal ? `WAL ${fmtAge(wal.age_sec)}` : null].filter(Boolean).join(' · ')
    : 'метрика недоступна'

  return (
    <div className="space-y-4 max-w-5xl">
      {anyError && <AdminQueryError what="данные дашборда" onRetry={retryAll} />}

      {/* ── KPI-ряд (прототип) ── */}
      <div className="grid grid-cols-4 gap-3">
        <Kpi label="Клиенты" value={String(clients.length)} to="/admin/clients"
             foot={`${Object.entries(byPlan).map(([p, n]) => `${p}: ${n}`).join(' · ') || '—'} · заблок.: ${suspended}`} />
        <Kpi label={`Обучений за ${WINDOW_DAYS} дней`} value={String(week.finished)} to="/admin/training"
             foot={`gate-блоков: ${week.blocked} · ошибок: ${week.failed}`}
             spark={perDay.some((n) => n > 0) ? { points: perDay, tone: 'brand' } : undefined} />
        <Kpi label="Точность (WMAPE, медиана)" to="/admin/training"
             value={wmapeMedian != null ? wmapeMedian.toFixed(2) : '—'}
             foot={monthDelta != null
               ? <span className={monthDelta <= 0 ? 'text-success font-semibold' : 'text-danger font-semibold'}>
                   {monthDelta <= 0 ? '▾' : '▴'} {Math.abs(monthDelta).toFixed(2)} за месяц
                 </span>
               : wmapeMedian != null ? `по ${wmapeN} обучениям` : 'нет завершённых обучений'}
             spark={wmapeSeries.length >= 2 ? { points: wmapeSeries, tone: 'ok' } : undefined} />
        <Kpi label="Свежесть бэкапа" to="/admin/system"
             value={backup ? fmtAge(backup.age_sec).split(' ')[0] : '—'}
             unit={backup ? fmtAge(backup.age_sec).split(' ')[1] : undefined}
             foot={backupFoot}
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
              {attention.length ? `${attention.length} ${plural(attention.length,
                'пункт', 'пункта', 'пунктов')}` : ''}
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
                        className="btn-secondary text-[11.5px] py-1 opacity-0 group-hover:opacity-100 focus-visible:opacity-100 motion-reduce:opacity-100 transition-opacity">
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
              <thead>
                <tr className="text-[10.5px] font-bold uppercase tracking-widest text-ink-subtle border-b border-surface-border">
                  <th className="px-4 py-2 text-left font-bold">Клиент</th>
                  <th className="px-2 py-2 text-left font-bold">Итог</th>
                  <th className="px-2 py-2 text-right font-bold">WMAPE</th>
                  <th className="px-4 py-2 text-right font-bold">Когда</th>
                </tr>
              </thead>
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
                      {r.ended_at ? relWhen(r.ended_at) : '—'}
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
