import { useEffect, useMemo, useState } from 'react'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { formatDistanceToNow, parseISO } from 'date-fns'
import { ru } from 'date-fns/locale'
import { Link, useNavigate } from 'react-router-dom'
import toast from 'react-hot-toast'

import { useAuthStore } from '../../features/auth/store'
import { errorMessage } from '../../shared/api/client'
import {
  safeUploadError,
  uploadsApi,
  type PrepView,
  type UploadRecord,
  type UploadStatus,
} from '../../features/uploads/api'

// ─────────────────────────────────────────────────────────────────────────
//  «Подготовка данных» (DP-5, frontend #32; backend #324)
//
//  A SEPARATE stage from upload. An uploaded file rests at `scanned_clean`;
//  here the user presses «Подготовить», the system sniffs the format and
//  auto-maps columns (system-authoritative — no user column editing), parses,
//  and lands `processed`. Then a READ-ONLY preview + «Готово, использовать»
//  → training (blocked until processed). One inline card per file; state is
//  shown in place with immediate feedback and clean, human error messages.
// ─────────────────────────────────────────────────────────────────────────

const PREP_RELEVANT: UploadStatus[] = [
  'scanned_clean', 'processing', 'processed', 'processing_failed',
]

export default function DataPreparePage() {
  const clientId = useAuthStore((s) => s.clientId)!
  const qc       = useQueryClient()
  const navigate = useNavigate()

  const [previewId, setPreviewId]   = useState<string | null>(null)
  // Files the user just triggered — lets the card show «Подготовка…» instantly,
  // before the worker has flipped the status to `processing`.
  const [startedIds, setStartedIds] = useState<Set<string>>(() => new Set())

  const { data: uploads = [], isLoading } = useQuery({
    queryKey: ['uploads', clientId],
    queryFn: () => uploadsApi.list(clientId),
    refetchInterval: (q) => {
      const rows = q.state.data as UploadRecord[] | undefined
      // Poll while anything is moving, OR while a just-triggered file is still at
      // `scanned_clean` (covers the gap before the worker picks the job up — so
      // the progress indicator never stalls).
      const moving = rows?.some(
        (r) =>
          ['uploaded', 'scanning', 'processing'].includes(r.status) ||
          (startedIds.has(r.upload_id) && r.status === 'scanned_clean'),
      )
      return moving ? 2_000 : false
    },
    meta: { silent: true },
  })

  const relevant = useMemo(
    () => uploads.filter((u) => PREP_RELEVANT.includes(u.status)),
    [uploads],
  )

  // Drop a started id once its file reaches a terminal prep state.
  useEffect(() => {
    setStartedIds((prev) => {
      if (prev.size === 0) return prev
      const next = new Set(prev)
      for (const u of uploads) {
        if (u.status === 'processed' || u.status === 'processing_failed') next.delete(u.upload_id)
      }
      return next.size === prev.size ? prev : next
    })
  }, [uploads])

  const { mutate: prepare } = useMutation({
    mutationFn: (uploadId: string) => uploadsApi.prepare(clientId, uploadId),
    onMutate: (uploadId) => setStartedIds((s) => new Set(s).add(uploadId)),  // instant «Подготовка…»
    onSuccess: () => qc.invalidateQueries({ queryKey: ['uploads', clientId] }),
    onError: (e, uploadId) => {
      // 409 = already preparing/processed (double-click / another tab). Not an
      // error: keep the progress indicator and re-sync to the real state.
      const status = (e as { response?: { status?: number } })?.response?.status
      if (status === 409) {
        qc.invalidateQueries({ queryKey: ['uploads', clientId] })
        return
      }
      setStartedIds((s) => { const n = new Set(s); n.delete(uploadId); return n })
      toast.error(errorMessage(e, 'Не удалось запустить подготовку'))
    },
  })

  // Remove a file (used to clear a failed card without a page reload).
  const { mutate: remove, isPending: removing, variables: removingId } = useMutation({
    mutationFn: (uploadId: string) => uploadsApi.cancel(uploadId),
    onSuccess: () => { toast.success('Файл удалён'); qc.invalidateQueries({ queryKey: ['uploads', clientId] }) },
    onError: (e) => toast.error(errorMessage(e, 'Не удалось удалить файл')),
  })

  return (
    <div className="max-w-5xl space-y-8 sm:space-y-10">
      {/* ═══════════════ HERO ═══════════════ */}
      <header className="max-w-2xl">
        <div className="eyebrow">Данные</div>
        <h1 className="display-em text-brand-700 text-3xl sm:text-5xl mt-2 leading-[1.05]">
          Подготовка данных
        </h1>
        <p className="mt-4 text-ink-muted leading-relaxed">
          Загруженные файлы готовятся к обучению. Система сама распознаёт формат
          (CSV, Excel, выгрузки 1С и маркетплейсов) и сопоставляет ваши колонки
          с нужными полями — нажмите «Подготовить», проверьте результат и
          подтвердите. Обучение станет доступно после подготовки.
        </p>
      </header>

      <section>
        <div className="rule-dot mb-6" />
        {isLoading ? (
          <div className="card py-10 h-24" aria-hidden="true" />
        ) : relevant.length === 0 ? (
          <div className="card py-8 px-6 text-sm text-ink-muted">
            Пока нет загруженных файлов. Загрузите файл в разделе{' '}
            <Link to="/app/uploads" className="text-brand-500 underline underline-offset-2 hover:text-brand-600">
              «Загрузки»
            </Link>
            {' '}— после этого он появится здесь.
          </div>
        ) : (
          <div className="space-y-4">
            {relevant.map((u) => (
              <PrepCard
                key={u.upload_id}
                upload={u}
                clientId={clientId}
                started={startedIds.has(u.upload_id)}
                open={previewId === u.upload_id}
                removing={removing && removingId === u.upload_id}
                onPrepare={() => prepare(u.upload_id)}
                onRemove={() => remove(u.upload_id)}
                onTogglePreview={() => setPreviewId((cur) => (cur === u.upload_id ? null : u.upload_id))}
                onUse={() => navigate('/app/training')}
              />
            ))}
          </div>
        )}
      </section>
    </div>
  )
}

