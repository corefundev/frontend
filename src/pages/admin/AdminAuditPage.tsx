// ADM-5 (#258, Волна 3): «Аудит» — журнал действий (кто/что/когда/IP,
// tamper-evident HMAC-цепочка) + проверка целостности по запросу.
// Metadata-payload'ы сервер не отдаёт (PII-дисциплина) — глубокий разбор
// только через psql по runbook.
import { useState } from 'react'
import { useMutation, useQuery } from '@tanstack/react-query'

import { apiClient, errorMessage } from '../../shared/api/client'
import { clientsApi } from '../../features/clients/api'
import toast from 'react-hot-toast'

interface AuditEvent {
  id: number; ts: string; event_type: string; event_subtype: string | null
  client_id: string | null; actor_email: string | null; ip: string | null
  success: boolean; target_type: string | null; target_id: string | null
}
interface AuditResponse {
  events: AuditEvent[]; count: number; event_types: string[]
}
interface VerifyResult {
  ok: boolean; rows_checked: number
  first_bad_id: number | null; reason: string | null
}

export default function AdminAuditPage() {
  const [clientFilter, setClientFilter] = useState('')
  const [typeFilter, setTypeFilter] = useState('')
  const [days, setDays] = useState(7)
  const [verify, setVerify] = useState<VerifyResult | null>(null)

  const { data: clients = [] } = useQuery({
    queryKey: ['admin-clients'], queryFn: () => clientsApi.list(),
  })
  const { data } = useQuery({
    queryKey: ['admin-audit', clientFilter, typeFilter, days],
    queryFn: async () => {
      const { data } = await apiClient.get<AuditResponse>('/admin/audit', {
        params: {
          days, limit: 200,
          ...(clientFilter ? { client_id: clientFilter } : {}),
          ...(typeFilter ? { event_type: typeFilter } : {}),
        },
      })
      return data
    },
  })

  const verifyMut = useMutation({
    mutationFn: async () => {
      const { data } = await apiClient.get<VerifyResult>('/internal/audit/verify')
      return data
    },
    onSuccess: setVerify,
    onError: (e) => toast.error(errorMessage(e, 'Проверка не удалась')),
  })

  return (
    <div className="space-y-6 max-w-5xl">
      <div className="flex flex-wrap items-center gap-3">
        <select className="input w-44" value={clientFilter}
                onChange={(e) => setClientFilter(e.target.value)}>
          <option value="">Все клиенты</option>
          {clients.map((c) => (
            <option key={c.client_id} value={c.client_id}>{c.client_id}</option>
          ))}
        </select>
        <select className="input w-48" value={typeFilter}
                onChange={(e) => setTypeFilter(e.target.value)}>
          <option value="">Все события</option>
          {(data?.event_types ?? []).map((t) => <option key={t} value={t}>{t}</option>)}
        </select>
        <select className="input w-36" value={days}
                onChange={(e) => setDays(Number(e.target.value))}>
          <option value={1}>1 день</option>
          <option value={7}>7 дней</option>
          <option value={30}>30 дней</option>
          <option value={90}>90 дней</option>
        </select>
        <div className="ml-auto flex items-center gap-3">
          {verify && (
            <span className={verify.ok ? 'badge-success' : 'badge-danger'}>
              {verify.ok
                ? `цепочка цела (${verify.rows_checked} строк)`
                : `НАРУШЕНА: строка ${verify.first_bad_id}`}
            </span>
          )}
          <button type="button" className="btn-secondary text-sm"
                  disabled={verifyMut.isPending}
                  onClick={() => verifyMut.mutate()}>
            {verifyMut.isPending ? 'Проверка…' : 'Проверить целостность'}
          </button>
        </div>
      </div>

      <section className="card-paper overflow-hidden">
        {!data?.events?.length ? (
          <div className="px-5 py-8 text-sm text-ink-muted text-center">
            Событий за выбранный период нет
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead className="bg-surface-muted text-ink-subtle text-xs uppercase tracking-wider">
                <tr>
                  <th className="px-4 py-2 text-left">Время</th>
                  <th className="px-4 py-2 text-left">Событие</th>
                  <th className="px-4 py-2 text-left">Клиент</th>
                  <th className="px-4 py-2 text-left">IP</th>
                  <th className="px-4 py-2 text-left">Цель</th>
                  <th className="px-4 py-2 text-left">Статус</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-surface-border">
                {data.events.map((e) => (
                  <tr key={e.id} className="hover:bg-surface-muted/40">
                    <td className="px-4 py-2 text-xs text-ink-muted whitespace-nowrap">
                      {new Date(e.ts).toLocaleString('ru-RU')}
                    </td>
                    <td className="px-4 py-2 font-mono text-xs">
                      {e.event_type}{e.event_subtype ? `/${e.event_subtype}` : ''}
                    </td>
                    <td className="px-4 py-2 font-mono text-xs">{e.client_id ?? '—'}</td>
                    <td className="px-4 py-2 font-mono text-xs">{e.ip ?? '—'}</td>
                    <td className="px-4 py-2 text-xs text-ink-muted">
                      {e.target_type ? `${e.target_type}:${e.target_id}` : '—'}
                    </td>
                    <td className="px-4 py-2">
                      {e.success
                        ? <span className="badge-success">ok</span>
                        : <span className="badge-danger">fail</span>}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </section>

      <div className="text-xs text-ink-muted">
        Детальные payload'ы событий не отображаются (могут содержать ПДн) —
        доступ через psql по runbook. Журнал сцеплен HMAC-цепочкой; ежедневная
        автопроверка — R7-2.
      </div>
    </div>
  )
}
