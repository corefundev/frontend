// AZ-1 (#465): «Автозаказ» — порт утверждённого прототипа
// (backend docs/design/cabinet-v2/screen_autoorder.png):
// селектор датасета · «заказ на N дней · на основе прогноза от …» ·
// слайдер уровня сервиса («дефицит дороже хранения N:1») ·
// таблица ОСТАТОК → ПРОГНОЗ СПРОСА → СТРАХОВОЙ ЗАПАС → РЕКОМЕНДУЕМЫЙ ЗАКАЗ
// с правкой количества · футер-формула · «Выгрузить заказ для 1С».
// Заказ пересчитывается на лету из калиброванных p10/p90 — смена уровня
// сервиса не требует переобучения; выгрузка уважает ручные правки
// (собирается на клиенте в том же 1С-формате: BOM, ';', десятичная запятая).
import { useEffect, useMemo, useState } from 'react'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import toast from 'react-hot-toast'

import { useAuthStore } from '../../features/auth/store'
import { useUsage } from '../../features/plans/useUsage'
import { configApi } from '../../features/config/api'
import { apiClient, errorMessage } from '../../shared/api/client'

interface OrderItem {
  sku: string
  stock: number | null
  demand_sum: number
  safety_sum: number | null
  order_sum: number | null
  order_qty: number | null
  p10_sum: number | null
  p90_sum: number | null
  days: number
  days_covered: number
}

interface OrderRecommendations {
  client_id: string
  dataset_id: string | null
  service_level: number
  window: number
  generated_at: string | null
  first_date: string | null
  last_date: string | null
  count: number
  items: OrderItem[]
}

interface DatasetRow {
  dataset_id: string
  name: string
  status: string
}

const WINDOW = 14

export default function OrdersPage() {
  const clientId = useAuthStore((s) => s.clientId)!
  const { data: usage } = useUsage()
  const qc = useQueryClient()
  const paid = usage != null && usage.plan !== 'free'

  const { data: datasets } = useQuery({
    queryKey: ['datasets', clientId],
    queryFn: async () => {
      const { data } = await apiClient.get<{ datasets: DatasetRow[] }>(
        `/clients/${clientId}/datasets`)
      return data.datasets
    },
  })
  const [dsId, setDsId] = useState<string | null>(null)
  const dataset = dsId ?? datasets?.[0]?.dataset_id ?? null

  // Слайдер уровня сервиса: превью на лету (платно), сохранение — в конфиг.
  const [tauDraft, setTauDraft] = useState<number | null>(null)

  const { data, isLoading, isError } = useQuery({
    queryKey: ['order-recommendations', clientId, dataset, tauDraft],
    queryFn: async () => {
      const params: Record<string, unknown> = { window: WINDOW }
      if (dataset) params.dataset_id = dataset
      if (tauDraft != null) params.service_level = tauDraft
      const { data } = await apiClient.get<OrderRecommendations>(
        `/clients/${clientId}/order-recommendations`, { params })
      return data
    },
  })

  const tau = tauDraft ?? data?.service_level ?? 0.7
  // «дефицит дороже хранения (N:1)»: τ = Cu/(Cu+Co) → N = τ/(1−τ)
  const ratio = Math.round((tau / (1 - tau)) * 10) / 10

  // Ручные правки количества (сбрасываются при смене датасета/уровня)
  const [edits, setEdits] = useState<Record<string, number>>({})
  useEffect(() => { setEdits({}) }, [dataset, data?.service_level, tauDraft])

  const items = useMemo(
    () => [...(data?.items ?? [])].sort(
      (a, b) => (b.order_qty ?? -1) - (a.order_qty ?? -1)),
    [data])

  const save = useMutation({
    mutationFn: (t: number) =>
      configApi.patch(clientId, 'model.service_level', Number(t.toFixed(2))),
    onSuccess: () => {
      toast.success('Уровень сервиса сохранён')
      setTauDraft(null)
      void qc.invalidateQueries({ queryKey: ['order-recommendations', clientId] })
    },
    onError: (e) => toast.error(errorMessage(e, 'Не удалось сохранить')),
  })

  const exportCsv = () => {
    const header = 'sku;Остаток;Спрос (прогноз);Страховой запас;К заказу'
    const fmt = (v: number | null, digits = 2) =>
      v == null ? '' : v.toFixed(digits).replace('.', ',')
    const lines = items.map((i) => [
      i.sku,
      fmt(i.stock, 0),
      fmt(i.demand_sum),
      fmt(i.safety_sum),
      String(edits[i.sku] ?? i.order_qty ?? ''),
    ].join(';'))
    const blob = new Blob(
      ['﻿' + [header, ...lines].join('\r\n') + '\r\n'],
      { type: 'text/csv;charset=utf-8' })
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url
    a.download = `order-${WINDOW}d.csv`
    a.click()
    URL.revokeObjectURL(url)
  }

  const generatedAt = data?.generated_at
    ? new Date(data.generated_at).toLocaleString('ru-RU', {
        day: '2-digit', month: '2-digit', hour: '2-digit', minute: '2-digit',
      })
    : null

  return (
    <div className="max-w-5xl space-y-4">
      <div className="flex flex-wrap items-center gap-3">
        {datasets && datasets.length > 0 && (
          <select
            className="input !w-auto pr-8 font-medium"
            value={dataset ?? ''}
            onChange={(e) => setDsId(e.target.value)}
            aria-label="Датасет"
          >
            {datasets.map((d) => (
              <option key={d.dataset_id} value={d.dataset_id}>{d.name}</option>
            ))}
          </select>
        )}
        <span className="text-sm text-ink-muted">
          заказ на <b className="text-ink">{WINDOW} дней</b>
          {generatedAt && <> · на основе прогноза от <b className="text-ink">{generatedAt}</b></>}
        </span>
        <div className="flex-1" />
        <button type="button" className="btn-primary text-sm"
                onClick={exportCsv} disabled={!items.length}>
          Выгрузить заказ для 1С
        </button>
      </div>

      <div className="card-paper px-5 py-4 flex flex-wrap items-center gap-5">
        <div className="min-w-40">
          <div className="text-[11px] uppercase tracking-wide text-ink-subtle">Уровень сервиса</div>
          <div className="text-sm text-ink mt-0.5">
            <b>{Math.round(tau * 100)}%</b>
            <span className="text-ink-muted"> — дефицит дороже хранения ({ratio}:1)</span>
          </div>
        </div>
        <input
          type="range" min={50} max={95} step={1}
          value={Math.round(tau * 100)}
          disabled={!paid}
          onChange={(e) => setTauDraft(Number(e.target.value) / 100)}
          className="flex-1 min-w-48 accent-brand-500"
          aria-label="Уровень сервиса"
        />
        <div className="text-xs text-ink-subtle max-w-52">
          выше уровень — меньше дефицит, больше запас на складе
        </div>
        {paid && tauDraft != null && (
          <button type="button" className="btn-secondary text-xs"
                  disabled={save.isPending}
                  onClick={() => save.mutate(tauDraft)}>
            Сохранить
          </button>
        )}
        {!paid && (
          <span className="badge-warn text-xs">настройка — на Start/Business</span>
        )}
      </div>

      <section className="card-paper overflow-hidden">
        {isLoading ? (
          <div className="h-40 animate-pulse bg-surface-muted/40" aria-hidden />
        ) : isError ? (
          <div className="px-5 py-6 text-sm text-danger">
            Не удалось загрузить рекомендации — попробуйте обновить страницу.
          </div>
        ) : !items.length ? (
          <div className="px-5 py-6 text-sm text-ink-muted">
            Прогнозов для этого датасета ещё нет — обучите модель.
          </div>
        ) : (
          <>
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="text-left text-[11px] uppercase tracking-wide text-ink-subtle border-b border-surface-border">
                    <th className="px-5 py-2.5 font-medium">SKU</th>
                    <th className="px-4 py-2.5 font-medium text-right">Остаток</th>
                    <th className="px-4 py-2.5 font-medium text-right">Прогноз спроса · {WINDOW} дн</th>
                    <th className="px-4 py-2.5 font-medium text-right">Страховой запас</th>
                    <th className="px-4 py-2.5 font-medium text-right text-brand-600">Рекомендуемый заказ</th>
                    <th className="px-5 py-2.5" />
                  </tr>
                </thead>
                <tbody className="divide-y divide-surface-border">
                  {items.map((i) => (
                    <OrderRow key={i.sku} item={i}
                              edited={edits[i.sku]}
                              onEdit={(v) => setEdits((e) => (
                                v == null
                                  ? Object.fromEntries(Object.entries(e).filter(([k]) => k !== i.sku))
                                  : { ...e, [i.sku]: v }
                              ))} />
                  ))}
                </tbody>
              </table>
            </div>
            <div className="px-5 py-3 border-t border-surface-border text-xs text-ink-subtle">
              Заказ = прогноз спроса + страховой запас − остаток. Страховой запас
              рассчитан из диапазона прогноза под уровень сервиса {Math.round(tau * 100)}%.
            </div>
          </>
        )}
      </section>
    </div>
  )
}

