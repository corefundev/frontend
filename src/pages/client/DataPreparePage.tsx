import { useMemo, useState } from 'react'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { formatDistanceToNow, parseISO } from 'date-fns'
import { ru } from 'date-fns/locale'
import { Link, useNavigate } from 'react-router-dom'
import toast from 'react-hot-toast'

import { useAuthStore } from '../../features/auth/store'
import { errorMessage } from '../../shared/api/client'
import {
  uploadsApi,
  type PrepView,
  type UploadRecord,
  type UploadStatus,
} from '../../features/uploads/api'

// ─────────────────────────────────────────────────────────────────────────
//  «Подготовка данных» (DP-5, frontend #32; backend #324)
//
//  The stage between antivirus and training. After a file passes AV it waits
//  at `scanned_clean`; the user presses «Подготовить», the system sniffs the
//  format and auto-maps columns to the canonical schema (NO user column
//  editing — the system is authoritative), parses, and lands `processed`.
//
//  The user then eyeballs a READ-ONLY preview («это мои данные») and clicks
//  «Готово, использовать», which takes them to training. Training is blocked
//  until an upload is `processed` (enforced server-side).
// ─────────────────────────────────────────────────────────────────────────

const PREP_LABEL: Partial<Record<UploadStatus, string>> = {
  scanned_clean:     'Готов к подготовке',
  processing:        'Подготовка…',
  processed:         'Подготовлено',
  processing_failed: 'Не удалось',
}
const PREP_BADGE: Partial<Record<UploadStatus, string>> = {
  scanned_clean:     'badge-info',
  processing:        'badge-info',
  processed:         'badge-success',
  processing_failed: 'badge-danger',
}

// Statuses that belong on this page (post-AV). `uploaded`/`scanning` are still
// in antivirus and live only on the Uploads page; `infected` never shows here.
const PREP_RELEVANT: UploadStatus[] = [
  'scanned_clean', 'processing', 'processed', 'processing_failed',
]

