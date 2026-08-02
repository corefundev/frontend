// #570 PC-3: бейдж «акция dd.mm–dd.mm» на прогнозе SKU — предстоящие
// события активного календаря (v1: sku-события; категорийные — v2).
// Fail-open: нет календаря/событий/ошибка — бейджа просто нет.
import { useQuery } from '@tanstack/react-query'

import { promoCalendarApi } from './api'

function dm(iso: string): string {
  const d = new Date(iso)
  return Number.isNaN(d.getTime())
    ? iso
    : d.toLocaleDateString('ru-RU', { day: '2-digit', month: '2-digit' })
}

export function PromoBadge({ clientId, sku }: { clientId: string; sku: string }) {
  const { data } = useQuery({
    queryKey: ['promo-upcoming', clientId, sku],
    queryFn: () => promoCalendarApi.upcoming(clientId, sku),
    staleTime: 60_000,
    meta: { silent: true },
    retry: 1,
  })
  const events = data?.events ?? []
  if (events.length === 0) return null
  return (
    <div className="mt-2 flex flex-wrap gap-1.5">
      {events.slice(0, 3).map((e) => (
        <span
          key={`${e.date_from}-${e.date_to}`}
          className="badge badge-warn"
          title={e.name ?? 'Акция из календаря'}
        >
          акция {dm(e.date_from)}–{dm(e.date_to)}
        </span>
      ))}
    </div>
  )
}
