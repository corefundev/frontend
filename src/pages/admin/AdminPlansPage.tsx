// ADM-11 (#279, Волна 1): «Тарифы» — восстановление поверхности, утраченной
// при выделении консоли (ADM-0). Каталог планов (тот же plans API, что
// видят клиенты), распределение клиентов по тарифам, история смен из
// audit-строк. Read-only: правка лимитов остаётся кодом (plans.py через PR)
// до B1-схемы (#150) — зафиксировано в issue как v2.
import { useQuery } from '@tanstack/react-query'

import { apiClient } from '../../shared/api/client'
import { clientsApi } from '../../features/clients/api'
import { plansApi, type PlanId } from '../../features/plans/api'

interface PlanChange {
  client_id: string
  actor: string | null
  changed_at: string | null
  old: string | null
  new: string | null
}

const PLAN_ORDER: PlanId[] = ['free', 'start', 'business']

export default function AdminPlansPage() {
  const { data: plans = [] } = useQuery({
    queryKey: ['plans'],
    queryFn: () => plansApi.list(),
  })
  const { data: clients = [] } = useQuery({
    queryKey: ['admin-clients'],
    queryFn: () => clientsApi.list(),
  })
  const { data: history } = useQuery({
    queryKey: ['admin-plan-history'],
    queryFn: async () => {
      const { data } = await apiClient.get<{ changes: PlanChange[] }>(
        '/admin/plan-history', { params: { limit: 50 } })
      return data
    },
  })

  const countByPlan = clients.reduce<Record<string, number>>((acc, c) => {
    acc[c.plan] = (acc[c.plan] ?? 0) + 1
    return acc
  }, {})

  const ordered = PLAN_ORDER
    .map((id) => plans.find((p) => p.id === id))
    .filter((p): p is NonNullable<typeof p> => !!p)

  return (
    <div className="space-y-6 max-w-5xl">
      <div className="grid grid-cols-3 gap-4">
        {ordered.map((p) => (
          <div key={p.id} className="card-paper p-5">
            <div className="flex items-baseline justify-between">
              <div className="text-lg font-semibold">{p.display_name}</div>
              <div className="text-xs text-ink-muted">{p.price_label}</div>
            </div>
            <div className="text-xs text-ink-muted mt-0.5">
              модель: {p.model_display_name} · клиентов: {countByPlan[p.id] ?? 0}
            </div>
            <dl className="mt-4 space-y-1.5 text-sm">
              <Row k="SKU" v={p.max_skus === null ? 'без лимита' : String(p.max_skus)} />
              <Row k="Горизонт" v={p.max_horizon_days === null ? 'без лимита' : `${p.max_horizon_days} дн.`} />
              <Row k="Cooldown обучения" v={p.training_cooldown_hours === null ? 'нет' : `${p.training_cooldown_hours} ч`} />
              <Row k="Конфиг-ключи" v={
                p.config_allowed_keys === null ? 'все'
                  : p.config_allowed_keys.length === 0 ? 'нет'
                  : String(p.config_allowed_keys.length)
              } />
            </dl>
          </div>
        ))}
      </div>

      <div className="card-paper overflow-hidden">
        <div className="px-5 py-3 border-b border-surface-border flex items-baseline justify-between">
          <span className="font-semibold text-sm">История смен тарифов</span>
          <span className="text-xs text-ink-muted">
            лимиты правятся кодом (plans.py) до B1-схемы — read-only витрина
          </span>
        </div>
        {!history?.changes?.length ? (
          <div className="px-5 py-8 text-sm text-ink-muted text-center">Смен пока не было</div>
        ) : (
          <table className="w-full text-sm">
            <tbody>
              {history.changes.map((ch, i) => (
                <tr key={i} className="border-b border-surface-border last:border-b-0">
                  <td className="px-5 py-2.5 font-mono text-xs text-ink-muted whitespace-nowrap">
                    {ch.changed_at ? new Date(ch.changed_at).toLocaleString('ru-RU') : '—'}
                  </td>
                  <td className="px-3 py-2.5 font-mono text-xs">{ch.client_id}</td>
                  <td className="px-3 py-2.5">
                    <span className="badge-neutral">{ch.old ?? '—'}</span>
                    <span className="mx-2 text-ink-faint">→</span>
                    <span className="badge-info">{ch.new ?? '—'}</span>
                  </td>
                  <td className="px-3 py-2.5 text-xs text-ink-muted">{ch.actor ?? '—'}</td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>
    </div>
  )
}

function Row({ k, v }: { k: string; v: string }) {
  return (
    <div className="flex justify-between">
      <dt className="text-ink-muted">{k}</dt>
      <dd className="font-medium">{v}</dd>
    </div>
  )
}
