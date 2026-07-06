// ADM-12 (#280, Волна 3): «Безопасность» — история админ-входов (H3-tripwire
// как страница: каждый вход в консоль виден и в Telegram, и здесь), возраст
// ADMIN_API_KEY (маркер ротации; честное «неизвестно» до первой записанной
// ротации), статусы лестницы (именные админы — ADM-8, IP-allowlist — H8).
import { useQuery } from '@tanstack/react-query'

import { apiClient } from '../../shared/api/client'

interface SecurityInfo {
  admin_logins: { at: string; ip: string | null; user_agent: string; session: string }[]
  key_rotated_at: string | null
  key_age_days: number | null
  key_rotation_due: boolean
  named_admins: boolean
  ip_allowlist: boolean
}

export default function AdminSecurityPage() {
  const { data } = useQuery({
    queryKey: ['admin-security'],
    queryFn: async () => {
      const { data } = await apiClient.get<SecurityInfo>('/admin/security',
        { params: { days: 30 } })
      return data
    },
  })

  if (!data) return <div className="h-40" aria-hidden />

  return (
    <div className="space-y-6 max-w-4xl">
      <div className="grid grid-cols-3 gap-4">
        <div className="card-paper p-5">
          <div className="text-sm font-medium text-ink mb-2">ADMIN_API_KEY</div>
          {data.key_age_days == null ? (
            <>
              <span className="badge-warn">возраст неизвестен</span>
              <p className="text-xs text-ink-muted mt-2">
                Отметка появится после первой ротации по рецепту
                (OPERATIONS.md — шаг 4 штампует маркер).
              </p>
            </>
          ) : (
            <>
              <span className={data.key_rotation_due ? 'badge-danger' : 'badge-success'}>
                {data.key_age_days} дн.
              </span>
              <p className="text-xs text-ink-muted mt-2">
                Политика ротации — 90 дней (H6).
                {data.key_rotation_due && ' Пора ротировать!'}
              </p>
            </>
          )}
        </div>
        <div className="card-paper p-5">
          <div className="text-sm font-medium text-ink mb-2">Именные админы + TOTP</div>
          <span className="badge-neutral">не настроено</span>
          <p className="text-xs text-ink-muted mt-2">
            ADM-8 (#261) — триггер: второй оператор. До того общий ключ +
            tripwire на каждый вход.
          </p>
        </div>
        <div className="card-paper p-5">
          <div className="text-sm font-medium text-ink mb-2">IP-allowlist входа</div>
          <span className="badge-neutral">не включён</span>
          <p className="text-xs text-ink-muted mt-2">
            H8 — опциональный nginx-рецепт; включается при необходимости.
          </p>
        </div>
      </div>

      <section className="card-paper overflow-hidden">
        <div className="px-5 py-3 border-b border-surface-border flex items-baseline justify-between">
          <span className="font-semibold text-sm">Входы в консоль (30 дней)</span>
          <span className="text-xs text-ink-muted">
            каждый вход дублируется в ops-Telegram (H3) — неожиданный вход = инцидент
          </span>
        </div>
        {!data.admin_logins.length ? (
          <div className="px-5 py-6 text-sm text-ink-muted">Входов не было</div>
        ) : (
          <table className="w-full text-sm">
            <tbody>
              {data.admin_logins.map((l, i) => (
                <tr key={i} className="border-b border-surface-border last:border-b-0">
                  <td className="px-5 py-2.5 text-xs text-ink-muted whitespace-nowrap">
                    {new Date(l.at).toLocaleString('ru-RU')}
                  </td>
                  <td className="px-3 py-2.5 font-mono text-xs">{l.ip ?? '—'}</td>
                  <td className="px-3 py-2.5 font-mono text-xs">{l.session}</td>
                  <td className="px-3 py-2.5 text-xs text-ink-muted truncate max-w-xs">
                    {l.user_agent}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </section>
    </div>
  )
}
