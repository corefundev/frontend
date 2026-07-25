// NC-9 (#584): Центр уведомлений — полный список.
//
// Контракты (утверждены владельцем 2026-07-26):
// v2 (уточнение владельца): уведомление = сущность со своей страницей
// («как новость») — центр это ЧИСТЫЙ СПИСОК-ССЫЛКИ на /app/notifications/{id};
// никакого аккордеона. Прочитанность помечается на странице уведомления.
//   • свежие сверху; непрочитанные выделены;
//   • «Отметить все прочитанными» — явное действие;
//   • пагинация «Показать ещё» по 50 (limit/offset API);
//   • CONTRACT-1: ошибка бэка ≠ пустой ящик — честная плашка с retry.
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
  type NotificationSeverity,
} from '../../features/notifications/api'

const PAGE = 50

const SEVERITY_DOT: Record<NotificationSeverity, string> = {
  info:    'bg-brand-500',
  success: 'bg-emerald-500',
  warning: 'bg-amber-500',
  error:   'bg-red-500',
}

function fmtFull(iso: string): string {
  const d = new Date(iso)
  return Number.isNaN(d.getTime()) ? iso : d.toLocaleString('ru-RU', {
    day: 'numeric', month: 'long', year: 'numeric',
    hour: '2-digit', minute: '2-digit',
  })
}

export default function NotificationCenterPage() {
  const clientId = useAuthStore((s) => s.clientId)!
  const qc = useQueryClient()
  // сколько страниц раскрыто «Показать ещё» (limit растёт, offset=0 —
  // проще инвалидация и нет дыр при приходе новых уведомлений сверху)
  const [pages, setPages] = useState(1)

  const { data, isLoading, isError, refetch } = useQuery({
    queryKey: ['notifications-center', clientId, pages],
    queryFn: () => getNotifications(clientId, PAGE * pages, 0),
    refetchInterval: 30_000,
    meta: { silent: true },
  })

  const markRead = useMutation({
    mutationFn: (ids?: number[]) => markNotificationsRead(clientId, ids),
    onSuccess: () => {
      // оба потребителя состояния: центр и колокольчик
      void qc.invalidateQueries({ queryKey: ['notifications-center', clientId] })
      void qc.invalidateQueries({ queryKey: ['notifications', clientId] })
    },
    onError: (e) => toast.error(errorMessage(e, 'Не удалось отметить прочитанным')),
  })

  const items = useMemo(() => data?.notifications ?? [], [data])
  const unread = data?.unread ?? 0
  // count < запрошенного лимита ⇒ дальше пусто
  const hasMore = (data?.count ?? 0) >= PAGE * pages

  return (
    <div className="max-w-3xl space-y-6">
      <header className="flex flex-wrap items-end justify-between gap-4">
        <div>
          {/* reference_applayout_pagetitle: топ-бар уже говорит «Уведомления» —
              внутренний hero редакционный, не дубль */}
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
            Отметить все прочитанными ({unread})
          </button>
        )}
      </header>

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
      ) : items.length === 0 ? (
        <div className="card p-10 text-center text-sm text-ink-muted">
          Уведомлений пока нет.
        </div>
      ) : (
        <>
          <ul className="card divide-y divide-surface-border overflow-hidden">
            {items.map((n) => (
              <li key={n.id}>
                <Link
                  to={cabPath(`/app/notifications/${n.id}`)}
                  className={`flex gap-3 items-start px-5 py-3.5 transition-colors hover:bg-surface-muted/50 ${
                    !n.read_at ? 'bg-brand-50/40' : ''}`}
                >
                  <span
                    className={`mt-1.5 h-2 w-2 shrink-0 rounded-full ${SEVERITY_DOT[n.severity] ?? SEVERITY_DOT.info} ${n.read_at ? 'opacity-30' : ''}`}
                    aria-hidden
                  />
                  <span className="min-w-0 flex-1">
                    <span className={`block text-sm ${n.read_at ? 'text-ink-muted' : 'text-ink font-semibold'}`}>
                      {n.title}
                    </span>
                    {n.body && (
                      <span className="block truncate text-xs text-ink-muted mt-0.5">
                        {n.body}
                      </span>
                    )}
                    <span className="block text-[11px] text-ink-faint mt-1">
                      {fmtFull(n.created_at)}
                    </span>
                  </span>
                  <svg width="16" height="16" viewBox="0 0 24 24" fill="none"
                       stroke="currentColor" strokeWidth="2" strokeLinecap="round"
                       className="mt-1 shrink-0 text-ink-faint" aria-hidden>
                    <path d="M9 6l6 6-6 6" />
                  </svg>
                </Link>
              </li>
            ))}
          </ul>

          {hasMore && (
            <div className="text-center">
              <button
                type="button"
                className="btn-secondary"
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
