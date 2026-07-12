// ADM-5 (#258, Волна 3): «Аудит» — журнал действий (кто/что/когда/IP,
// tamper-evident HMAC-цепочка) + проверка целостности по запросу.
// Metadata-payload'ы сервер не отдаёт (PII-дисциплина) — глубокий разбор
// только через psql по runbook.
import { useState } from 'react'
import { useMutation, useQuery } from '@tanstack/react-query'

import { apiClient, errorMessage } from '../../shared/api/client'
import { clientsApi } from '../../features/clients/api'
import toast from 'react-hot-toast'
import AdminSelect from '../../components/AdminSelect'
import AdminQueryError from './AdminQueryError'
import { SkeletonRows, StateRow, ShowMore } from './adminTable'
import { THEAD_CLS } from './adminTableUtils'

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
// ADM-v3-5 #390: вердикт ежедневного R7-2 крона (штампуется workflow'ом).
interface ChainStatus {
  stamped: boolean
  stamped_at?: string
  age_hours?: number
  stale: boolean | null
  verdict: { ok?: boolean; rows_checked?: number; first_bad_id?: number | null } | null
}

// Бейдж состояния цепочки: цел/нарушен/крон молчит/ещё не проверялась/
// статус недоступен (503 ≠ «всё хорошо» — AUD-12 fail-closed рендеринг).
function ChainBadge({ s, isError }: { s: ChainStatus | undefined; isError: boolean }) {
  if (isError) return <span className="badge-danger">статус цепочки недоступен</span>
  if (!s) return null
  if (!s.stamped) return <span className="badge-neutral">автопроверка ещё не штамповалась</span>
  if (s.verdict?.ok === false)
    return <span className="badge-danger">цепочка НАРУШЕНА (строка {s.verdict.first_bad_id ?? '?'})</span>
  if (s.stale)
    return <span className="badge-warn">вердикт устарел ({Math.round(s.age_hours ?? 0)} ч) — крон молчит</span>
  return (
    <span className="badge-success">
      цепочка цела · проверено {Math.round(s.age_hours ?? 0)} ч назад
    </span>
  )
}

const EVENT_LABELS: Record<string, string> = {
  login: 'Вход', logout: 'Выход', signup: 'Регистрация',
  otp_send: 'Отправка кода', otp_verify: 'Проверка кода',
  oauth_callback: 'Вход через OAuth', password_change: 'Смена пароля',
  plan_change: 'Смена тарифа', email_change: 'Смена email',
  model_train: 'Обучение модели', model_delete: 'Удаление модели',
  upload_delete: 'Удаление загрузки', client_export: 'Экспорт данных',
  client_delete: 'Закрытие аккаунта', client_purge: 'Стирание ПДн',
  secret_rotation: 'Ротация секрета', admin_action: 'Действие админа',
}
const evLabel = (t: string) => EVENT_LABELS[t] ?? t

