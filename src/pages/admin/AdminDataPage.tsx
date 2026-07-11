// ADM-6 (#259, Волна 3): «Данные» — загрузки всех клиентов: статус,
// карантин (ClamAV-вердикт), строки/SKU, ошибки валидации. Оператор видит
// сломанную загрузку раньше тикета в поддержку. Read-only.
// ADM-v3-6 (#391): отчёт консистентности зон vs реестр — сироты/остатки/
// пропажи за один клик; действий по удалению НЕТ (сначала смотрим).
import { useState } from 'react'
import { useMutation, useQuery } from '@tanstack/react-query'
import { Link } from 'react-router-dom'
import toast from 'react-hot-toast'

import { apiClient, errorMessage } from '../../shared/api/client'
import AdminQueryError from './AdminQueryError'
import { ShowMore, SkeletonRows, StateRow, Th } from './adminTable'
import { THEAD_CLS, useSort } from './adminTableUtils'

interface ConsistencyItem {
  zone?: string; key?: string; client_id: string
  status?: string; reason?: string; upload_id?: string; expected_key?: string
}
interface ConsistencyReport {
  orphans: ConsistencyItem[]
  leftovers: ConsistencyItem[]
  missing: ConsistencyItem[]
  counts: { orphans: number; leftovers: number; missing: number }
  clients_checked: string[]
  truncated_clients: boolean
  truncated_rows: string[]
}

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

function ConsistencySection() {
  const [report, setReport] = useState<ConsistencyReport | null>(null)
  const checkMut = useMutation({
    mutationFn: async () => {
      const { data } = await apiClient.post<ConsistencyReport>(
        '/admin/data/consistency-check')
      return data
    },
    onSuccess: (r) => {
      setReport(r)
      const total = r.counts.orphans + r.counts.leftovers + r.counts.missing
      if (total === 0) toast.success('Расхождений не найдено')
      else toast.error(`Найдено расхождений: ${total}`)
    },
    onError: (e) => toast.error(errorMessage(e, 'Проверка не выполнена')),
  })

  const rows: { kind: string; badge: string; it: ConsistencyItem }[] = report
    ? [
        ...report.orphans.map((it) => ({ kind: 'сирота', badge: 'badge-danger', it })),
        ...report.leftovers.map((it) => ({ kind: 'остаток', badge: 'badge-warn', it })),
        ...report.missing.map((it) => ({ kind: 'пропажа', badge: 'badge-danger', it })),
      ]
    : []

  return (
    <section className="card-paper overflow-hidden">
      <div className="px-5 py-3 border-b border-surface-border flex items-center justify-between gap-3">
        <span className="font-semibold text-sm">Консистентность хранилища (зоны vs реестр)</span>
        <div className="flex items-center gap-3">
          {report && (
            <span className={rows.length ? 'badge-danger' : 'badge-success'}>
              {rows.length
                ? `расхождений: ${rows.length}`
                : `чисто · клиентов: ${report.clients_checked.length}`}
            </span>
          )}
          <button type="button" className="btn-secondary text-sm"
                  disabled={checkMut.isPending}
                  onClick={() => checkMut.mutate()}>
            {checkMut.isPending ? 'Сверка…' : 'Проверить'}
          </button>
        </div>
      </div>
      {!report ? (
        <div className="px-5 py-4 text-xs text-ink-muted">
          Сверка объектов UNTRUSTED/QUARANTINE/PROCESSED со строками реестра
          загрузок (класс AUD-9: сироты, остатки, пропажи). Read-only —
          отчёт ничего не удаляет.
        </div>
      ) : rows.length > 0 && (
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead className="bg-surface-muted text-ink-subtle text-xs uppercase tracking-wider">
              <tr>
                <th className="px-4 py-2 text-left">Тип</th>
                <th className="px-4 py-2 text-left">Клиент</th>
                <th className="px-4 py-2 text-left">Зона / объект</th>
                <th className="px-4 py-2 text-left">Причина</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-surface-border">
              {rows.map(({ kind, badge, it }, i) => (
                <tr key={i} className="hover:bg-surface-muted/40">
                  <td className="px-4 py-2"><span className={badge}>{kind}</span></td>
                  <td className="px-4 py-2 font-mono text-xs">{it.client_id}</td>
                  <td className="px-4 py-2 font-mono text-xs max-w-md truncate">
                    {it.zone ? `${it.zone}: ` : ''}{it.key ?? it.expected_key ?? it.upload_id}
                  </td>
                  <td className="px-4 py-2 text-xs text-ink-muted">
                    {it.reason ?? (it.expected_key ? 'объект обещан строкой реестра, но отсутствует' : 'строки реестра нет')}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
      {report && (report.truncated_clients || report.truncated_rows.length > 0) && (
        <div className="px-5 py-2 text-xs text-ink-muted border-t border-surface-border">
          ⚠ Отчёт ограничен: {report.truncated_clients ? 'не все клиенты; ' : ''}
          {report.truncated_rows.length > 0 && `усечены строки: ${report.truncated_rows.join(', ')}`}
        </div>
      )}
    </section>
  )
}

export default function AdminDataPage() {
  const [limit, setLimit] = useState(50)   // #394-2: «показать ещё», сервер ≤200
  const { data, isError, isLoading, refetch } = useQuery({
    queryKey: ['admin-uploads', limit],
    queryFn: async () => {
      const { data } = await apiClient.get<{ uploads: UploadRow[]; count: number }>(
        '/admin/uploads', { params: { limit } })
      return data
    },
    refetchInterval: 60_000,
    meta: { silent: true },
  })
  const sort = useSort(data?.uploads ?? [], 'created_at')

  return (
    <div className="space-y-6 max-w-5xl">
      {isError && <AdminQueryError what="данные загрузок" onRetry={() => void refetch()} />}
      <section className="card-paper overflow-hidden">
        <div className="px-5 py-3 border-b border-surface-border flex items-baseline justify-between">
          <span className="font-semibold text-sm">Загрузки (все клиенты)</span>
          <span className="text-xs text-ink-muted">read-only · карантин = вердикт ClamAV</span>
        </div>
        {/* #394-2: sticky-шапка + сортировка + три состояния */}
        <div className="overflow-x-auto max-h-[60vh] overflow-y-auto">
          <table className="w-full text-sm">
            <thead className={THEAD_CLS}>
              <tr>
                <Th label="Время" sortKey="created_at" sort={sort} />
                <Th label="Клиент" sortKey="client_id" sort={sort} />
                <Th label="Файл" sortKey="size_bytes" sort={sort} />
                <Th label="Статус" sortKey="status" sort={sort} />
                <Th label="Строк / SKU" sortKey="row_count" sort={sort} />
                <Th label="Ошибка" />
              </tr>
            </thead>
            <tbody className="divide-y divide-surface-border">
              {isLoading ? (
                <SkeletonRows cols={6} />
              ) : isError ? (
                <StateRow cols={6} kind="error" what="ленту загрузок" />
              ) : !sort.sorted.length ? (
                <StateRow cols={6} kind="empty" what="загрузки" />
              ) : (
                sort.sorted.map((u) => (
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
                ))
              )}
            </tbody>
          </table>
        </div>
        {!isLoading && !isError && (data?.uploads.length ?? 0) >= limit && (
          <ShowMore shown={limit} step={50} max={200} onMore={setLimit} />
        )}
      </section>
      <ConsistencySection />
      <div className="text-xs text-ink-muted">
        Использование квот и rate-limit-хиты появятся с волной квот (#155,
        reason-codes) — учтено в дорожной карте.
      </div>
    </div>
  )
}
