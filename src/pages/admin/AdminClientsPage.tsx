import { useMemo, useState } from 'react'
import {
  useMutation,
  useQuery,
  useQueryClient,
} from '@tanstack/react-query'
import toast from 'react-hot-toast'

import {
  clientsApi,
  type ClientRecord,
  type RegisterClientRequest,
} from '../../features/clients/api'
import { plansApi, type PlanId, type PlanSpec } from '../../features/plans/api'
import { errorMessage } from '../../shared/api/client'

const PLAN_ORDER: PlanId[] = ['free', 'start', 'business']

const STATUS_BADGE: Record<ClientRecord['status'], string> = {
  registered: 'badge-neutral',
  training:   'badge-info',
  ready:      'badge-success',
  error:      'badge-danger',
}

export default function AdminClientsPage() {
  const qc = useQueryClient()
  const [showRegister, setShowRegister] = useState(false)
  // ADM-10 (#278): client-side search/filter/sort — honest at the current
  // scale; server-side pagination is the recorded follow-up at ~200 clients.
  const [search, setSearch] = useState('')
  const [planFilter, setPlanFilter] = useState<'all' | PlanId>('all')
  const [statusFilter, setStatusFilter] = useState<string>('all')
  const [sortBy, setSortBy] = useState<'client_id' | 'last_trained_at' | 'plan'>('client_id')

  const { data: clients = [], isLoading } = useQuery({
    queryKey: ['admin-clients'],
    queryFn: () => clientsApi.list(),
  })

  const { data: plans = [] } = useQuery({
    queryKey: ['plans'],
    queryFn: () => plansApi.list(),
  })

  const planMap = new Map<PlanId, PlanSpec>(plans.map((p) => [p.id, p]))

  const visible = useMemo(() => {
    const q = search.trim().toLowerCase()
    let rows = clients.filter((c) => {
      if (q && !c.client_id.toLowerCase().includes(q) &&
          !(c.email ?? '').toLowerCase().includes(q)) return false
      if (planFilter !== 'all' && c.plan !== planFilter) return false
      if (statusFilter === 'suspended') return !!c.suspended_at
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

  const suspendMut = useMutation({
    mutationFn: ({ id, on }: { id: string; on: boolean }) =>
      on ? clientsApi.suspend(id) : clientsApi.unsuspend(id),
    onSuccess: (_r, v) => {
      toast.success(v.on ? `${v.id}: заблокирован` : `${v.id}: разблокирован`)
      qc.invalidateQueries({ queryKey: ['admin-clients'] })
    },
    onError: (e) => toast.error(errorMessage(e, 'Не удалось изменить статус')),
  })

  const updateMut = useMutation({
    mutationFn: ({ id, plan }: { id: string; plan: PlanId }) =>
      clientsApi.update(id, { plan }),
    onSuccess: (rec) => {
      toast.success(`${rec.client_id}: тариф обновлён`)
      qc.invalidateQueries({ queryKey: ['admin-clients'] })
    },
    onError: (e) => toast.error(errorMessage(e, 'Не удалось обновить')),
  })

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight">Клиенты</h1>
          <p className="text-ink-muted mt-1 text-sm">
            Административный просмотр: тарифы, статусы обучения, счётчики квот.
          </p>
        </div>
        <button
          type="button"
          className="btn-primary"
          onClick={() => setShowRegister(true)}
        >
          Зарегистрировать клиента
        </button>
      </div>

      <div className="flex flex-wrap items-center gap-3">
        <input
          className="input w-64"
          placeholder="Поиск: client id или email…"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
        />
        <select className="input w-40" value={planFilter}
                onChange={(e) => setPlanFilter(e.target.value as 'all' | PlanId)}>
          <option value="all">Все тарифы</option>
          {PLAN_ORDER.map((p) => <option key={p} value={p}>{planMap.get(p)?.display_name ?? p}</option>)}
        </select>
        <select className="input w-44" value={statusFilter}
                onChange={(e) => setStatusFilter(e.target.value)}>
          <option value="all">Все статусы</option>
          <option value="ready">ready</option>
          <option value="training">training</option>
          <option value="registered">registered</option>
          <option value="error">error</option>
          <option value="suspended">заблокированные</option>
        </select>
        <select className="input w-48" value={sortBy}
                onChange={(e) => setSortBy(e.target.value as typeof sortBy)}>
          <option value="client_id">Сортировка: ID</option>
          <option value="last_trained_at">Сортировка: обучение ↓</option>
          <option value="plan">Сортировка: тариф</option>
        </select>
        <span className="text-xs text-ink-muted ml-auto">
          {visible.length} из {clients.length}
        </span>
      </div>

      {showRegister && (
        <RegisterDialog
          plans={plans}
          onClose={() => setShowRegister(false)}
          onCreated={() => qc.invalidateQueries({ queryKey: ['admin-clients'] })}
        />
      )}

      <section className="card overflow-hidden">
        {isLoading ? (
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
                  <Th>Статус</Th>
                  <Th>Горизонт</Th>
                  <Th>SKU (обуч.)</Th>
                  <Th>Последнее обуч.</Th>
                  <Th>API-ключ</Th>
                  <Th>Доступ</Th>
                </tr>
              </thead>
              <tbody className="divide-y divide-surface-border">
                {visible.map((c) => {
                  const spec = planMap.get(c.plan)
                  return (
                    <tr key={c.client_id} className="hover:bg-surface-muted/50">
                      <Td>
                        <div className="font-mono">{c.client_id}</div>
                        <div className="text-xs text-ink-subtle">
                          {spec?.model_display_name ?? '—'}
                        </div>
                      </Td>
                      <Td>
                        <select
                          className="input py-1 text-sm"
                          value={c.plan}
                          disabled={updateMut.isPending}
                          onChange={(e) =>
                            updateMut.mutate({
                              id: c.client_id,
                              plan: e.target.value as PlanId,
                            })
                          }
                        >
                          {PLAN_ORDER.map((p) => {
                            const s = planMap.get(p)
                            return (
                              <option key={p} value={p}>
                                {s?.display_name ?? p}
                              </option>
                            )
                          })}
                        </select>
                      </Td>
                      <Td>
                        {c.suspended_at
                          ? <span className="badge-danger">заблокирован</span>
                          : <span className={STATUS_BADGE[c.status]}>{c.status}</span>}
                      </Td>
                      <Td>{c.horizon} дн.</Td>
                      <Td>
                        {c.trained_sku_count ?? '—'}
                        {spec?.max_skus !== null && spec?.max_skus !== undefined && (
                          <span className="text-ink-subtle text-xs">
                            {' '}/ {spec.max_skus}
                          </span>
                        )}
                      </Td>
                      <Td className="text-xs text-ink-muted">
                        {c.last_trained_at
                          ? new Date(c.last_trained_at).toLocaleString('ru')
                          : '—'}
                      </Td>
                      <Td>
                        <RotateKeyButton clientId={c.client_id} />
                      </Td>
                      <Td>
                        <button
                          type="button"
                          className={c.suspended_at ? 'btn-secondary text-xs' : 'btn-danger text-xs'}
                          disabled={suspendMut.isPending}
                          onClick={() => {
                            const on = !c.suspended_at
                            const msg = on
                              ? `Заблокировать «${c.client_id}»? Доступ к API прекратится немедленно; данные сохранятся.`
                              : `Разблокировать «${c.client_id}»?`
                            if (window.confirm(msg)) suspendMut.mutate({ id: c.client_id, on })
                          }}
                        >
                          {c.suspended_at ? 'Разблокировать' : 'Заблокировать'}
                        </button>
                      </Td>
                    </tr>
                  )
                })}
              </tbody>
            </table>
          </div>
        )}
      </section>
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

function RegisterDialog({
  plans,
  onClose,
  onCreated,
}: {
  plans: PlanSpec[]
  onClose: () => void
  onCreated: () => void
}) {
  const [form, setForm] = useState<RegisterClientRequest>({
    client_id: '',
    horizon:   14,
    plan:      'free',
  })
  // After successful registration, hold the one-time api_key so the
  // operator can copy it. Closing the dialog is the only "I'm done"
  // signal — we deliberately do NOT auto-dismiss.
  const [issued, setIssued] = useState<{ clientId: string; apiKey: string } | null>(null)

  const { mutate, isPending } = useMutation({
    mutationFn: () => clientsApi.register(form),
    onSuccess: (resp) => {
      setIssued({ clientId: resp.client_id, apiKey: resp.api_key })
      onCreated()
    },
    onError: (e) => toast.error(errorMessage(e, 'Не удалось создать')),
  })

  return (
    <div
      role="dialog"
      className="fixed inset-0 z-50 flex items-center justify-center bg-ink/40 p-4"
      onClick={!issued ? onClose : undefined}
    >
      <div
        className="card w-full max-w-md p-6 animate-fade-in"
        onClick={(e) => e.stopPropagation()}
      >
        {!issued ? (
          <>
            <h2 className="display-em text-brand-700 text-2xl">Новый клиент</h2>
            <p className="eyebrow mt-1">создаётся с уникальным API-ключом</p>
            <form
              className="mt-4 space-y-4"
              onSubmit={(e) => {
                e.preventDefault()
                if (!form.client_id.trim()) return toast.error('Укажите client_id')
                mutate()
              }}
            >
              <div>
                <label className="label" htmlFor="cid">Client ID</label>
                <input
                  id="cid"
                  className="input font-mono"
                  value={form.client_id}
                  onChange={(e) => setForm({ ...form, client_id: e.target.value })}
                  required
                  autoComplete="off"
                  spellCheck={false}
                />
              </div>
              <div>
                <label className="label" htmlFor="plan">Тариф</label>
                <select
                  id="plan"
                  className="input"
                  value={form.plan}
                  onChange={(e) =>
                    setForm({ ...form, plan: e.target.value as PlanId })
                  }
                >
                  {plans.map((p) => (
                    <option key={p.id} value={p.id}>
                      {p.display_name} · {p.model_display_name}
                    </option>
                  ))}
                </select>
              </div>
              <div>
                <label className="label" htmlFor="horizon">Горизонт по умолчанию</label>
                <input
                  id="horizon"
                  type="number"
                  min={1}
                  max={28}
                  className="input"
                  value={form.horizon}
                  onChange={(e) =>
                    setForm({ ...form, horizon: Number(e.target.value) })
                  }
                />
              </div>
              <div className="flex justify-end gap-2 pt-2">
                <button type="button" className="btn-secondary" onClick={onClose}>
                  Отмена
                </button>
                <button type="submit" className="btn-primary" disabled={isPending}>
                  {isPending ? 'Создание…' : 'Создать'}
                </button>
              </div>
            </form>
          </>
        ) : (
          <ApiKeyReveal
            clientId={issued.clientId}
            apiKey={issued.apiKey}
            onClose={onClose}
          />
        )}
      </div>
    </div>
  )
}

// ══════════════════════════════════════════════════════════════════════════
//  ApiKeyReveal — one-time display of a freshly minted api_key.
//
//  Designed to feel weighty: the key sits on a warm paper card with a
//  copy button and a clear "сохрани сейчас" warning. The dialog's
//  click-outside-to-dismiss is intentionally disabled while the key is
//  visible — the operator must click "Я сохранил" to dismiss.
// ══════════════════════════════════════════════════════════════════════════

function ApiKeyReveal({
  clientId, apiKey, onClose,
}: {
  clientId: string
  apiKey: string
  onClose: () => void
}) {
  const [copied, setCopied] = useState(false)

  async function copy() {
    try {
      await navigator.clipboard.writeText(apiKey)
      setCopied(true)
      setTimeout(() => setCopied(false), 1500)
    } catch {
      toast.error('Браузер не дал скопировать. Скопируйте вручную.')
    }
  }

  return (
    <div>
      <div className="chapter-num">— ключ выпущен</div>
      <h2 className="display-em text-brand-700 text-2xl mt-1">
        Сохраните API-ключ
      </h2>
      <p className="text-sm text-ink-muted mt-2">
        Это единственный раз, когда мы показываем этот ключ. Сервер
        хранит только его хеш — повторно мы его восстановить не сможем.
      </p>

      <div className="card-paper mt-5 p-4">
        <div className="eyebrow">client_id</div>
        <div className="font-mono text-sm mt-0.5">{clientId}</div>

        <div className="eyebrow mt-4">api_key</div>
        <div className="mt-1 flex items-center gap-2">
          <code className="font-mono text-xs flex-1 break-all bg-surface-raised px-3 py-2 rounded ring-1 ring-paper-deep">
            {apiKey}
          </code>
          <button
            type="button"
            className={copied ? 'btn-secondary !ring-success !text-success' : 'btn-secondary'}
            onClick={copy}
            title="Скопировать"
          >
            {copied ? '✓ скопирован' : 'Скопировать'}
          </button>
        </div>
      </div>

      <div className="rounded-md bg-warn-bg text-warn px-3 py-2 text-xs mt-4">
        Если потеряете ключ — администратор может выпустить новый
        через «Ротировать», но при этом старый перестанет работать.
      </div>

      <div className="flex justify-end gap-2 mt-5">
        <button type="button" className="btn-primary" onClick={onClose}>
          Я сохранил, закрыть
        </button>
      </div>
    </div>
  )
}

// ══════════════════════════════════════════════════════════════════════════
//  RotateKeyButton — emit a fresh api_key for an existing client.
//
//  Two-step UX: confirmation prompt → reveal new key. Old key is
//  invalidated server-side immediately on mutation success.
// ══════════════════════════════════════════════════════════════════════════

function RotateKeyButton({ clientId }: { clientId: string }) {
  const [confirming, setConfirming] = useState(false)
  const [issued, setIssued] = useState<string | null>(null)

  const { mutate, isPending } = useMutation({
    mutationFn: () => clientsApi.rotateApiKey(clientId),
    onSuccess: (resp) => {
      setIssued(resp.api_key)
      setConfirming(false)
      toast.success('Новый ключ выпущен. Старый теперь недействителен.')
    },
    onError: (e) => toast.error(errorMessage(e, 'Ротация не удалась')),
  })

  return (
    <>
      <button
        type="button"
        className="btn-ghost !px-2 !py-1 text-xs"
        onClick={() => setConfirming(true)}
        title="Выпустить новый api_key (старый перестанет работать)"
      >
        Ротировать
      </button>

      {confirming && !issued && (
        <div
          role="dialog"
          className="fixed inset-0 z-50 flex items-center justify-center bg-ink/40 p-4"
          onClick={() => !isPending && setConfirming(false)}
        >
          <div
            className="card w-full max-w-md p-6 animate-fade-in"
            onClick={(e) => e.stopPropagation()}
          >
            <h2 className="display-em text-brand-700 text-xl">Ротировать api_key?</h2>
            <p className="text-sm text-ink-muted mt-3">
              Будет выпущен новый ключ для <code className="font-mono">{clientId}</code>.
              Старый ключ <strong>немедленно</strong> перестанет работать —
              убедитесь, что клиент готов получить новый.
            </p>
            <div className="flex justify-end gap-2 mt-5">
              <button
                type="button"
                className="btn-secondary"
                onClick={() => setConfirming(false)}
                disabled={isPending}
              >
                Отмена
              </button>
              <button
                type="button"
                className="btn-danger"
                onClick={() => mutate()}
                disabled={isPending}
              >
                {isPending ? 'Выпуск…' : 'Да, ротировать'}
              </button>
            </div>
          </div>
        </div>
      )}

      {issued && (
        <div
          role="dialog"
          className="fixed inset-0 z-50 flex items-center justify-center bg-ink/40 p-4"
          onClick={(e) => e.stopPropagation()}
        >
          <div
            className="card w-full max-w-md p-6 animate-fade-in"
            onClick={(e) => e.stopPropagation()}
          >
            <ApiKeyReveal
              clientId={clientId}
              apiKey={issued}
              onClose={() => setIssued(null)}
            />
          </div>
        </div>
      )}
    </>
  )
}
