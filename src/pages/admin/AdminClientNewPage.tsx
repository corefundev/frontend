// ADM-3/правки 2026-07-06: «Клиенты → Новый пользователь» — регистрация
// переехала из модалки списка в отдельную страницу.
import { useState } from 'react'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { Link, useNavigate } from 'react-router-dom'
import toast from 'react-hot-toast'

import { clientsApi, type RegisterClientRequest } from '../../features/clients/api'
import { plansApi, type PlanId } from '../../features/plans/api'
import { errorMessage } from '../../shared/api/client'

export default function AdminClientNewPage() {
  const qc = useQueryClient()
  const nav = useNavigate()
  const { data: plans = [] } = useQuery({
    queryKey: ['plans'], queryFn: () => plansApi.list(),
  })
  const [form, setForm] = useState<RegisterClientRequest>({
    client_id: '', horizon: 14, plan: 'free',
  })
  // One-time api_key display — the server stores only the hash; leaving
  // the page is the operator's explicit "I'm done" signal.
  const [issued, setIssued] = useState<{ clientId: string; apiKey: string } | null>(null)

  const { mutate, isPending } = useMutation({
    mutationFn: () => clientsApi.register(form),
    onSuccess: (resp) => {
      setIssued({ clientId: resp.client_id, apiKey: resp.api_key })
      qc.invalidateQueries({ queryKey: ['admin-clients'] })
    },
    onError: (e) => toast.error(errorMessage(e, 'Не удалось создать')),
  })

  if (issued) {
    return (
      <div className="card-paper p-6 max-w-md space-y-4">
        <h2 className="text-lg font-semibold">Клиент «{issued.clientId}» создан</h2>
        <p className="text-sm text-ink-muted">
          API-ключ показывается ОДИН раз — сервер хранит только хеш. Скопируйте:
        </p>
        <code className="block bg-surface-sunken rounded-md p-3 font-mono text-xs break-all select-all">
          {issued.apiKey}
        </code>
        <div className="flex gap-2">
          <button type="button" className="btn-secondary"
                  onClick={() => { navigator.clipboard?.writeText(issued.apiKey); toast.success('Скопировано') }}>
            Скопировать
          </button>
          <button type="button" className="btn-primary"
                  onClick={() => nav(`/admin/clients/${encodeURIComponent(issued.clientId)}`)}>
            Открыть карточку
          </button>
        </div>
      </div>
    )
  }

  return (
    <div className="max-w-md space-y-4">
      <Link to="/admin/clients" className="text-sm text-ink-muted hover:text-ink">← Клиенты</Link>
      <form
        className="card-paper p-6 space-y-4"
        onSubmit={(e) => {
          e.preventDefault()
          if (!form.client_id.trim()) return toast.error('Укажите client_id')
          mutate()
        }}
      >
        <h2 className="text-lg font-semibold">Новый пользователь</h2>
        <div>
          <label className="label" htmlFor="cid">Client ID</label>
          <input id="cid" className="input font-mono" value={form.client_id}
                 onChange={(e) => setForm({ ...form, client_id: e.target.value })}
                 required autoComplete="off" spellCheck={false} />
        </div>
        <div>
          <label className="label" htmlFor="plan">Тариф</label>
          <select id="plan" className="input" value={form.plan}
                  onChange={(e) => setForm({ ...form, plan: e.target.value as PlanId })}>
            {plans.map((p) => (
              <option key={p.id} value={p.id}>{p.display_name} · {p.model_display_name}</option>
            ))}
          </select>
        </div>
        <div>
          <label className="label" htmlFor="horizon">Горизонт по умолчанию</label>
          <input id="horizon" type="number" min={1} max={28} className="input"
                 value={form.horizon}
                 onChange={(e) => setForm({ ...form, horizon: Number(e.target.value) })} />
        </div>
        <button type="submit" className="btn-primary" disabled={isPending}>
          {isPending ? 'Создание…' : 'Создать'}
        </button>
      </form>
    </div>
  )
}