function OrderRow({ item: i, edited, onEdit }: {
  item: OrderItem
  edited: number | undefined
  onEdit: (v: number | null) => void
}) {
  const [editing, setEditing] = useState(false)
  const [draft, setDraft] = useState('')
  const qty = edited ?? i.order_qty

  return (
    <tr className="hover:bg-surface-muted/40">
      <td className="px-5 py-2.5 font-medium text-ink">{i.sku}</td>
      <td className="px-4 py-2.5 text-right tabular-nums">
        {i.stock != null ? i.stock.toFixed(0) : '—'}
      </td>
      <td className="px-4 py-2.5 text-right tabular-nums">
        {i.demand_sum.toLocaleString('ru-RU', { maximumFractionDigits: 0 })}
      </td>
      <td className="px-4 py-2.5 text-right tabular-nums text-ink-muted">
        {i.safety_sum != null ? `+${Math.max(0, Math.round(i.safety_sum))}` : '—'}
      </td>
      <td className="px-4 py-2.5 text-right tabular-nums font-semibold text-ink">
        {editing ? (
          <input
            autoFocus
            className="input !w-24 text-right !py-1"
            inputMode="numeric"
            value={draft}
            onChange={(e) => setDraft(e.target.value)}
            onBlur={() => {
              const v = parseInt(draft, 10)
              onEdit(Number.isFinite(v) && v >= 0 ? v : null)
              setEditing(false)
            }}
            onKeyDown={(e) => { if (e.key === 'Enter') (e.target as HTMLInputElement).blur() }}
          />
        ) : (
          <>
            {qty != null ? qty.toLocaleString('ru-RU') : '—'}
            {edited != null && <span className="text-xs text-ink-subtle font-normal"> · изм.</span>}
          </>
        )}
      </td>
      <td className="px-5 py-2.5 text-right">
        <button type="button"
                className="text-xs text-brand-600 hover:underline"
                onClick={() => {
                  setDraft(String(qty ?? 0))
                  setEditing(true)
                }}>
          изменить
        </button>
      </td>
    </tr>
  )
}
