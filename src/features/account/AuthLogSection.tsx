// «Журнал авторизаций» (#472 правки 2026-07-28): история входов и
// событий безопасности — переехала из раздела «Безопасность» в
// самостоятельный раздел.
import { useQuery } from '@tanstack/react-query'

import { apiClient } from '../../shared/api/client'
import { useAuthStore } from '../auth/store'
import { EVENT_LABEL, fmtTs, type AuditResponse } from './audit'

export default function AuthLogSection() {
  const clientId = useAuthStore((s) => s.clientId)!
  const { data: audit, isLoading } = useQuery({
    queryKey: ['account-audit', clientId],
    queryFn: async () => (await apiClient.get<AuditResponse>(`/clients/${clientId}/audit`, { params: { limit: 50 } })).data,
  })

  return (
    <section className="card p-6 sm:p-8">
      {isLoading ? (
        <p className="text-sm text-ink-muted">Загружаю журнал…</p>
      ) : !audit?.events?.length ? (
        <p className="text-sm text-ink-muted">Пока нет событий.</p>
      ) : (
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="text-left text-ink-muted border-b border-surface-border">
                <th className="py-2 pr-4 font-medium">Событие</th>
                <th className="py-2 pr-4 font-medium">Когда</th>
                <th className="py-2 font-medium">IP</th>
              </tr>
            </thead>
            <tbody>
              {audit.events.map((e, i) => (
                <tr key={i} className="border-b border-surface-border last:border-b-0">
                  <td className="py-2 pr-4 text-ink">{EVENT_LABEL[e.event_type] ?? e.event_type}</td>
                  <td className="py-2 pr-4 text-ink-muted">{fmtTs(e.ts)}</td>
                  <td className="py-2 text-ink-muted font-mono text-xs">{e.ip ?? '—'}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </section>
  )
}
