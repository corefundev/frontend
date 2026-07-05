// ADM-1 (#254): admin announcements — compose, target (one client or ALL
// with a typed confirmation), sent history. Backend: NC-6 (#251), every
// send audit-logged server-side. Bodies are PLAIN TEXT end-to-end (H4).
import { useState } from 'react'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import toast from 'react-hot-toast'

import { adminNotificationsApi } from '../../features/notifications/api'
import { clientsApi } from '../../features/clients/api'
import { errorMessage } from '../../shared/api/client'

const SEVERITY_BADGE: Record<string, string> = {
  info:    'badge-info',
  warning: 'badge-warn',
}

export default function AdminNotificationsPage() {
  const qc = useQueryClient()
  const [title, setTitle] = useState('')
  const [body, setBody] = useState('')
  const [severity, setSeverity] = useState<'info' | 'warning'>('info')
  const [target, setTarget] = useState<string>('all')
  const [confirmAll, setConfirmAll] = useState('')

  const { data: clients = [] } = useQuery({
    queryKey: ['admin-clients'],
    queryFn: () => clientsApi.list(),
  })
  const { data: history } = useQuery({
    queryKey: ['admin-notifications-history'],
    queryFn: () => adminNotificationsApi.history(),
  })

  const sendMut = useMutation({
    mutationFn: () =>
      adminNotificationsApi.send({
        target: target === 'all' ? 'all' : [target],
        title: title.trim(),
        body: body.trim(),
        severity,
      }),
    onSuccess: (r) => {
      toast.success(`Отправлено: ${r.created} уведомл. (${r.target})`)
      setTitle(''); setBody(''); setConfirmAll('')
      qc.invalidateQueries({ queryKey: ['admin-notifications-history'] })
    },
    onError: (e) => toast.error(errorMessage(e, 'Не удалось отправить')),
  })

  const isBroadcast = target === 'all'
  // Blast-radius limit (design §1.3): broadcast needs the word ВСЕМ typed.
  const broadcastArmed = !isBroadcast || confirmAll.trim().toUpperCase() === 'ВСЕМ'
  const canSend = title.trim().length > 0 && title.length <= 200 &&
    body.length <= 2000 && broadcastArmed && !sendMut.isPending

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-semibold tracking-tight">Уведомления</h1>
        <p className="text-ink-muted mt-1 text-sm">
          Отправка объявлений в центр уведомлений клиентов. Каждая отправка
          фиксируется в журнале аудита.
        </p>
      </div>

      <form
        className="card-paper p-5 space-y-4 max-w-2xl"
        onSubmit={(e) => { e.preventDefault(); if (canSend) sendMut.mutate() }}
      >
        <div className="grid grid-cols-2 gap-4">
          <label className="block text-sm">
            <span className="text-ink-muted">Получатель</span>
            <select
              className="input mt-1 w-full"
              value={target}
              onChange={(e) => { setTarget(e.target.value); setConfirmAll('') }}
            >
              <option value="all">Все клиенты ({clients.length})</option>
              {clients.map((c) => (
                <option key={c.client_id} value={c.client_id}>{c.client_id}</option>
              ))}
            </select>
          </label>
          <label className="block text-sm">
            <span className="text-ink-muted">Важность</span>
            <select
              className="input mt-1 w-full"
              value={severity}
              onChange={(e) => setSeverity(e.target.value as 'info' | 'warning')}
            >
              <option value="info">Информация</option>
              <option value="warning">Предупреждение</option>
            </select>
          </label>
        </div>

        <label className="block text-sm">
          <span className="text-ink-muted">Заголовок ({title.length}/200)</span>
          <input
            className="input mt-1 w-full" value={title} maxLength={200}
            onChange={(e) => setTitle(e.target.value)}
            placeholder="Плановые работы 10 июля 03:00–04:00 МСК"
          />
        </label>

        <label className="block text-sm">
          <span className="text-ink-muted">Текст ({body.length}/2000)</span>
          <textarea
            className="input mt-1 w-full min-h-24" value={body} maxLength={2000}
            onChange={(e) => setBody(e.target.value)}
            placeholder="Сервис будет недоступен несколько минут…"
          />
        </label>

        {isBroadcast && (
          <label className="block text-sm">
            <span className="text-amber-600 font-medium">
              Рассылка ВСЕМ клиентам ({clients.length}). Для подтверждения введите: ВСЕМ
            </span>
            <input
              className="input mt-1 w-full" value={confirmAll}
              onChange={(e) => setConfirmAll(e.target.value)}
              placeholder="ВСЕМ"
            />
          </label>
        )}

        <button type="submit" className="btn-primary" disabled={!canSend}>
          {sendMut.isPending ? 'Отправка…' : 'Отправить'}
        </button>
      </form>

      <div className="card-paper overflow-hidden max-w-4xl">
        <div className="px-5 py-3 border-b border-surface-border font-semibold text-sm">
          История отправок
        </div>
        {!history?.notifications?.length ? (
          <div className="px-5 py-8 text-sm text-ink-muted text-center">Пока пусто</div>
        ) : (
          <table className="w-full text-sm">
            <tbody>
              {history.notifications.map((n) => (
                <tr key={n.id} className="border-b border-surface-border last:border-b-0">
                  <td className="px-5 py-2.5 font-mono text-xs text-ink-muted whitespace-nowrap">
                    {new Date(n.created_at).toLocaleString('ru-RU')}
                  </td>
                  <td className="px-3 py-2.5 font-mono text-xs">{n.client_id}</td>
                  <td className="px-3 py-2.5">
                    <span className={SEVERITY_BADGE[n.severity] ?? 'badge-neutral'}>
                      {n.severity}
                    </span>
                  </td>
                  <td className="px-3 py-2.5 text-ink">{n.title}</td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>
    </div>
  )
}
