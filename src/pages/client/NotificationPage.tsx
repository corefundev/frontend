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
import toast from 'react-hot-toast'

import {
  getNotification,
  markNotificationsRead,
} from '../../features/notifications/api'
import { NotificationIcon } from '../../features/notifications/NotificationIcon'
import { SEVERITY_TEXT, TYPE_LABEL } from '../../features/notifications/meta'

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
      <div className="max-w-4xl space-y-6">
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
    <div className="max-w-4xl space-y-6">
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
        <article className="card relative overflow-hidden">
          {/* правка владельца: копия ссылки — иконкой в правом верхнем углу */}
          <button
            type="button"
            aria-label="Скопировать ссылку на уведомление"
            title="Скопировать ссылку"
            className="absolute right-4 top-4 flex h-9 w-9 items-center justify-center rounded-full text-ink-faint transition-colors hover:bg-surface hover:text-brand-600"
            onClick={() => {
              void navigator.clipboard?.writeText(window.location.href)
              toast.success('Ссылка скопирована')
            }}
          >
            <svg width="17" height="17" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M10 13a5 5 0 0 0 7.5.5l3-3a5 5 0 0 0-7-7l-1.7 1.7" /><path d="M14 11a5 5 0 0 0-7.5-.5l-3 3a5 5 0 0 0 7 7l1.7-1.7" /></svg>
          </button>
          {/* правка владельца: кружок и текст по центру друг друга */}
          <div className="flex items-center gap-4 px-6 sm:px-8 pt-6 sm:pt-7 pr-14">
            <NotificationIcon n={{ ...data, read_at: data.read_at ?? 'seen' }} size="lg" />
            <div>
              <div className={`text-[12px] font-bold ${
                (SEVERITY_TEXT[data.severity] ?? SEVERITY_TEXT.info).cls}`}>
                {(SEVERITY_TEXT[data.severity] ?? SEVERITY_TEXT.info).label}
                <span className="text-ink-faint font-semibold"> · {TYPE_LABEL[data.type] ?? data.type}</span>
              </div>
              <time className="mt-0.5 block text-[12.5px] text-ink-faint" dateTime={data.created_at}>
                {fmtFull(data.created_at)}
              </time>
            </div>
          </div>
          <h1 className="px-6 sm:px-8 mt-4 text-[22px] sm:text-2xl font-semibold leading-snug tracking-tight text-ink">
            {data.title}
          </h1>
          {data.body && (
            // плоский текст с переносами — H4-контракт NC-6
            <div className="px-6 sm:px-8 mt-3.5 pb-7 max-w-[52em] text-[15px] leading-relaxed text-ink whitespace-pre-wrap break-words">
              {data.body}
            </div>
          )}
        </article>
      )}
    </div>
  )
}
