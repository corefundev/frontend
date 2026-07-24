import { useMemo, useState } from 'react'
import { useLocation, useNavigate } from 'react-router-dom'
import { useQuery } from '@tanstack/react-query'

import { clientsApi } from '../../features/clients/api'
import { plansApi, type PlanId, type PlanSpec } from '../../features/plans/api'
import { apiClient } from '../../shared/api/client'
import AdminSelect from '../../components/AdminSelect'
import AdminClientNewModal from './AdminClientNewModal'
import AdminQueryError from './AdminQueryError'
import { admPath } from '../../shared/hostRouting'

const PLAN_ORDER: PlanId[] = ['free', 'start', 'business']

export default function AdminClientsPage() {
  const nav = useNavigate()
  // ADM-10 (#278): client-side search/filter/sort — honest at the current
  // scale; server-side pagination is the recorded follow-up at ~200 clients.
  const [search, setSearch] = useState('')
  const [planFilter, setPlanFilter] = useState<'all' | PlanId>('all')
  const [statusFilter, setStatusFilter] = useState<string>('all')
  const [sortBy, setSortBy] = useState<'client_id' | 'last_trained_at' | 'plan'>('client_id')

  const { data: clients = [], isLoading, isError, refetch } = useQuery({
    queryKey: ['admin-clients'],
    queryFn: () => clientsApi.list(),
  })

  const { data: plans = [] } = useQuery({
    queryKey: ['plans'],
    queryFn: () => plansApi.list(),
  })
  // правки 2026-07-06: третья колонка таблицы — последний вход клиента
  const { data: activity } = useQuery({
    queryKey: ['admin-client-activity'],
    queryFn: async () => {
      const { data } = await apiClient.get<{ last_login: Record<string, string> }>(
        '/admin/client-activity')
      return data.last_login
    },
  })

  const planMap = new Map<PlanId, PlanSpec>(plans.map((p) => [p.id, p]))

  const visible = useMemo(() => {
    const q = search.trim().toLowerCase()
    let rows = clients.filter((c) => {
      if (q && !c.client_id.toLowerCase().includes(q) &&
          !(c.email ?? '').toLowerCase().includes(q)) return false
      if (planFilter !== 'all' && c.plan !== planFilter) return false
      if (statusFilter === 'suspended') return !!c.suspended_at
      if (statusFilter === 'closed') return c.status === 'purged' || !!c.deleted_at
      if (statusFilter !== 'all' && c.status !== statusFilter) return false
      return true
    })
    rows = [...rows].sort((a, b) => {
      if (sortBy === 'last_trained_at')
        return (b.last_trained_at ?? '').localeCompare(a.last_trained_at ?? '')
      if (sortBy === 'plan') return a.plan.localeCompare(b.plan)
      return a.client_id.localeCompare(b.client_id)
    })
    return rows
  }, [clients, search, planFilter, statusFilter, sortBy])

  // «+ Новый пользователь» переехал из сайдбара в кнопку с попапом;
  // /admin/clients/new (⌘K, старые ссылки) открывает попап автоматически
  const { pathname } = useLocation()
  const [newOpen, setNewOpen] = useState<boolean>(pathname.endsWith('/new'))

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center gap-3">
        <input
          className="input w-64"
          placeholder="Поиск: client id или email…"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
        />
        <AdminSelect className="w-40" ariaLabel="Фильтр по тарифу" value={planFilter}
                     onChange={(v) => setPlanFilter(v as 'all' | PlanId)}
                     options={[{ value: 'all', label: 'Все тарифы' },
                               ...PLAN_ORDER.map((p) => ({ value: p, label: planMap.get(p)?.display_name ?? p }))]} />
        <AdminSelect className="w-44" ariaLabel="Фильтр по статусу" value={statusFilter}
                     onChange={setStatusFilter}
                     options={[{ value: 'all', label: 'Все статусы' },
                               { value: 'ready', label: 'ready' },
                               { value: 'training', label: 'training' },
                               { value: 'registered', label: 'registered' },
                               { value: 'error', label: 'error' },
                               { value: 'suspended', label: 'заблокированные' },
                               { value: 'closed', label: 'закрытые/стёртые' }]} />
        <AdminSelect className="w-48" ariaLabel="Сортировка" value={sortBy}
                     onChange={(v) => setSortBy(v as typeof sortBy)}
                     options={[{ value: 'client_id', label: 'Сортировка: ID' },
                               { value: 'last_trained_at', label: 'Сортировка: обучение ↓' },
                               { value: 'plan', label: 'Сортировка: тариф' }]} />
        <span className="text-xs text-ink-muted ml-auto">
          {visible.length} из {clients.length}
        </span>
        <button type="button" className="btn-primary text-sm shrink-0"
                onClick={() => setNewOpen(true)}>
          Новый пользователь
        </button>
      </div>

      <section className="card overflow-hidden">
        {isError ? (
          <div className="p-5">
            <AdminQueryError what="список клиентов" onRetry={() => void refetch()} />
          </div>
        ) : isLoading ? (
          // PJAX top-bar signals the wait; spacer keeps layout stable.
          <div className="p-8 h-32" aria-hidden="true" />
        ) : visible.length === 0 ? (
          <div className="p-8 text-center text-ink-muted">
            Ничего не найдено.
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead className="bg-surface-muted text-ink-subtle text-xs uppercase tracking-wider">
                <tr>
                  <Th>Client ID</Th>
                  <Th>Тариф</Th>
                  <Th>Последний вход</Th>
                </tr>
              </thead>
              <tbody className="divide-y divide-surface-border">
                {visible.map((c) => {
                  const spec = planMap.get(c.plan)
                  const login = activity?.[c.client_id]
                  return (
                    <tr key={c.client_id}
                        className={`hover:bg-surface-muted/50 cursor-pointer ${
                          c.status === 'purged' || c.deleted_at ? 'opacity-55' : ''}`}
                        onClick={() => nav(admPath(`/admin/clients/${encodeURIComponent(c.client_id)}`))}>
                      <Td>
                        <div className="font-mono text-brand-700">{c.client_id}</div>
                        {c.status === 'purged'
                          ? <span className="badge-neutral">данные стёрты</span>
                          : c.deleted_at
                            ? <span className="badge-warn">закрыт</span>
                            : c.suspended_at && <span className="badge-danger">заблокирован</span>}
                      </Td>
                      <Td>{spec?.display_name ?? c.plan}</Td>
                      <Td className="text-xs text-ink-muted">
                        {login ? new Date(login).toLocaleString('ru-RU') : '—'}
                      </Td>
                    </tr>
                  )
                })}
              </tbody>
            </table>
          </div>
        )}
      </section>
      <AdminClientNewModal open={newOpen} onClose={() => setNewOpen(false)} />
    </div>
  )
}

function Th({ children }: { children: React.ReactNode }) {
  return <th className="px-4 py-2.5 text-left font-medium">{children}</th>
}
function Td({
  children,
  className = '',
}: {
  children: React.ReactNode
  className?: string
}) {
  return <td className={`px-4 py-3 align-top ${className}`}>{children}</td>
}

// ══════════════════════════════════════════════════════════════════════════
//  Register-new-client dialog
// ══════════════════════════════════════════════════════════════════════════
//  ApiKeyReveal — one-time display of a freshly minted api_key.
//
//  Designed to feel weighty: the key sits on a warm paper card with a
//  copy button and a clear "сохрани сейчас" warning. The dialog's
//  click-outside-to-dismiss is intentionally disabled while the key is
//  visible — the operator must click "Я сохранил" to dismiss.
// ══════════════════════════════════════════════════════════════════════════
//  RotateKeyButton — emit a fresh api_key for an existing client.
//
//  Two-step UX: confirmation prompt → reveal new key. Old key is
//  invalidated server-side immediately on mutation success.