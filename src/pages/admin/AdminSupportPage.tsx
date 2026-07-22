// SUP-5 (#508, эпик #503): «Ассистент» — пульт RAG-ассистента поддержки.
// Читает метрики диалогов из изолированного бота (через прод-прокси) и даёт
// одну кнопку действия — «Обновить знания»: пересобрать корпус из живой
// Базы знаний/Новостей/Тарифов и переиндексировать. Бот недоступен → 503 →
// честный офлайн-баннер, страница не падает (тот же приём, что «Система»).
import { useState } from 'react'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import toast from 'react-hot-toast'

import { errorMessage } from '../../shared/api/client'
import { supportAdminApi, type SupportMetrics } from '../../features/support/adminApi'
import AdminConfirmDialog, { type ConfirmSpec } from '../../components/AdminConfirmDialog'
import AdminQueryError from './AdminQueryError'

function Stat({ label, value, hint }: { label: string; value: string; hint?: string }) {
  return (
    <div className="card-paper px-5 py-4">
      <div className="text-2xl font-bold text-ink tabular-nums">{value}</div>
      <div className="mt-0.5 text-sm text-ink-muted">{label}</div>
      {hint && <div className="mt-0.5 text-xs text-ink-faint">{hint}</div>}
    </div>
  )
}

function QuestionList({ items, empty }: { items: SupportMetrics['top_questions']; empty: string }) {
  if (!items.length) return <div className="px-5 py-5 text-sm text-ink-muted">{empty}</div>
  return (
    <ul className="divide-y divide-surface-border text-sm">
      {items.map((q, i) => (
        <li key={i} className="flex items-center gap-3 px-5 py-2.5">
          <span className="badge-neutral tabular-nums">{q.count}</span>
          <span className="truncate text-ink">{q.question}</span>
        </li>
      ))}
    </ul>
  )
}

export default function AdminSupportPage() {
  const qc = useQueryClient()
  const [confirm, setConfirm] = useState<ConfirmSpec | null>(null)

  const { data, isError, refetch, error } = useQuery({
    queryKey: ['admin-support-metrics'],
    queryFn: supportAdminApi.metrics,
    refetchInterval: 60_000,
    retry: false,
    meta: { silent: true },
  })

  const reingestMut = useMutation({
    mutationFn: supportAdminApi.reingest,
    onSuccess: (r) => {
      if (r.ok) toast.success(`Знания обновлены${r.result ? ` — ${r.result}` : ''}`)
      else toast.error(`Переиндексация не удалась: ${r.error ?? 'см. логи бота'}`)
      void qc.invalidateQueries({ queryKey: ['admin-support-metrics'] })
    },
    onError: (e) => toast.error(errorMessage(e, 'Ассистент недоступен')),
  })

  // 503 = бот офлайн; это не ошибка консоли — показываем баннер, а не красный экран.
  const offline = isError
    && typeof error === 'object' && error !== null
    && 'response' in error
    && (error as { response?: { status?: number } }).response?.status === 503

  const askReingest = () => setConfirm({
    title: 'Обновить знания ассистента',
    body: 'Соберём свежий снапшот Базы знаний, Новостей и Тарифов и переиндексируем '
        + 'корпус ассистента. Занимает до минуты; на время переиндексации ответы не прерываются.',
    actionLabel: 'Обновить',
    onConfirm: () => reingestMut.mutate(),
  })

  return (
    <div className="max-w-5xl space-y-6">
      <section className="card-paper flex flex-wrap items-center justify-between gap-3 p-5">
        <div>
          <h3 className="text-sm font-semibold text-ink">База знаний ассистента</h3>
          <p className="mt-0.5 text-sm text-ink-muted">
            Ассистент отвечает по опубликованным статьям Помощи, Новостям и Тарифам.
            Изменили контент — нажмите «Обновить знания», чтобы он их подхватил.
          </p>
        </div>
        <button
          type="button"
          onClick={askReingest}
          disabled={reingestMut.isPending}
          className="btn-primary whitespace-nowrap"
        >
          {reingestMut.isPending ? 'Обновляем…' : 'Обновить знания'}
        </button>
      </section>

      {offline ? (
        <section className="card-paper p-6 text-sm text-ink-muted">
          Ассистент сейчас недоступен — метрики диалогов не получены. Кнопка «Обновить
          знания» станет активной, когда бот ответит. Состояние виджета на сайте
          отражает то же самое (офлайн-баннер вместо чата).
        </section>
      ) : isError ? (
        <AdminQueryError what="метрики ассистента" onRetry={() => void refetch()} />
      ) : !data ? (
        <div className="h-40" aria-hidden />
      ) : (
        <>
          <div className="grid grid-cols-2 gap-4 sm:grid-cols-4">
            <Stat label="Диалогов" value={String(data.total)} hint={`за ${data.window_days} дн`} />
            <Stat label="Сессий" value={String(data.sessions)} />
            <Stat
              label="Эскалаций"
              value={String(data.escalated)}
              hint={`${Math.round(data.escalation_rate * 100)}% вопросов`}
            />
            <Stat label="Хранение" value={`${data.retention_days} дн`} hint="автоочистка" />
          </div>

          <section className="card-paper overflow-hidden">
            <div className="border-b border-surface-border px-5 py-3 text-sm font-semibold">
              Не ответил (эскалации) — что добавить в базу знаний
            </div>
            <QuestionList
              items={data.unanswered}
              empty="Ассистент ответил на всё за окно — эскалаций по контенту нет."
            />
          </section>

          <section className="card-paper overflow-hidden">
            <div className="border-b border-surface-border px-5 py-3 text-sm font-semibold">
              Частые вопросы
            </div>
            <QuestionList items={data.top_questions} empty="Пока нет вопросов за окно." />
          </section>

          <section className="card-paper overflow-hidden">
            <div className="border-b border-surface-border px-5 py-3 text-sm font-semibold">
              Последние диалоги
            </div>
            {!data.recent.length ? (
              <div className="px-5 py-5 text-sm text-ink-muted">Диалогов пока не было.</div>
            ) : (
              <ul className="divide-y divide-surface-border">
                {data.recent.map((r, i) => (
                  <li key={i} className="px-5 py-3">
                    <div className="flex items-center gap-2">
                      <span className={r.escalated ? 'badge-warn' : 'badge-success'}>
                        {r.escalated ? 'эскалация' : 'ответ'}
                      </span>
                      <span className="badge-neutral">{r.surface === 'cabinet' ? 'кабинет' : 'сайт'}</span>
                      <span className="text-xs text-ink-faint">
                        {new Date(r.ts).toLocaleString('ru-RU', {
                          day: '2-digit', month: '2-digit', hour: '2-digit', minute: '2-digit',
                        })}
                      </span>
                    </div>
                    <div className="mt-1 text-sm font-medium text-ink">{r.question}</div>
                    <div className="mt-0.5 line-clamp-2 text-sm text-ink-muted">{r.answer}</div>
                  </li>
                ))}
              </ul>
            )}
          </section>
        </>
      )}

      <AdminConfirmDialog spec={confirm} onClose={() => setConfirm(null)} />
    </div>
  )
}
