// ADM-6 (#259, Волна 3): «Данные» — загрузки всех клиентов: статус,
// карантин (ClamAV-вердикт), строки/SKU, ошибки валидации. Оператор видит
// сломанную загрузку раньше тикета в поддержку. Read-only.
import { useQuery } from '@tanstack/react-query'
import { Link } from 'react-router-dom'

import { apiClient } from '../../shared/api/client'
import AdminQueryError from './AdminQueryError'

interface UploadRow {
  upload_id: string; client_id: string; filename: string
  size_bytes: number; status: string; scan_result: string | null
  error_message: string | null; row_count: number | null
  sku_count: number | null; created_at: string
}

const STATUS_BADGE: Record<string, string> = {
  processed:  'badge-success',
  uploaded:   'badge-info',
  scanning:   'badge-info',
  processing: 'badge-info',
  quarantined: 'badge-danger',
  failed:     'badge-danger',
  rejected:   'badge-danger',
}

function fmtSize(b: number): string {
  if (b < 1024) return `${b} Б`
  if (b < 1048576) return `${(b / 1024).toFixed(0)} КБ`
  return `${(b / 1048576).toFixed(1)} МБ`
}

export default function AdminDataPage() {
  const { data, isError, refetch } = useQuery({
    queryKey: ['admin-uploads'],
    queryFn: async () => {
      const { data } = await apiClient.get<{ uploads: UploadRow[]; count: number }>(
        '/admin/uploads', { params: { limit: 50 } })
      return data
    },
    refetchInterval: 60_000,
    meta: { silent: true },
  })

  return (
    <div className="space-y-6 max-w-5xl">
      {isError && <AdminQueryError what="данные загрузок" onRetry={() => void refetch()} />}
      <section className="card-paper overflow-hidden">
        <div className="px-5 py-3 border-b border-surface-border flex items-baseline justify-between">
          <span className="font-semibold text-sm">Загрузки (все клиенты)</span>
          <span className="text-xs text-ink-muted">read-only · карантин = вердикт ClamAV</span>
        </div>
        {isError ? (
          <div className="px-5 py-8" aria-hidden />
        ) : !data?.uploads?.length ? (
          <div className="px-5 py-8 text-sm text-ink-muted text-center">Загрузок пока нет</div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead className="bg-surface-muted text-ink-subtle text-xs uppercase tracking-wider">
                <tr>
                  <th className="px-4 py-2 text-left">Время</th>
                  <th className="px-4 py-2 text-left">Клиент</th>
                  <th className="px-4 py-2 text-left">Файл</th>
                  <th className="px-4 py-2 text-left">Статус</th>
                  <th className="px-4 py-2 text-left">Строк / SKU</th>
                  <th className="px-4 py-2 text-left">Ошибка</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-surface-border">
                {data.uploads.map((u) => (
                  <tr key={u.upload_id}
                      className={`hover:bg-surface-muted/40 ${
                        u.scan_result || u.status === 'failed' ? 'bg-red-50/50' : ''}`}>
                    <td className="px-4 py-2 text-xs text-ink-muted whitespace-nowrap">
                      {new Date(u.created_at).toLocaleString('ru-RU')}
                    </td>
                    <td className="px-4 py-2">
                      <Link to={`/admin/clients/${encodeURIComponent(u.client_id)}`}
                            className="font-mono text-xs text-brand-700">{u.client_id}</Link>
                    </td>
                    <td className="px-4 py-2 text-xs">
                      {u.filename}
                      <span className="text-ink-faint"> · {fmtSize(u.size_bytes)}</span>
                    </td>
                    <td className="px-4 py-2">
                      <span className={STATUS_BADGE[u.status] ?? 'badge-neutral'}>{u.status}</span>
                      {u.scan_result && (
                        <span className="badge-danger ml-1">⚠ {u.scan_result}</span>
                      )}
                    </td>
                    <td className="px-4 py-2 font-mono text-xs">
                      {u.row_count ?? '—'} / {u.sku_count ?? '—'}
                    </td>
                    <td className="px-4 py-2 text-xs text-ink-muted max-w-xs truncate">
                      {u.error_message ?? ''}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </section>
      <div className="text-xs text-ink-muted">
        Использование квот и rate-limit-хиты появятся с волной квот (#155,
        reason-codes) — учтено в дорожной карте.
      </div>
    </div>
  )
}
