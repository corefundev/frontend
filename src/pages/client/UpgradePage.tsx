import { useState } from 'react'
import { useMutation, useQueryClient } from '@tanstack/react-query'
import toast from 'react-hot-toast'

import { useAuthStore } from '../../features/auth/store'
import { useUsage } from '../../features/plans/useUsage'
import { apiClient, errorMessage } from '../../shared/api/client'
import type { PlanId } from '../../features/plans/api'

// ─────────────────────────────────────────────────────────────────────────
//  UpgradePage — self-service plan switch.
//
//  Right now the upgrade is INSTANT and free — there's no payment gateway
//  yet. The same path will become "create payment intent → confirm via
//  webhook" once acquiring is wired; the UI here doesn't change much.
//
//  Layout: 3 plan cards in editorial style (matches the public landing).
//  The active plan is marked, downgrades are allowed (a user's right to
//  leave). Click → confirm → POST /clients/{id}/upgrade → toast → invalidate
//  the usage query so the header counter and lock-states refresh.
// ─────────────────────────────────────────────────────────────────────────

interface PlanCardSpec {
  id: PlanId
  name: string
  modelName: string
  price: string
  priceNote: string
  bullets: string[]
  visualClass: 'card' | 'card-paper'
  badge?: { text: string; class: string }
}

const PLANS: PlanCardSpec[] = [
  {
    id:        'free',
    name:      'Free',
    modelName: 'Notus',
    price:     '0 ₽',
    priceNote: '14 дней без карты',
    bullets:   ['до 30 SKU', 'горизонт 7 дней', 'cooldown 12 ч между обучениями'],
    visualClass: 'card',
  },
  {
    id:        'start',
    name:      'Start',
    modelName: 'Aether',
    price:     '2 900 ₽',
    priceNote: 'в месяц',
    bullets:   ['до 1 500 SKU', 'горизонт 90 дней', '15 обучений в месяц'],
    visualClass: 'card',
    badge: { text: 'популярный', class: 'badge-info' },
  },
  {
    id:        'business',
    name:      'Business',
    modelName: 'Chronos',
    price:     'по запросу',
    priceNote: 'индивидуально',
    bullets:   ['без ограничений по SKU', 'горизонт 90 дней', 'без cooldown, supports'],
    visualClass: 'card-paper',
    badge: { text: 'premium', class: 'badge-gold' },
  },
]

export default function UpgradePage() {
  const clientId = useAuthStore((s) => s.clientId)
  const { data: usage, isLoading } = useUsage()
  const qc = useQueryClient()
  const [pending, setPending] = useState<PlanId | null>(null)

  const currentPlan = usage?.plan ?? 'free'

  const upgradeMut = useMutation({
    mutationFn: (plan: PlanId) =>
      apiClient
        .post(`/clients/${encodeURIComponent(clientId ?? '')}/upgrade`, { plan })
        .then((r) => r.data),
    onMutate: (plan) => setPending(plan),
    onSuccess: async (resp: { display_name: string; changed: boolean }) => {
      setPending(null)
      if (resp.changed) toast.success(`Тариф изменён на ${resp.display_name}`)
      else toast(`Уже на ${resp.display_name}`)
      // refetchQueries (not just invalidate) so the header badge + SKU
      // counter pull fresh data right now, without waiting for the
      // 30s staleTime to elapse.
      await qc.refetchQueries({ queryKey: ['usage', clientId] })
    },
    onError: (e) => {
      setPending(null)
      toast.error(errorMessage(e, 'Не удалось сменить тариф'))
    },
  })

  function handlePick(plan: PlanId) {
    if (plan === currentPlan) return
    if (!confirm(`Сменить тариф на ${plan.toUpperCase()}? (Изменение применяется сразу)`)) return
    upgradeMut.mutate(plan)
  }

  return (
    <div className="max-w-6xl space-y-10">
      <header>
        <div className="eyebrow">— ваш тариф —</div>
        <h1 className="display-lg mt-3 leading-tight">
          Выберите подходящий <span className="display-em text-gold-600">план</span>.
        </h1>
        <p className="mt-4 text-sm text-ink-muted max-w-2xl leading-relaxed">
          Пока что апгрейд бесплатный и применяется мгновенно — мы тестируем продукт.
          Когда подключим эквайринг, переход на платные тарифы пойдёт через оплату.
        </p>
      </header>

      {isLoading ? (
        <div className="text-ink-muted">Загружаем текущий тариф…</div>
      ) : (
        <div className="grid gap-5 sm:grid-cols-3">
          {PLANS.map((p) => {
            const active = p.id === currentPlan
            const isPending = pending === p.id
            return (
              <div
                key={p.id}
                className={[
                  p.visualClass,
                  active ? 'ring-2 !ring-brand-500' : 'ring-1 ring-surface-border',
                  'p-7 relative flex flex-col',
                ].join(' ')}
              >
                {p.badge && !active && (
                  <span className={`absolute -top-3 left-7 ${p.badge.class} !rounded`}>
                    {p.badge.text}
                  </span>
                )}
                {active && (
                  <span className="absolute -top-3 left-7 badge-success !rounded">
                    активный
                  </span>
                )}

                <div className="font-display text-2xl text-brand-700">{p.name}</div>
                <div className="text-xs text-ink-subtle mt-1 font-mono">
                  модель: {p.modelName}
                </div>

                <div className="mt-4 flex items-baseline gap-2">
                  <span className="font-display text-3xl text-ink tabular-nums">
                    {p.price}
                  </span>
                  <span className="text-xs text-ink-subtle">{p.priceNote}</span>
                </div>

                <ul className="mt-6 space-y-2 text-sm text-ink-muted flex-1">
                  {p.bullets.map((b) => (
                    <li key={b} className="flex items-baseline gap-2">
                      <span className="text-gold-600">✦</span> {b}
                    </li>
                  ))}
                </ul>

                <button
                  type="button"
                  className={[
                    'mt-7',
                    active ? 'btn-tertiary' : 'btn-primary',
                    'w-full !text-sm',
                  ].join(' ')}
                  onClick={() => handlePick(p.id)}
                  disabled={active || isPending}
                  title={active ? 'Это ваш текущий тариф' : `Перейти на ${p.name}`}
                >
                  {active     ? 'Активный'
                  : isPending ? 'Меняем…'
                  :              'Выбрать'}
                </button>
              </div>
            )
          })}
        </div>
      )}

      <div className="text-xs text-ink-subtle leading-relaxed max-w-2xl border-t border-surface-border pt-6">
        <strong className="text-ink">Что меняется при апгрейде:</strong> расширяется
        лимит SKU, увеличивается горизонт прогноза, открываются Сценарии
        и Промо-режим (Business). При даунгрейде модель не пересчитывается
        — следующее обучение применит лимиты нового тарифа.
      </div>
    </div>
  )
}
