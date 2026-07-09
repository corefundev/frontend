import { useMemo, useState } from 'react'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { formatDistanceToNow, parseISO } from 'date-fns'
import { ru } from 'date-fns/locale'
import { Link } from 'react-router-dom'
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
//  A SEPARATE stage from upload. A file rests at `scanned_clean`; here the
//  user presses «Подготовить», the system sniffs the format and auto-maps
//  columns (system-authoritative — no user column editing), parses, and lands
//  `processed`. Training is blocked until `processed`.
//
//  Layout mirrors the agreed editorial mock:
//    • TOP — files awaiting action (ready / in-progress), one compact card each
//    • «История подготовок» — terminal results (готово / ошибка) + status filter
//  Each upload appears in EXACTLY ONE section (bucketed by status → no
//  duplication). Badge colours: готов/готово = green, в процессе = gray,
//  ошибка = red.
// ─────────────────────────────────────────────────────────────────────────

const ACTIVE_STATES:  UploadStatus[] = ['scanned_clean', 'processing']
const HISTORY_STATES: UploadStatus[] = ['processed', 'processing_failed']

type HistoryFilter = 'all' | 'processed' | 'processing_failed'

export default function DataPreparePage() {
  const clientId = useAuthStore((s) => s.clientId)!
  const qc       = useQueryClient()

  const [expandedId, setExpandedId] = useState<string | null>(null)
  const [filter, setFilter]         = useState<HistoryFilter>('all')
  // Files the user just triggered — lets the card show «Подготовка…» instantly,
  // before the worker has flipped the status to `processing`.
  const [startedIds, setStartedIds] = useState<Set<string>>(() => new Set())

  const { data: uploads = [], isLoading } = useQuery({
    queryKey: ['uploads', clientId],
    queryFn: () => uploadsApi.list(clientId),
    refetchInterval: (q) => {
      const rows = q.state.data as UploadRecord[] | undefined
      // Poll while anything is moving, OR while a just-triggered file is still
      // at `scanned_clean` (covers the gap before the worker picks the job up).
      const moving = rows?.some(
        (r) =>
          ['uploaded', 'scanning', 'processing'].includes(r.status) ||
          (startedIds.has(r.upload_id) && r.status === 'scanned_clean'),
      )
      return moving ? 2_000 : false
    },
    meta: { silent: true },
  })

  const active  = useMemo(
    () => uploads.filter((u) => ACTIVE_STATES.includes(u.status)),
    [uploads],
  )
  const history = useMemo(
    () => uploads.filter((u) => HISTORY_STATES.includes(u.status)),
    [uploads],
  )
  const shownHistory = useMemo(
    () => (filter === 'all' ? history : history.filter((u) => u.status === filter)),
    [history, filter],
  )
  const nothing = !isLoading && active.length === 0 && history.length === 0

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

  // Remove a file (clears a failed card without a page reload).
  const { mutate: remove, isPending: removing, variables: removingId } = useMutation({
    mutationFn: (uploadId: string) => uploadsApi.cancel(uploadId),
    onSuccess: () => {
      toast.success('Файл удалён')
      setExpandedId(null)
      qc.invalidateQueries({ queryKey: ['uploads', clientId] })
    },
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
          с нужными полями — нажмите «Подготовить» и проверьте результат.
          Обучение станет доступно после подготовки.
        </p>
      </header>

      {isLoading ? (
        <div className="card py-10 h-24" aria-hidden="true" />
      ) : nothing ? (
        <div className="card py-8 px-6 text-sm text-ink-muted">
          Пока нет загруженных файлов. Загрузите файл в разделе{' '}
          <Link to="/app/uploads" className="text-brand-500 underline underline-offset-2 hover:text-brand-600">
            «Загрузки»
          </Link>
          {' '}— после этого он появится здесь.
        </div>
      ) : (
        <>
          {/* ═══════════════ AWAITING ACTION (ready / in-progress) ═══════════════ */}
          {active.length > 0 && (
            <div className="space-y-3">
              {active.map((u) => (
                <ActiveRow
                  key={u.upload_id}
                  upload={u}
                  started={startedIds.has(u.upload_id)}
                  onPrepare={() => prepare(u.upload_id)}
                />
              ))}
            </div>
          )}

          {/* ═══════════════ ИСТОРИЯ ПОДГОТОВОК ═══════════════ */}
          {history.length > 0 && (
            <section>
              <div className="rule-dot mb-6" />
              <div className="flex items-center justify-between gap-4 mb-4">
                <h2 className="display-em text-brand-700 text-2xl">История подготовок</h2>
                <HistoryFilterSelect value={filter} onChange={setFilter} />
              </div>
              {shownHistory.length === 0 ? (
                <div className="card py-6 px-6 text-sm text-ink-muted">
                  Нет записей с выбранным статусом.
                </div>
              ) : (
                <div className="space-y-3">
                  {shownHistory.map((u) => (
                    <HistoryRow
                      key={u.upload_id}
                      upload={u}
                      clientId={clientId}
                      open={expandedId === u.upload_id}
                      removing={removing && removingId === u.upload_id}
                      onToggle={() => setExpandedId((cur) => (cur === u.upload_id ? null : u.upload_id))}
                      onRemove={() => remove(u.upload_id)}
                    />
                  ))}
                </div>
              )}
            </section>
          )}
        </>
      )}
    </div>
  )
}

// ══════════════════════════════════════════════════════════════════════════
//  ActiveRow — a file awaiting action: ready → «Подготовить»; in-progress →
//  gray badge + indeterminate bar. Same compact size as history rows.
// ══════════════════════════════════════════════════════════════════════════

function ActiveRow({
  upload, started, onPrepare,
}: {
  upload: UploadRecord
  started: boolean
  onPrepare: () => void
}) {
  // «Подготовка…» = worker is processing, OR the user just clicked and the
  // status hasn't flipped yet (still scanned_clean).
  const isPreparing = upload.status === 'processing' || (started && upload.status === 'scanned_clean')
  const isReady     = upload.status === 'scanned_clean' && !isPreparing

  return (
    <div className="card p-4 sm:p-5">
      <div className="flex items-center gap-4">
        {/* pending states (ready / in-progress) have an undefined outcome →
            gray glyph + gray badge; green is reserved for success only. */}
        <FileGlyph tone="muted" />
        <div className="min-w-0 flex-1">
          <div className="font-mono text-sm truncate" title={upload.filename}>{upload.filename}</div>
          <div className="eyebrow mt-1">
            {fileMeta(upload)} · загружен <RelativeTime iso={upload.created_at} />
          </div>
        </div>
        <div className="flex items-center gap-3 shrink-0 whitespace-nowrap">
          {isReady && <span className="badge-neutral shrink-0">Готов к подготовке</span>}
          {isPreparing && <span className="badge-neutral shrink-0">Подготовка…</span>}
          {isReady && (
            <button type="button" className="btn-primary text-sm" onClick={onPrepare}>
              Подготовить данные
            </button>
          )}
        </div>
      </div>

      {/* in-progress → indeterminate bar + caption (clear "something is happening") */}
      {isPreparing && (
        <div className="mt-4">
          <div className="relative h-2 w-full overflow-hidden rounded-full bg-surface-muted">
            <div className="absolute inset-y-0 left-0 w-2/3 rounded-full bg-brand-400 animate-pulse" />
          </div>
          <div className="mt-2 flex items-center gap-2 text-xs text-ink-muted">
            <Spinner /> Идёт подготовка: распознаём формат и колонки, разбираем данные…
          </div>
        </div>
      )}
    </div>
  )
}

// ══════════════════════════════════════════════════════════════════════════
//  HistoryRow — a terminal result: processed (summary + preview) or failed
//  (error toggle + remove). No «Готово, использовать» — the prepared data is
//  automatically available to training.
// ══════════════════════════════════════════════════════════════════════════

function HistoryRow({
  upload, clientId, open, removing, onToggle, onRemove,
}: {
  upload: UploadRecord
  clientId: string
  open: boolean
  removing: boolean
  onToggle: () => void
  onRemove: () => void
}) {
  const isDone = upload.status === 'processed'

  return (
    <div className="card p-4 sm:p-5">
      <div className="flex items-center gap-4">
        <FileGlyph tone={isDone ? 'success' : 'danger'} />
        <div className="min-w-0 flex-1">
          <div className="font-mono text-sm truncate" title={upload.filename}>{upload.filename}</div>
          <div className="eyebrow mt-1">
            {isDone ? 'подготовлено' : 'не удалось'} <RelativeTime iso={upload.updated_at} />
          </div>
        </div>

        {/* metrics — only for processed, hidden on narrow screens */}
        {isDone && (
          <div className="hidden md:flex items-center gap-6 shrink-0">
            <Metric label="Строк" value={upload.row_count} />
            <Metric label="Уникальных SKU" value={upload.sku_count} />
          </div>
        )}

        {/* badge + actions — one line */}
        <div className="flex items-center gap-2 shrink-0 whitespace-nowrap">
          {isDone
            ? <span className="badge-success shrink-0">Подготовлено</span>
            : <span className="badge-danger shrink-0">Не удалось</span>}
          <button type="button" className="btn-tertiary text-sm" onClick={onToggle}>
            {isDone
              ? (open ? 'Скрыть данные' : 'Показать данные')
              : (open ? 'Скрыть ошибку' : 'Показать ошибку')}
          </button>
        </div>
      </div>

      {/* processed → read-only preview */}
      {isDone && open && <PrepPreview clientId={clientId} uploadId={upload.upload_id} />}

      {/* failed → sanitized reason + recovery (clears without a page reload) */}
      {!isDone && open && (
        <div className="mt-4 border-t border-surface-border pt-4">
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
    </div>
  )
}

// ══════════════════════════════════════════════════════════════════════════
//  Small pieces
// ══════════════════════════════════════════════════════════════════════════

function HistoryFilterSelect({
  value, onChange,
}: {
  value: HistoryFilter
  onChange: (v: HistoryFilter) => void
}) {
  return (
    <label className="relative inline-flex items-center">
      <select
        value={value}
        onChange={(e) => onChange(e.target.value as HistoryFilter)}
        className="appearance-none rounded-full border border-surface-border bg-surface-raised
                   pl-4 pr-9 py-1.5 text-sm text-ink cursor-pointer
                   hover:border-brand-300 focus:outline-none focus:border-brand-500"
      >
        <option value="all">Все статусы</option>
        <option value="processed">Подготовлено</option>
        <option value="processing_failed">Не удалось</option>
      </select>
      <svg aria-hidden="true" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"
           className="pointer-events-none absolute right-3 h-4 w-4 text-ink-muted">
        <path d="M6 9l6 6 6-6" strokeLinecap="round" strokeLinejoin="round" />
      </svg>
    </label>
  )
}

// Icon colours follow the approved status palette (same as the badges):
//   pending (ready / in-progress) → gray · success → green · error → red
function FileGlyph({ tone }: { tone: 'success' | 'muted' | 'danger' }) {
  const color =
    tone === 'danger' ? 'text-danger'
    : tone === 'muted' ? 'text-ink-subtle'
    :                    'text-success'
  return (
    <div className={`h-10 w-10 shrink-0 rounded-lg bg-surface-muted flex items-center justify-center ${color}`}>
      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.75"
           strokeLinecap="round" strokeLinejoin="round" className="h-5 w-5">
        <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z" />
        <path d="M14 2v6h6" />
      </svg>
    </div>
  )
}

function Metric({ label, value }: { label: string; value: number | null }) {
  return (
    <div className="text-right">
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

// «CSV · 2.4 МБ» — format from extension + human size.
function fileMeta(upload: UploadRecord): string {
  const dot = upload.filename.lastIndexOf('.')
  const ext = dot >= 0 ? upload.filename.slice(dot + 1).toUpperCase() : 'ФАЙЛ'
  const bytes = upload.size_bytes
  const size = bytes >= 1024 * 1024
    ? `${(bytes / 1024 / 1024).toFixed(1)} МБ`
    : `${Math.max(1, Math.round(bytes / 1024))} КБ`
  return `${ext} · ${size}`
}
