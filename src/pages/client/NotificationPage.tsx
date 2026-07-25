// NC-9 (#584 v2): страница ОДНОГО уведомления — «как новость».
// Уведомление = полноценная сущность: постоянная ссылка
// /app/notifications/{id}, открывается из дропдауна и из центра,
// шарится, живёт в истории браузера. Прочитанность помечается при
// открытии (поштучно). Honest states: 404 → «не найдено» с выходом в
// центр; 5xx → retry-плашка (CONTRACT-1). Тело — плоский текст (H4).
import { useEffect } from 'react'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { Link, useParams } from 'react-router-dom'

import { cabPath } from '../../shared/hostRouting'
import { useAuthStore } from '../../features/auth/store'
import {
  getNotification,
  markNotificationsRead,
  type NotificationSeverity,
} from '../../features/notifications/api'

const SEVERITY_LABEL: Record<NotificationSeverity, { text: string; cls: string }> = {
  info:    { text: 'Информация',      cls: 'bg-brand-50 text-brand-700' },
  success: { text: 'Успех',           cls: 'bg-emerald-50 text-emerald-700' },
  warning: { text: 'Предупреждение',  cls: 'bg-amber-50 text-amber-700' },
  error:   { text: 'Ошибка',          cls: 'bg-red-50 text-red-700' },
}

function fmtFull(iso: string): string {
  const d = new Date(iso)
  return Number.isNaN(d.getTime()) ? iso : d.toLocaleString('ru-RU', {
    day: 'numeric', month: 'long', year: 'numeric',
    hour: '2-digit', minute: '2-digit',
  })
}

export default function NotificationPage() {
  const clientId = useAuthStore((s) => s.clientId)!
  const { id: rawId } = useParams()
  const id = Number(rawId)
  const qc = useQueryClient()

  const { data, isLoading, isError, error, refetch } = useQuery({
    queryKey: ['notification', clientId, id],
    queryFn: () => getNotification(clientId, id),
    enabled: Number.isFinite(id),
    retry: false,
  })

  const markRead = useMutation({
    mutationFn: () => markNotificationsRead(clientId, [id]),
    onSuccess: () => {
      void qc.invalidateQueries({ queryKey: ['notifications', clientId] })
      void qc.invalidateQueries({ queryKey: ['notifications-center', clientId] })
      void qc.invalidateQueries({ queryKey: ['notification', clientId, id] })
    },
  })

  // открытие страницы = прочтение (поштучно, best-effort)
  useEffect(() => {
    if (data && !data.read_at) markRead.mutate()
    // eslint-disable-next-line react-hooks/exhaustive-deps -- один раз по факту загрузки
  }, [data?.id])

  const notFound = !!error && typeof error === 'object' && 'response' in error
    && (error as { response?: { status?: number } }).response?.status === 404

  const backLink = (
    <Link to={cabPath('/app/notifications')}
          className="text-sm font-medium text-brand-700 hover:text-brand-800">
      ← Все уведомления
    </Link>
  )

  if (!Number.isFinite(id) || notFound) {
    return (
      <div className="max-w-3xl space-y-6">
        {backLink}
        <div className="card p-10 text-center">
          <p className="text-sm text-ink">Уведомление не найдено.</p>
          <p className="text-xs text-ink-muted mt-1">
            Возможно, ссылка устарела или уведомление было адресовано другому аккаунту.
          </p>
        </div>
      </div>
    )
  }

  return (
    <div className="max-w-3xl space-y-6">
      {backLink}

      {isLoading ? (
        <div className="h-48" aria-hidden />
      ) : isError || !data ? (
        <div className="card p-6 text-sm">
          <p className="text-ink">Не удалось загрузить уведомление.</p>
          <button type="button" className="btn-secondary mt-3" onClick={() => void refetch()}>
            Повторить
          </button>
        </div>
      ) : (
        <article className="card p-6 sm:p-8">
          <div className="flex items-center gap-2 flex-wrap">
            <span className={`rounded-full px-2.5 py-0.5 text-[11px] font-semibold ${
              (SEVERITY_LABEL[data.severity] ?? SEVERITY_LABEL.info).cls}`}>
              {(SEVERITY_LABEL[data.severity] ?? SEVERITY_LABEL.info).text}
            </span>
            <time className="text-xs text-ink-faint" dateTime={data.created_at}>
              {fmtFull(data.created_at)}
            </time>
          </div>
          <h1 className="display-em text-brand-700 text-2xl sm:text-3xl mt-3">
            {data.title}
          </h1>
          {data.body && (
            // плоский текст с переносами — H4-контракт NC-6
            <div className="mt-5 text-[15px] leading-relaxed text-ink whitespace-pre-wrap break-words">
              {data.body}
            </div>
          )}
        </article>
      )}
    </div>
  )
}