export default function AdminAuditPage() {
  const [clientFilter, setClientFilter] = useState('')
  const [typeFilter, setTypeFilter] = useState('')
  const [days, setDays] = useState(7)
  const [subtypeInput, setSubtypeInput] = useState('')
  const [actorInput, setActorInput] = useState('')
  const [applied, setApplied] = useState({ subtype: '', actor: '' })
  const [limit, setLimit] = useState(200)   // #394-2: «показать ещё», сервер bounded 500
  const [verify, setVerify] = useState<VerifyResult | null>(null)

  const { data: clients = [] } = useQuery({
    queryKey: ['admin-clients'], queryFn: () => clientsApi.list(),
  })
  const { data: chain, isError: chainError } = useQuery({
    queryKey: ['admin-audit-chain-status'],
    queryFn: async () => {
      const { data } = await apiClient.get<ChainStatus>('/admin/audit/chain-status')
      return data
    },
    refetchInterval: 300_000,
    meta: { silent: true },
  })
  const { data, isError, isLoading, refetch } = useQuery({
    queryKey: ['admin-audit', clientFilter, typeFilter, days, applied, limit],
    queryFn: async () => {
      const { data } = await apiClient.get<AuditResponse>('/admin/audit', {
        params: {
          days, limit,
          ...(clientFilter ? { client_id: clientFilter } : {}),
          ...(typeFilter ? { event_type: typeFilter } : {}),
          ...(applied.subtype ? { event_subtype: applied.subtype } : {}),
          ...(applied.actor ? { actor: applied.actor } : {}),
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
      {isError && <AdminQueryError what="данные аудита" onRetry={() => void refetch()} />}
      <div className="flex items-center justify-between gap-3">
        <h2 className="font-semibold text-sm">Журнал действий</h2>
        <ChainBadge s={chain} isError={chainError} />
      </div>
      {/* Проверка целостности: кнопка слева НАД фильтрами, результат справа */}
      <div className="flex items-center gap-3">
        <button type="button" className="btn-secondary text-sm shrink-0"
                disabled={verifyMut.isPending}
                onClick={() => verifyMut.mutate()}>
          {verifyMut.isPending ? 'Проверка…' : 'Проверить целостность'}
        </button>
        <div className="ml-auto">
          {verify && (
            <span className={verify.ok ? 'badge-success' : 'badge-danger'}>
              {verify.ok
                ? `цепочка цела (${verify.rows_checked} строк)`
                : `НАРУШЕНА: строка ${verify.first_bad_id}`}
            </span>
          )}
        </div>
      </div>

      {/* #394: все фильтры ОДНОЙ строкой — текстовые поля рядом с
          селектами, без переноса на вторую строку */}
      <form className="flex items-center gap-2"
            onSubmit={(e) => {
              e.preventDefault()
              setApplied({ subtype: subtypeInput.trim(), actor: actorInput.trim() })
            }}>
        <AdminSelect className="w-40 shrink-0" ariaLabel="Фильтр по клиенту" value={clientFilter}
                     onChange={setClientFilter}
                     options={[{ value: '', label: 'Все клиенты' },
                               ...clients.map((c) => ({ value: c.client_id, label: c.client_id }))]} />
        <AdminSelect className="w-44 shrink-0" ariaLabel="Фильтр по событию" value={typeFilter}
                     onChange={setTypeFilter}
                     options={[{ value: '', label: 'Все события' },
                               ...(data?.event_types ?? []).map((t) => ({ value: t, label: evLabel(t) }))]} />
        <AdminSelect className="w-28 shrink-0" ariaLabel="Период" value={String(days)}
                     onChange={(v) => setDays(Number(v))}
                     options={[{ value: '1', label: '1 день' },
                               { value: '7', label: '7 дней' },
                               { value: '30', label: '30 дней' },
                               { value: '90', label: '90 дней' }]} />
        <input className="input w-40 shrink-0" placeholder="подтип (точно)"
               value={subtypeInput}
               onChange={(e) => setSubtypeInput(e.target.value)} />
        <input className="input w-48 shrink-0" placeholder="актор: email (точно)"
               value={actorInput}
               onChange={(e) => setActorInput(e.target.value)} />
        <button type="submit" className="btn-secondary text-sm shrink-0">Фильтр</button>
      </form>

      <section className="card-paper overflow-hidden">
        {/* #394-2: sticky-шапка, skeleton-загрузка, три различимых состояния */}
        <div className="overflow-x-auto max-h-[70vh] overflow-y-auto">
          <table className="w-full text-sm">
            <thead className={THEAD_CLS}>
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
              {isLoading ? (
                <SkeletonRows cols={6} />
              ) : isError ? (
                <StateRow cols={6} kind="error" what="журнал аудита" />
              ) : !data?.events?.length ? (
                <StateRow cols={6} kind="empty" what="события за период" />
              ) : (
                data.events.map((e) => (
                  <tr key={e.id} className="hover:bg-surface-muted/40">
                    <td className="px-4 py-2 text-xs text-ink-muted whitespace-nowrap">
                      {new Date(e.ts).toLocaleString('ru-RU')}
                    </td>
                    <td className="px-4 py-2 text-xs">
                      {evLabel(e.event_type)}
                      {e.event_subtype && (
                        <span className="font-mono text-ink-subtle"> /{e.event_subtype}</span>
                      )}
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
                ))
              )}
            </tbody>
          </table>
        </div>
        {!isLoading && !isError && (data?.count ?? 0) >= limit && (
          <ShowMore shown={limit} step={150} max={500}
                    onMore={(n) => setLimit(n)} />
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