export default function DataPreparePage() {
  const clientId = useAuthStore((s) => s.clientId)!
  const qc       = useQueryClient()
  const navigate = useNavigate()

  const [previewId, setPreviewId] = useState<string | null>(null)

  const { data: uploads = [], isLoading } = useQuery({
    queryKey: ['uploads', clientId],
    queryFn: () => uploadsApi.list(clientId),
    // Poll only while something is actively moving through AV or prep; a file
    // resting at `scanned_clean` (awaiting the user) is NOT a reason to poll.
    refetchInterval: (q) => {
      const rows = q.state.data as UploadRecord[] | undefined
      const moving = rows?.some((r) =>
        ['uploaded', 'scanning', 'processing'].includes(r.status),
      )
      return moving ? 3_000 : false
    },
    meta: { silent: true },
  })

  const relevant = useMemo(
    () => uploads.filter((u) => PREP_RELEVANT.includes(u.status)),
    [uploads],
  )
  const ready   = relevant.filter((u) => u.status === 'scanned_clean')
  const others  = relevant.filter((u) => u.status !== 'scanned_clean')

  const { mutate: prepare, isPending: preparing, variables: preparingId } = useMutation({
    mutationFn: (uploadId: string) => uploadsApi.prepare(clientId, uploadId),
    onSuccess: () => {
      toast.success('Подготовка запущена')
      qc.invalidateQueries({ queryKey: ['uploads', clientId] })
    },
    onError: (e) => toast.error(errorMessage(e, 'Не удалось запустить подготовку')),
  })

  return (
    <div className="max-w-5xl space-y-10">
      {/* ═══════════════════ HERO ═══════════════════ */}
      <header className="max-w-2xl">
        <div className="eyebrow">Данные</div>
        <h1 className="display-em text-brand-700 text-4xl sm:text-5xl mt-2 leading-[1.05]">
          Подготовка данных
        </h1>
        <p className="mt-4 text-ink-muted leading-relaxed">
          После загрузки файл нужно подготовить к обучению. Система сама
          распознаёт формат (CSV, Excel, выгрузки 1С и маркетплейсов) и
          сопоставляет ваши колонки с нужными полями — вам остаётся проверить
          результат и подтвердить. Обучение станет доступно после подготовки.
        </p>
      </header>

      {/* ═══════════════════ READY TO PREPARE ═══════════════════ */}
      <section>
        <div className="rule-dot mb-6" />
        <div className="eyebrow mb-3">Готовы к подготовке</div>
        {isLoading ? (
          <div className="card py-10 h-24" aria-hidden="true" />
        ) : ready.length === 0 ? (
          <div className="card py-8 px-6 text-sm text-ink-muted">
            Нет файлов, ожидающих подготовки. Загрузите файл в разделе{' '}
            <Link to="/app/uploads" className="text-brand-500 underline underline-offset-2 hover:text-brand-600">
              «Загрузки»
            </Link>
            {' '}— после проверки безопасности он появится здесь.
          </div>
        ) : (
          <ul className="card divide-y divide-surface-border">
            {ready.map((u) => (
              <li key={u.upload_id} className="p-4 flex items-center gap-4">
                <div className="flex-1 min-w-0">
                  <div className="font-mono text-sm truncate" title={u.filename}>{u.filename}</div>
                  <div className="eyebrow mt-1"><RelativeTime iso={u.created_at} /></div>
                </div>
                <span className={PREP_BADGE.scanned_clean}>{PREP_LABEL.scanned_clean}</span>
                <button
                  type="button"
                  className="btn-primary text-sm shrink-0"
                  onClick={() => prepare(u.upload_id)}
                  disabled={preparing && preparingId === u.upload_id}
                >
                  {preparing && preparingId === u.upload_id ? 'Запуск…' : 'Подготовить'}
                </button>
              </li>
            ))}
          </ul>
        )}
      </section>

      {/* ═══════════════════ PREPARED / IN PROGRESS / FAILED ═══════════════════ */}
      {others.length > 0 && (
        <section>
          <div className="rule-dot mb-6" />
          <div className="eyebrow mb-4">Обработанные файлы</div>
          <div className="space-y-4">
            {others.map((u) => (
              <PrepCard
                key={u.upload_id}
                upload={u}
                clientId={clientId}
                open={previewId === u.upload_id}
                onTogglePreview={() =>
                  setPreviewId((cur) => (cur === u.upload_id ? null : u.upload_id))
                }
                onUse={() => navigate('/app/training')}
              />
            ))}
          </div>
        </section>
      )}
    </div>
  )
}

// ══════════════════════════════════════════════════════════════════════════
//  PrepCard — one processed / preparing / failed upload
// ══════════════════════════════════════════════════════════════════════════

function PrepCard({
  upload,
  clientId,
  open,
  onTogglePreview,
  onUse,
}: {
  upload: UploadRecord
  clientId: string
  open: boolean
  onTogglePreview: () => void
  onUse: () => void
}) {
  const isProcessing = upload.status === 'processing'
  const isDone       = upload.status === 'processed'
  const isFailed     = upload.status === 'processing_failed'

  return (
    <div className="card p-5 sm:p-6">
      <div className="flex items-center gap-4">
        <div className="flex-1 min-w-0">
          <div className="font-mono text-sm truncate" title={upload.filename}>{upload.filename}</div>
          <div className="eyebrow mt-1"><RelativeTime iso={upload.created_at} /></div>
        </div>

        {isDone && upload.sku_count != null && (
          <div className="text-right hidden sm:block">
            <div className="eyebrow">SKU</div>
            <div className="num font-display text-brand-700 text-lg">{upload.sku_count}</div>
          </div>
        )}

        <span className={`${PREP_BADGE[upload.status]} ${isProcessing ? 'animate-pulse' : ''}`}>
          {PREP_LABEL[upload.status]}
        </span>

        {isDone && (
          <div className="flex items-center gap-2 shrink-0">
            <button type="button" className="btn-tertiary text-sm" onClick={onTogglePreview}>
              {open ? 'Скрыть' : 'Показать данные'}
            </button>
            <button type="button" className="btn-primary text-sm" onClick={onUse}>
              Готово, использовать
            </button>
          </div>
        )}
      </div>

      {isProcessing && (
        <div className="mt-4 relative h-2 w-full overflow-hidden rounded-full bg-surface-muted">
          <div className="h-full w-2/3 rounded-full bg-brand-400 animate-pulse" />
        </div>
      )}

      {isFailed && (
        <div className="mt-4 rounded-md bg-danger-bg text-danger px-3 py-2 text-sm">
          {upload.error_message ||
            'Не удалось подготовить файл. Проверьте, что в нём есть колонки с датой, товаром и продажами, и загрузите файл заново.'}
        </div>
      )}

      {isDone && open && <PrepPreview clientId={clientId} uploadId={upload.upload_id} />}
    </div>
  )
}

