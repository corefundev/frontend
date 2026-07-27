// «Интеграция» (#472 правки 2026-07-28): API-доступ — переехал из
// раздела «Безопасность» в самостоятельный раздел.
import { useState } from 'react'
import { useMutation } from '@tanstack/react-query'
import toast from 'react-hot-toast'

import { errorMessage } from '../../shared/api/client'
import { clientsApi } from '../clients/api'
import { useAuthStore } from '../auth/store'
import { SecRow } from './shared'

const IconKey = (
  <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"><circle cx="8" cy="15" r="4"/><path d="m11 12 9-9M17 6l3 3M14 9l2 2"/></svg>
)

export default function IntegrationSection() {
  const clientId = useAuthStore((s) => s.clientId)!
  const [newKey, setNewKey] = useState<string | null>(null)

  const { mutate: rotate, isPending: rotating } = useMutation({
    mutationFn: () => clientsApi.rotateApiKey(clientId),
    onSuccess: (d) => { setNewKey(d.api_key); toast.success('Ключ обновлён') },
    onError: (e) => toast.error(errorMessage(e, 'Не удалось обновить ключ')),
  })

  return (
    <section className="card p-6 sm:p-8">
      <div className="divide-y divide-surface-border">
        <SecRow
          icon={IconKey}
          title="API-ключ"
          subtitle="Для интеграций (1С и др.). Старый ключ перестаёт работать сразу"
          action={
            <button className="btn-secondary" onClick={() => rotate()} disabled={rotating}>
              {rotating ? 'Обновляю…' : 'Обновить'}
            </button>
          }
        />
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
  )
}