// ══════════════════════════════════════════════════════════════════════════
//  PrepCard — one file; every state shown INLINE, responsive.
// ══════════════════════════════════════════════════════════════════════════

function PrepCard({
  upload, clientId, started, open, removing,
  onPrepare, onRemove, onTogglePreview, onUse,
}: {
  upload: UploadRecord
  clientId: string
  started: boolean
  open: boolean
  removing: boolean
  onPrepare: () => void
  onRemove: () => void
  onTogglePreview: () => void
  onUse: () => void
}) {
  const isDone   = upload.status === 'processed'
  const isFailed = upload.status === 'processing_failed'
  // «Подготовка…» = worker is processing, OR the user just clicked and the
  // status hasn't flipped yet (still scanned_clean).
  const isPreparing = upload.status === 'processing' || (started && upload.status === 'scanned_clean')
  const isReady  = upload.status === 'scanned_clean' && !isPreparing

  return (
    <div className="card p-5 sm:p-6">
      {/* header row: filename + status pill */}
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <div className="font-mono text-sm truncate" title={upload.filename}>{upload.filename}</div>
          <div className="eyebrow mt-1"><RelativeTime iso={upload.created_at} /></div>
        </div>
        <StatusPill isReady={isReady} isPreparing={isPreparing} isDone={isDone} isFailed={isFailed} />
      </div>

      {/* READY → single primary action */}
      {isReady && (
        <div className="mt-4">
          <button type="button" className="btn-primary text-sm" onClick={onPrepare}>
            Подготовить
          </button>
        </div>
      )}

      {/* PREPARING → indeterminate progress + caption */}
      {isPreparing && (
        <div className="mt-4">
          <div className="relative h-2 w-full overflow-hidden rounded-full bg-surface-muted">
            <div className="absolute inset-y-0 left-0 w-2/3 rounded-full bg-brand-500 animate-pulse" />
          </div>
          <div className="mt-2 flex items-center gap-2 text-xs text-ink-muted">
            <Spinner /> Идёт подготовка: распознаём формат и колонки, разбираем данные…
          </div>
        </div>
      )}

      {/* FAILED → clean message + recovery (no page reload needed) */}
      {isFailed && (
        <div className="mt-4">
          <div className="rounded-md bg-danger-bg text-danger px-3 py-2 text-sm">
            {safeUploadError(upload.error_message)}
          </div>
          <div className="mt-3 flex flex-wrap items-center gap-2">
            <Link to="/app/uploads" className="btn-primary text-sm">Загрузить заново</Link>
            <button type="button" className="btn-tertiary text-sm" onClick={onRemove} disabled={removing}>
              {removing ? 'Удаление…' : 'Удалить'}
            </button>
          </div>
        </div>
      )}

      {/* DONE → summary + preview toggle + use */}
      {isDone && (
        <div className="mt-4 flex flex-wrap items-center gap-x-6 gap-y-3">
          <div className="flex items-center gap-6">
            <Metric label="Строк" value={upload.row_count} />
            <Metric label="Уникальных SKU" value={upload.sku_count} />
          </div>
          <div className="ml-auto flex flex-wrap items-center gap-2">
            <button type="button" className="btn-tertiary text-sm" onClick={onTogglePreview}>
              {open ? 'Скрыть данные' : 'Показать данные'}
            </button>
            <button type="button" className="btn-primary text-sm" onClick={onUse}>
              Готово, использовать
            </button>
          </div>
        </div>
      )}

      {isDone && open && <PrepPreview clientId={clientId} uploadId={upload.upload_id} />}
    </div>
  )
}

