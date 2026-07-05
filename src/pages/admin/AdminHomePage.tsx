// ADM-0 (#276): /admin home — real numbers from existing queries, quick
// links into the sections. Grows into the full dashboard with ADM-4 (#257).
import { useQuery } from '@tanstack/react-query'
import { Link } from 'react-router-dom'

import { clientsApi } from '../../features/clients/api'
import { adminNotificationsApi } from '../../features/notifications/api'

export default function AdminHomePage() {
  const { data: clients = [] } = useQuery({
    queryKey: ['admin-clients'],
    queryFn: () => clientsApi.list(),
  })
  const { data: history } = useQuery({
    queryKey: ['admin-notifications-history'],
    queryFn: () => adminNotificationsApi.history(5),
  })

  const byStatus = clients.reduce<Record<string, number>>((acc, c) => {
    acc[c.status] = (acc[c.status] ?? 0) + 1
    return acc
  }, {})

  return (
    <div className="space-y-6 max-w-4xl">
      <div className="grid grid-cols-3 gap-4">
        <Link to="/admin/clients" className="card-paper p-5 hover:shadow-md transition-shadow">
          <div className="text-3xl font-semibold tracking-tight">{clients.length}</div>
          <div className="text-sm text-ink-muted mt-1">Клиентов</div>
          <div className="text-xs text-ink-faint mt-2">
            {Object.entries(byStatus).map(([s, n]) => `${s}: ${n}`).join(' · ') || '—'}
          </div>
        </Link>
        <Link to="/admin/notifications" className="card-paper p-5 hover:shadow-md transition-shadow">
          <div className="text-3xl font-semibold tracking-tight">{history?.count ?? '—'}</div>
          <div className="text-sm text-ink-muted mt-1">Последние анонсы</div>
          <div className="text-xs text-ink-faint mt-2 truncate">
            {history?.notifications?.[0]?.title ?? 'пока не отправлялись'}
          </div>
        </Link>
        <div className="card-paper p-5">
          <div className="text-sm font-medium text-ink">Обучение · Аудит · Загрузки</div>
          <div className="text-xs text-ink-muted mt-2">
            Разделы появятся здесь по мере готовности (ADM-2, ADM-5, ADM-6 —
            дорожная карта в epic #263).
          </div>
        </div>
      </div>
    </div>
  )
}
