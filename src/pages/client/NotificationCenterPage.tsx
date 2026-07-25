// NC-9 (#584): Центр уведомлений — полный список.
// Дизайн: прототип владельца 2026-07-26 (артефакт nc_design, «Очень
// круто. Реализуем»): группировка по дням (Сегодня/Вчера/Ранее),
// фильтры-чипы (Все/Непрочитанные/Системные/Анонсы — client-side, тип
// уже в данных), иконки-кружки цветом типа, «непрочитанное» —
// брендовая полоса слева + подложка, тип пилюлей в мета-строке.
// Механики: строка = НАСТОЯЩАЯ ссылка на /app/notifications/{id};
// «Отметить все прочитанными» — явное действие; «Показать ещё» по 50;
// CONTRACT-1: сбой бэка ≠ пустой ящик.
import { useMemo, useState } from 'react'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { Link } from 'react-router-dom'
import toast from 'react-hot-toast'

import { errorMessage } from '../../shared/api/client'
import { cabPath } from '../../shared/hostRouting'
import { useAuthStore } from '../../features/auth/store'
import {
  getNotifications,
  markNotificationsRead,
  type AppNotification,
} from '../../features/notifications/api'
import { NotificationIcon } from '../../features/notifications/NotificationIcon'

const PAGE = 50

type Filter = 'all' | 'unread' | 'system' | 'announcement'

const FILTERS: { id: Filter; label: string }[] = [
  { id: 'all', label: 'Все' },
  { id: 'unread', label: 'Непрочитанные' },
  { id: 'system', label: 'Системные' },
  { id: 'announcement', label: 'Анонсы' },
]

function dayGroup(iso: string): 'Сегодня' | 'Вчера' | 'Ранее' {
  const d = new Date(iso)
  const now = new Date()
  const startOfDay = (x: Date) => new Date(x.getFullYear(), x.getMonth(), x.getDate()).getTime()
  const diffDays = Math.round((startOfDay(now) - startOfDay(d)) / 86_400_000)
  if (diffDays <= 0) return 'Сегодня'
  if (diffDays === 1) return 'Вчера'
  return 'Ранее'
}

function metaTime(iso: string, group: string): string {
  const d = new Date(iso)
  if (Number.isNaN(d.getTime())) return iso
  if (group === 'Ранее') {
    return d.toLocaleDateString('ru-RU', { day: 'numeric', month: 'long' })
  }
  return d.toLocaleTimeString('ru-RU', { hour: '2-digit', minute: '2-digit' })
}

function Row({ n, group }: { n: AppNotification; group: string }) {
  return (
    <li className="border-b border-surface-border last:border-b-0">
      <Link
        to={cabPath(`/app/notifications/${n.id}`)}
        className={`relative flex items-start gap-3.5 px-4 sm:px-5 py-3.5 transition-colors hover:bg-brand-50/60 ${
          !n.read_at ? 'bg-brand-50/30' : ''}`}
      >
        {!n.read_at && (
          <span className="absolute left-0 top-2.5 bottom-2.5 w-[3px] rounded-r bg-brand-500" aria-hidden />
        )}
        <NotificationIcon n={n} />
        <span className="min-w-0 flex-1">
          <span className={`block text-sm pr-16 ${n.read_at ? 'font-medium text-ink-muted' : 'font-semibold text-ink'}`}>
            {n.title}
          </span>
          {n.body && (
            <span className="block truncate text-[13px] text-ink-muted mt-0.5">
              {n.body}
            </span>
          )}
        </span>
        {/* правка владельца: дата в правом верхнем углу, без пилюли типа и шеврона */}
        <span className="absolute right-4 sm:right-5 top-3 text-[11.5px] text-ink-faint">
          {metaTime(n.created_at, group)}
        </span>
      </Link>
    </li>
  )
}

