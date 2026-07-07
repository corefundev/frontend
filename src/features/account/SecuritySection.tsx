// AC-2 (#313) — Безопасность. API-key rotation (one-time reveal) + login
// history + sign-in methods (read). All from existing endpoints. OAuth
// link/unlink is a follow-up (unlink needs a backend endpoint + last-method guard).
import { useState } from 'react'
import { useMutation, useQuery } from '@tanstack/react-query'
import toast from 'react-hot-toast'

import { apiClient, errorMessage } from '../../shared/api/client'
import { clientsApi } from '../clients/api'
import { useAuthStore } from '../auth/store'

const PROVIDER_LABEL: Record<string, string> = { google: 'Google', yandex: 'Яндекс', vk: 'VK' }

interface SecurityEvent { ts: string; event_type: string; event_subtype: string | null; ip: string | null }
interface AuditResponse { count: number; events: SecurityEvent[] }

const EVENT_LABEL: Record<string, string> = {
  login: 'Вход', logout: 'Выход', otp_verify: 'Подтверждение кода',
  oauth_callback: 'Вход через провайдера', signup: 'Регистрация',
  plan_change: 'Смена тарифа', email_change: 'Смена email',
  password_change: 'Смена ключа/доступа',
}

function fmtTs(iso: string): string {
  const d = new Date(iso)
  return Number.isNaN(d.getTime()) ? iso : d.toLocaleString('ru-RU', { dateStyle: 'medium', timeStyle: 'short' })
}

export default function SecuritySection() {
  const clientId = useAuthStore((s) => s.clientId)!
  const [newKey, setNewKey] = useState<string | null>(null)

  const { data: rec } = useQuery({ queryKey: ['client', clientId], queryFn: () => clientsApi.get(clientId) })
  const { data: audit } = useQuery({
    queryKey: ['account-audit', clientId],
    queryFn: async () => (await apiClient.get<AuditResponse>(`/clients/${clientId}/audit`, { params: { limit: 20 } })).data,
  })

  const { mutate: rotate, isPending: rotating } = useMutation({
    mutationFn: () => clientsApi.rotateApiKey(clientId),
    onSuccess: (d) => { setNewKey(d.api_key); toast.success('Ключ обновлён') },
    onError: (e) => toast.error(errorMessage(e, 'Не удалось обновить ключ')),
  })

  return (
    <div className="space-y-6">
      {/* Sign-in methods */}
      <section className="card p-6 sm:p-8">
        <div className="text-sm text-ink-muted mb-2">Способы входа</div>
        <ul className="text-sm text-ink space-y-1">
          <li>• Email (одноразовый код на почту){rec?.email ? ` — ${rec.email}` : ''}</li>
          {rec?.oauth_provider && <li>• {PROVIDER_LABEL[rec.oauth_provider] ?? rec.oauth_provider}</li>}
        </ul>
      </section>

      {/* API key */}
      <section className="card p-6 sm:p-8">
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
          <div>
            <div className="font-medium text-ink">API-ключ</div>
            <p className="text-sm text-ink-muted mt-1 max-w-md">
              Для интеграций (1С и др.). При обновлении старый ключ сразу
              перестаёт работать.
            </p>
          </div>
          <button className="btn-secondary shrink-0" onClick={() => rotate()} disabled={rotating}>
            {rotating ? 'Обновляю…' : 'Обновить ключ'}
          </button>
        </div>
        {newKey && (
          <div className="mt-4 rounded-lg border border-brand-200 bg-brand-50 p-4">
            <p className="text-sm text-ink mb-2">
              Сохраните ключ — он показывается один раз:
            </p>
            <div className="flex items-center gap-2">
              <code className="flex-1 text-xs bg-surface-raised border border-surface-border rounded px-3 py-2 font-mono break-all">{newKey}</code>
              <button
                className="btn-secondary shrink-0"
                onClick={() => { navigator.clipboard?.writeText(newKey); toast.success('Скопировано') }}
              >
                Копировать
              </button>
            </div>
          </div>
        )}
      </section>

      {/* Login history */}
      <section className="card p-6 sm:p-8">
        <div className="font-medium text-ink mb-4">История входов и событий</div>
        {!audit?.events?.length ? (
          <p className="text-sm text-ink-muted">Пока нет событий.</p>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="text-left text-ink-muted border-b border-surface-border">
                  <th className="py-2 pr-4 font-medium">Событие</th>
                  <th className="py-2 pr-4 font-medium">Когда</th>
                  <th className="py-2 font-medium">IP</th>
                </tr>
              </thead>
              <tbody>
                {audit.events.map((e, i) => (
                  <tr key={i} className="border-b border-surface-border last:border-b-0">
                    <td className="py-2 pr-4 text-ink">{EVENT_LABEL[e.event_type] ?? e.event_type}</td>
                    <td className="py-2 pr-4 text-ink-muted">{fmtTs(e.ts)}</td>
                    <td className="py-2 text-ink-muted font-mono text-xs">{e.ip ?? '—'}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </section>
    </div>
  )
}