// ══════════════════════════════════════════════════════════════════════════
//  PrepPreview — READ-ONLY detection summary + canonical sample (no editing)
// ══════════════════════════════════════════════════════════════════════════

function PrepPreview({ clientId, uploadId }: { clientId: string; uploadId: string }) {
  const { data, isLoading, isError } = useQuery<PrepView>({
    queryKey: ['prep', uploadId],
    queryFn: () => uploadsApi.getPrep(clientId, uploadId),
    staleTime: 60_000,
    meta: { silent: true },
  })

  if (isLoading) return <div className="mt-5 h-24 rounded-md bg-surface-muted animate-pulse" />
  if (isError || !data) {
    return (
      <div className="mt-5 text-sm text-ink-muted">Не удалось загрузить превью данных.</div>
    )
  }

  const { detected, sample } = data
  return (
    <div className="mt-5 border-t border-surface-border pt-5">
      {/* detection summary */}
      <dl className="flex flex-wrap gap-x-8 gap-y-2 text-sm mb-5">
        <Detail label="Строк" value={data.row_count != null ? String(data.row_count) : '—'} />
        <Detail label="Уникальных SKU" value={data.sku_count != null ? String(data.sku_count) : '—'} />
        <Detail label="Формат" value={detected.format || '—'} />
        <Detail label="Кодировка" value={detected.encoding || '—'} />
        {detected.delimiter && <Detail label="Разделитель" value={detected.delimiter} />}
      </dl>

      {/* canonical sample */}
      {sample && sample.rows.length > 0 ? (
        <div className="overflow-x-auto rounded-lg border border-surface-border">
          <table className="w-full text-sm border-collapse">
            <thead>
              <tr className="bg-surface-muted">
                {sample.columns.map((c) => (
                  <th key={c} className="text-left font-medium text-ink px-3 py-2 whitespace-nowrap">
                    {c}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {sample.rows.map((row, i) => (
                <tr key={i} className="border-t border-surface-border">
                  {row.map((cell, j) => (
                    <td key={j} className="px-3 py-2 whitespace-nowrap text-ink-muted tabular-nums">
                      {cell === null || cell === '' ? '—' : String(cell)}
                    </td>
                  ))}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      ) : (
        <div className="text-sm text-ink-muted">Пример строк недоступен.</div>
      )}

      <p className="mt-3 text-xs text-ink-subtle">
        Первые {sample?.rows.length ?? 0} строк после автоматической подготовки. Колонки
        сопоставлены системой автоматически.
      </p>
    </div>
  )
}

function Detail({ label, value }: { label: string; value: string }) {
  return (
    <div>
      <dt className="eyebrow">{label}</dt>
      <dd className="num font-display text-brand-700 text-base mt-0.5">{value}</dd>
    </div>
  )
}

function RelativeTime({ iso }: { iso: string }) {
  const rel = useMemo(() => {
    try {
      return formatDistanceToNow(parseISO(iso), { addSuffix: true, locale: ru })
    } catch {
      return iso
    }
  }, [iso])
  return <>{rel}</>
}