export default function NotificationCenterPage() {
  const clientId = useAuthStore((s) => s.clientId)!
  const qc = useQueryClient()
  // limit растёт, offset=0 — проще инвалидация, нет дыр при новых сверху
  const [pages, setPages] = useState(1)
  const [filter, setFilter] = useState<Filter>('all')

  const { data, isLoading, isError, refetch } = useQuery({
    queryKey: ['notifications-center', clientId, pages],
    queryFn: () => getNotifications(clientId, PAGE * pages, 0),
    refetchInterval: 30_000,
    meta: { silent: true },
  })

  const markRead = useMutation({
    mutationFn: (ids?: number[]) => markNotificationsRead(clientId, ids),
    onSuccess: () => {
      void qc.invalidateQueries({ queryKey: ['notifications-center', clientId] })
      void qc.invalidateQueries({ queryKey: ['notifications', clientId] })
    },
    onError: (e) => toast.error(errorMessage(e, 'Не удалось отметить прочитанным')),
  })

  const items = useMemo(() => data?.notifications ?? [], [data])
  const unread = data?.unread ?? 0
  const hasMore = (data?.count ?? 0) >= PAGE * pages

  const visible = useMemo(() => items.filter((n) => {
    if (filter === 'unread') return !n.read_at
    if (filter === 'system') return n.type === 'system'
    if (filter === 'announcement') return n.type === 'announcement'
    return true
  }), [items, filter])

  const groups = useMemo(() => {
    const out: { label: string; items: AppNotification[] }[] = []
    for (const n of visible) {
      const label = dayGroup(n.created_at)
      const last = out[out.length - 1]
      if (last && last.label === label) last.items.push(n)
      else out.push({ label, items: [n] })
    }
    return out
  }, [visible])

  const chipCount = (f: Filter): number | null => {
    if (f === 'all') return items.length
    if (f === 'unread') return unread
    return null
  }

  return (
    <div className="max-w-4xl space-y-5">
      <header className="flex flex-wrap items-end justify-between gap-4">
        <div>
          {/* reference_applayout_pagetitle: топ-бар уже говорит «Уведомления» */}
          <div className="eyebrow">события и анонсы</div>
          <h2 className="display-em text-brand-700 text-3xl mt-1">Центр уведомлений</h2>
        </div>
        {unread > 0 && (
          <button
            type="button"
            className="btn-secondary"
            disabled={markRead.isPending}
            onClick={() => markRead.mutate(undefined)}
          >
            ✓&nbsp; Отметить все прочитанными
          </button>
        )}
      </header>

      <div className="flex flex-wrap gap-2">
        {FILTERS.map((f) => {
          const count = chipCount(f.id)
          const on = filter === f.id
          return (
            <button
              key={f.id}
              type="button"
              onClick={() => setFilter(f.id)}
              aria-pressed={on}
              className={`rounded-full border px-3.5 py-1.5 text-[12.5px] font-semibold transition-colors ${
                on
                  ? 'border-ink bg-ink text-surface-raised'
                  : 'border-surface-border bg-surface-raised text-ink-muted hover:text-ink'}`}
            >
              {f.label}
              {count != null && count > 0 && (
                <span className={`ml-1 font-medium ${on ? 'opacity-70' : 'text-ink-faint'}`}>{count}</span>
              )}
            </button>
          )
        })}
      </div>

      {isLoading ? (
        <div className="h-40" aria-hidden />
      ) : isError ? (
        // CONTRACT-1: сбой ≠ «нет уведомлений»
        <div className="card p-6 text-sm">
          <p className="text-ink">Не удалось загрузить уведомления.</p>
          <button type="button" className="btn-secondary mt-3" onClick={() => void refetch()}>
            Повторить
          </button>
        </div>
      ) : visible.length === 0 ? (
        <div className="card p-10 text-center text-sm text-ink-muted">
          {filter === 'all' ? 'Уведомлений пока нет.' : 'Под этот фильтр ничего не попало.'}
        </div>
      ) : (
        <>
          {groups.map((g, gi) => (
            <section key={`${g.label}-${gi}`}>
              <div className="mb-2 mt-1 px-1 text-[12px] font-bold uppercase tracking-wider text-ink-faint">
                {g.label}
              </div>
              <ul className="card overflow-hidden">
                {g.items.map((n) => <Row key={n.id} n={n} group={g.label} />)}
              </ul>
            </section>
          ))}

          {hasMore && (
            <div className="text-center">
              <button
                type="button"
                className="rounded-full border border-surface-border bg-surface-raised px-5 py-2 text-[13px] font-semibold text-ink-muted hover:border-brand-500 hover:text-brand-600 transition-colors"
                onClick={() => setPages((p) => p + 1)}
              >
                Показать ещё
              </button>
            </div>
          )}
        </>
      )}
    </div>
  )
}
