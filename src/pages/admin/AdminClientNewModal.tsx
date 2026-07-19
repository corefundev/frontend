// Регистрация нового пользователя — попап на странице «Клиенты»
// (вместо отдельной страницы/пункта меню). Одноразовый показ API-ключа:
// закрытие ТОЛЬКО кнопками (клик по подложке игнорируется, чтобы ключ
// не потерялся случайным кликом).
import { useState } from 'react'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { useNavigate } from 'react-router-dom'
import toast from 'react-hot-toast'

import { clientsApi, type RegisterClientRequest } from '../../features/clients/api'
import { plansApi, type PlanId } from '../../features/plans/api'
import { errorMessage } from '../../shared/api/client'
import AdminSelect from '../../components/AdminSelect'
import AdminQueryError from './AdminQueryError'
import { admPath } from '../../shared/hostRouting'

export default function AdminClientNewModal({ open, onClose }: {
  open: boolean
  onClose: () => void
}) {
  const qc = useQueryClient()
  const nav = useNavigate()
  const { data: plans = [], isError: plansError, refetch: refetchPlans } = useQuery({
    queryKey: ['plans'], queryFn: () => plansApi.list(), enabled: open,
  })
  const [form, setForm] = useState<RegisterClientRequest>({
    client_id: '', horizon: 14, plan: 'free',
  })
  const [issued, setIssued] = useState<{ clientId: string; apiKey: string } | null>(null)

  const { mutate, isPending } = useMutation({
    mutationFn: () => clientsApi.register(form),
    onSuccess: (resp) => {
      setIssued({ clientId: resp.client_id, apiKey: resp.api_key })
      qc.invalidateQueries({ queryKey: ['admin-clients'] })
    },
    onError: (e) => toast.error(errorMessage(e, 'Не удалось создать')),
  })

  if (!open) return null

  const close = () => {
    setForm({ client_id: '', horizon: 14, plan: 'free' })
    setIssued(null)
    onClose()
  }

  return (
    <div className="fixed inset-0 z-50 bg-slate-900/45 backdrop-blur-[2px] flex items-start justify-center pt-[16vh] p-4"
         role="dialog" aria-modal="true" aria-label="Новый пользователь">
      <div className="w-full max-w-md card-paper overflow-hidden admin-pop"
           style={{ boxShadow: 'var(--admin-shadow-lg)' }}>
        <div className="px-5 py-3 border-b border-surface-border bg-surface-muted/50 font-semibold text-[13px] flex items-center gap-2">
          <span aria-hidden className="h-[7px] w-[7px] rounded-full shrink-0 bg-brand-500" />
          Новый пользователь
        </div>

        {issued ? (
          <div className="p-5 space-y-4">
            <h2 className="text-base font-semibold">Клиент «{issued.clientId}» создан</h2>
            <p className="text-sm text-ink-muted">
              API-ключ показывается ОДИН раз — сервер хранит только хеш. Скопируйте:
            </p>
            <code className="block bg-surface-sunken rounded-md p-3 font-mono text-xs break-all select-all">
              {issued.apiKey}
            </code>
            <div className="flex gap-2">
              <button type="button" className="btn-secondary text-sm"
                      onClick={() => { navigator.clipboard?.writeText(issued.apiKey); toast.success('Скопировано') }}>
                Скопировать
              </button>
              <button type="button" className="btn-primary text-sm"
                      onClick={() => { const id = issued.clientId; close(); nav(admPath(`/admin/clients/${encodeURIComponent(id)}`)) }}>
                Открыть карточку
              </button>
              <button type="button" className="btn-ghost text-sm ml-auto" onClick={close}>
                Закрыть
              </button>
            </div>
          </div>
        ) : plansError ? (
          <div className="p-5 space-y-3">
            <AdminQueryError what="тарифы" onRetry={() => void refetchPlans()} />
            <button type="button" className="btn-ghost text-sm" onClick={close}>Закрыть</button>
          </div>
        ) : (
          <form className="p-5 space-y-4"
                onSubmit={(e) => {
                  e.preventDefault()
                  if (!form.client_id.trim()) return toast.error('Укажите client_id')
                  mutate()
                }}>
            <div>
              <label className="label" htmlFor="cid">Client ID</label>
              <input id="cid" className="input font-mono" value={form.client_id}
                     onChange={(e) => setForm({ ...form, client_id: e.target.value })}
                     required autoComplete="off" spellCheck={false} autoFocus />
            </div>
            <div>
              <label className="label" htmlFor="plan">Тариф</label>
              <AdminSelect ariaLabel="Тариф" value={form.plan ?? 'free'}
                           onChange={(v) => setForm({ ...form, plan: v as PlanId })}
                           options={plans.map((p) => ({
                             value: p.id, label: `${p.display_name} · ${p.model_display_name}` }))} />
            </div>
            <div>
              <label className="label" htmlFor="horizon">Горизонт по умолчанию</label>
              <input id="horizon" type="number" min={1} max={28} className="input"
                     value={form.horizon}
                     onChange={(e) => setForm({ ...form, horizon: Number(e.target.value) })} />
            </div>
            <div className="flex gap-2 justify-end">
              <button type="button" className="btn-secondary text-sm" onClick={close}>
                Отмена
              </button>
              <button type="submit" className="btn-primary text-sm" disabled={isPending}>
                {isPending ? 'Создание…' : 'Создать'}
              </button>
            </div>
          </form>
        )}
      </div>
    </div>
  )
}