function StatusPill({
  isReady, isPreparing, isDone, isFailed,
}: {
  isReady: boolean; isPreparing: boolean; isDone: boolean; isFailed: boolean
}) {
  if (isFailed)    return <span className="badge-danger shrink-0">Не удалось</span>
  if (isDone)      return <span className="badge-success shrink-0">Подготовлено</span>
  if (isPreparing) return <span className="badge-info shrink-0 animate-pulse">Подготовка…</span>
  if (isReady)     return <span className="badge-neutral shrink-0">Готов к подготовке</span>
  return null
}

function Metric({ label, value }: { label: string; value: number | null }) {
  return (
    <div>
      <div className="eyebrow">{label}</div>
      <div className="num font-display text-brand-700 text-lg leading-none mt-0.5">{value ?? '—'}</div>
    </div>
  )
}

function Spinner() {
  return (
    <svg className="h-3.5 w-3.5 animate-spin text-brand-500 shrink-0" viewBox="0 0 24 24" fill="none" aria-hidden="true">
      <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
      <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 0 1 8-8V0C5.4 0 0 5.4 0 12h4z" />
    </svg>
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
    return <div className="mt-5 text-sm text-ink-muted">Не удалось загрузить превью данных.</div>
  }

  const { detected, sample } = data
  return (
    <div className="mt-5 border-t border-surface-border pt-5">
      <dl className="flex flex-wrap gap-x-8 gap-y-2 text-sm mb-5">
        <Detail label="Формат" value={detected.format || '—'} />
        <Detail label="Кодировка" value={detected.encoding || '—'} />
        {detected.delimiter && <Detail label="Разделитель" value={detected.delimiter} />}
      </dl>

      {sample && sample.rows.length > 0 ? (
        <div className="overflow-x-auto rounded-lg border border-surface-border">
          <table className="w-full text-sm border-collapse">
            <thead>
              <tr className="bg-surface-muted">
                {sample.columns.map((c) => (
                  <th key={c} className="text-left font-medium text-ink px-3 py-2 whitespace-nowrap">{c}</th>
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
