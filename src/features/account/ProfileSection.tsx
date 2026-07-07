// AC-2 (#313) — Профиль (read). Surfaces the account identity from existing
// endpoints (GET /clients/{id} + usage). Email change is AC-4; here it's read.
import { useQuery } from '@tanstack/react-query'

import { clientsApi } from '../clients/api'
import { useUsage } from '../plans/useUsage'
import { useAuthStore } from '../auth/store'

const PROVIDER_LABEL: Record<string, string> = { google: 'Google', yandex: 'Яндекс', vk: 'VK' }

function fmtDate(iso?: string | null): string {
  if (!iso) return '—'
  const d = new Date(iso)
  return Number.isNaN(d.getTime()) ? '—' : d.toLocaleDateString('ru-RU', { year: 'numeric', month: 'long', day: 'numeric' })
}

function Row({ label, value }: { label: string; value: React.ReactNode }) {
  return (
    <div className="flex flex-col sm:flex-row sm:items-baseline gap-1 sm:gap-4 py-3 border-b border-surface-border last:border-b-0">
      <div className="text-sm text-ink-muted sm:w-48 shrink-0">{label}</div>
      <div className="text-sm text-ink">{value}</div>
    </div>
  )
}

export default function ProfileSection() {
  const clientId = useAuthStore((s) => s.clientId)!
  const { data: rec } = useQuery({
    queryKey: ['client', clientId],
    queryFn: () => clientsApi.get(clientId),
  })
  const { data: usage } = useUsage()

  return (
    <section className="card p-6 sm:p-8">
      <p className="text-ink-muted text-sm mb-4">Данные вашего аккаунта.</p>

      <div>
        <Row label="Email" value={rec?.email ?? '—'} />
        <Row label="ID аккаунта" value={<span className="font-mono">{clientId}</span>} />
        <Row label="Дата регистрации" value={fmtDate(rec?.created_at)} />
        <Row
          label="Тариф"
          value={usage ? `${usage.plan === 'free' ? 'Free' : usage.plan === 'start' ? 'Start' : 'Business'} · ${usage.model_display_name}` : '—'}
        />
        <Row
          label="Способ входа"
          value={
            rec?.oauth_provider
              ? `Email + ${PROVIDER_LABEL[rec.oauth_provider] ?? rec.oauth_provider}`
              : 'Email (код на почту)'
          }
        />
      </div>
    </section>
  )
}
