// ADM-3 (#256, Волна 1 finale + правки 2026-07-06): карточка клиента.
// ВСЕ операторские действия (тариф / блокировка / ротация ключа) живут
// ЗДЕСЬ — таблица только навигация. Каждое открытие карточки аудируется
// сервером (H5: overview-endpoint пишет client_view).
import { useMemo } from 'react'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { Link, useParams } from 'react-router-dom'
import toast from 'react-hot-toast'

import { apiClient, errorMessage } from '../../shared/api/client'
import { clientsApi, type ClientRecord } from '../../features/clients/api'
import { type PlanId } from '../../features/plans/api'
import { getNotifications } from '../../features/notifications/api'

interface Overview {
  client: ClientRecord
  recent_logins: { at: string; ip: string | null; via: string | null }[]
  training_runs: {
    run_id: string; status: string; ended_at: string | null
    wmape: number | null; gate_passed: boolean | null
    model_path: string | null
  }[]
}

const PLAN_ORDER: PlanId[] = ['free', 'start', 'business']

export default function AdminClientCardPage() {
  const { clientId = '' } = useParams()
  const qc = useQueryClient()

  const { data, isLoading } = useQuery({
    queryKey: ['admin-client-overview', clientId],
    queryFn: async () => {
      const { data } = await apiClient.get<Overview>(
        `/admin/clients/${encodeURIComponent(clientId)}/overview`)
      return data
    },
    enabled: !!clientId,
  })
  const { data: inbox } = useQuery({
    queryKey: ['notifications', clientId, 'admin-card'],
    queryFn: () => getNotifications(clientId, 5),
    enabled: !!clientId,
  })

  const invalidate = () => {
    qc.invalidateQueries({ queryKey: ['admin-client-overview', clientId] })
    qc.invalidateQueries({ queryKey: ['admin-clients'] })
  }
  const planMut = useMutation({
    mutationFn: (plan: PlanId) => clientsApi.update(clientId, { plan }),
    onSuccess: () => { toast.success('Тариф обновлён'); invalidate() },
    onError: (e) => toast.error(errorMessage(e, 'Не удалось обновить тариф')),
  })
  const suspendMut = useMutation({
    mutationFn: (on: boolean) =>
      on ? clientsApi.suspend(clientId) : clientsApi.unsuspend(clientId),
    onSuccess: (_r, on) => {
      toast.success(on ? 'Клиент заблокирован' : 'Клиент разблокирован')
      invalidate()
    },
    onError: (e) => toast.error(errorMessage(e, 'Не удалось изменить статус')),
  })
  const rotateMut = useMutation({
    mutationFn: () => clientsApi.rotateApiKey(clientId),
    onSuccess: (r) => {
      // one-time display — the server stores only the hash
      window.prompt('Новый API-ключ (показывается ОДИН раз — скопируйте):', r.api_key)
    },
    onError: (e) => toast.error(errorMessage(e, 'Не удалось ротировать ключ')),
  })

  const c = data?.client
  const gateBadge = useMemo(() => (r: Overview['training_runs'][number]) => {
    if (r.gate_passed === false && !r.model_path) return <span className="badge-danger">gate: блок</span>
    if (r.gate_passed === false) return <span className="badge-warn">gate: fail (перв.)</span>
    if (r.gate_passed === true) return <span className="badge-success">gate: pass</span>
    return <span className="badge-neutral">до гейта</span>
  }, [])

  if (isLoading || !c) return <div className="h-40" aria-hidden />

  return (
    <div className="space-y-6 max-w-4xl">
      <div className="flex items-center gap-3">
        <Link to="/admin/clients" className="text-sm text-ink-muted hover:text-ink">← Клиенты</Link>
        <h2 className="text-xl font-semibold font-mono">{c.client_id}</h2>
        {c.suspended_at
          ? <span className="badge-danger">заблокирован</span>
          : <span className="badge-success">активен</span>}
      </div>

      <section className="card-paper p-5">
        <h3 className="font-semibold text-sm mb-3">Профиль</h3>
        <dl className="grid grid-cols-2 gap-x-8 gap-y-2 text-sm">
          <Row k="Email" v={c.email ?? '—'} />
          <Row k="Создан" v={new Date(c.created_at).toLocaleString('ru-RU')} />
          <Row k="Статус обучения" v={c.status} />
          <Row k="Горизонт" v={`${c.horizon} дн.`} />
          <Row k="SKU (обучено)" v={String(c.trained_sku_count ?? '—')} />
          <Row k="Последнее обучение" v={c.last_trained_at
            ? new Date(c.last_trained_at).toLocaleString('ru-RU') : '—'} />
        </dl>
        <div className="mt-4 flex items-center gap-3">
          <span className="text-sm text-ink-muted">Тариф:</span>
          <select className="input py-1 text-sm w-44" value={c.plan}
                  disabled={planMut.isPending}
                  onChange={(e) => {
                    const p = e.target.value as PlanId
                    if (window.confirm(`Сменить тариф «${c.client_id}» на ${p}?`))
                      planMut.mutate(p)
                  }}>
            {PLAN_ORDER.map((p) => <option key={p} value={p}>{p}</option>)}
          </select>
        </div>
      </section>

      <section className="card-paper p-5">
        <h3 className="font-semibold text-sm mb-3">Доступ</h3>
        <div className="flex items-center gap-3">
          <button type="button"
                  className={c.suspended_at ? 'btn-secondary' : 'btn-danger'}
                  disabled={suspendMut.isPending}
                  onClick={() => {
                    const on = !c.suspended_at
                    const msg = on
                      ? `Заблокировать «${c.client_id}»? Доступ к API прекратится немедленно; данные сохранятся.`
                      : `Разблокировать «${c.client_id}»?`
                    if (window.confirm(msg)) suspendMut.mutate(on)
                  }}>
            {c.suspended_at ? 'Разблокировать' : 'Заблокировать'}
          </button>
          <button type="button" className="btn-secondary"
                  disabled={rotateMut.isPending}
                  onClick={() => {
                    if (window.confirm('Ротировать API-ключ? Старый ключ перестанет работать немедленно.'))
                      rotateMut.mutate()
                  }}>
            Ротировать API-ключ
          </button>
        </div>
        {c.suspended_at && (
          <div className="text-xs text-ink-muted mt-2">
            Заблокирован с {new Date(c.suspended_at).toLocaleString('ru-RU')}
          </div>
        )}
      </section>

      <section className="card-paper overflow-hidden">
        <h3 className="font-semibold text-sm px-5 py-3 border-b border-surface-border">Обучения (последние 5)</h3>
        {!data.training_runs.length ? (
          <div className="px-5 py-6 text-sm text-ink-muted">Обучений не было</div>
        ) : (
          <table className="w-full text-sm">
            <tbody>
              {data.training_runs.map((r) => (
                <tr key={r.run_id} className="border-b border-surface-border last:border-b-0">
                  <td className="px-5 py-2.5 text-xs text-ink-muted whitespace-nowrap">
                    {r.ended_at ? new Date(r.ended_at).toLocaleString('ru-RU') : '—'}
                  </td>
                  <td className="px-3 py-2.5"><span className="badge-neutral">{r.status}</span></td>
                  <td className="px-3 py-2.5 font-mono text-xs">
                    {r.wmape != null ? `WMAPE ${Number(r.wmape).toFixed(3)}` : '—'}
                  </td>
                  <td className="px-3 py-2.5">{gateBadge(r)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </section>

      <div className="grid grid-cols-2 gap-4">
        <section className="card-paper overflow-hidden">
          <h3 className="font-semibold text-sm px-5 py-3 border-b border-surface-border">Активность (входы)</h3>
          {!data.recent_logins.length ? (
            <div className="px-5 py-6 text-sm text-ink-muted">Входов не зафиксировано</div>
          ) : (
            <ul className="divide-y divide-surface-border text-sm">
              {data.recent_logins.map((l, i) => (
                <li key={i} className="px-5 py-2 flex justify-between">
                  <span className="text-xs text-ink-muted">{new Date(l.at).toLocaleString('ru-RU')}</span>
                  <span className="font-mono text-xs">{l.ip ?? '—'}{l.via ? ` · ${l.via}` : ''}</span>
                </li>
              ))}
            </ul>
          )}
        </section>

        <section className="card-paper overflow-hidden">
          <h3 className="font-semibold text-sm px-5 py-3 border-b border-surface-border">Уведомления (последние 5)</h3>
          {!inbox?.notifications?.length ? (
            <div className="px-5 py-6 text-sm text-ink-muted">Пусто</div>
          ) : (
            <ul className="divide-y divide-surface-border text-sm">
              {inbox.notifications.map((n) => (
                <li key={n.id} className="px-5 py-2">
                  <span className={n.read_at ? 'text-ink-muted' : 'text-ink font-medium'}>{n.title}</span>
                </li>
              ))}
            </ul>
          )}
        </section>
      </div>
    </div>
  )
}

function Row({ k, v }: { k: string; v: string }) {
  return (
    <div className="flex justify-between border-b border-surface-border/50 pb-1">
      <dt className="text-ink-muted">{k}</dt>
      <dd className="font-medium text-right">{v}</dd>
    </div>
  )
}
