import { useEffect, useMemo, useRef, useState } from 'react'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { formatDistanceToNow, parseISO } from 'date-fns'
import { ru } from 'date-fns/locale'
import toast from 'react-hot-toast'

import { useAuthStore } from '../../features/auth/store'
import { useUsage } from '../../features/plans/useUsage'
import { UpgradeTrigger } from '../../features/plans/upsell'
import { errorMessage } from '../../shared/api/client'
import {
  MAX_UPLOAD_BYTES,
  ACCEPT_ATTRIBUTE,
  UPLOADS_TERMINAL,
  safeUploadError,
  uploadsApi,
  validateUploadClientSide,
  type UploadRecord,
  type UploadStatus,
} from '../../features/uploads/api'
import { useUploadStatus } from '../../features/uploads/useUploadStatus'

// ─────────────────────────────────────────────────────────────────────────
//  Editorial uploads page
//
//  Hierarchy (top to bottom):
//    1. Hero — page title + SKU capacity ledger (dominant element)
//    2. Dropzone — wide, generous whitespace
//    3. Active upload card — process pipeline visualization (if in flight)
//    4. Split view — "Catalog at a glance": visible vs locked SKUs (paper
//       overlay for excess on Free / Start)
//    5. History — tidy list of past uploads
//
//  Soft-lock behavior:
//    • We NEVER reject the upload for having too many SKUs.
//    • Once `processed`, if sku_count > plan.max_skus, a paper-wrapped
//      overflow panel shows (excess count visible, upgrade CTA).
//    • Quota-hit UpgradeTrigger surfaces at ≥80% OR on overflow.
// ─────────────────────────────────────────────────────────────────────────

const STATUS_LABEL: Record<UploadStatus, string> = {
  uploaded:          'Принято',
  scanning:          'Сканирование',
  scanned_clean:     'Загружено',
  infected:          'Вирус',
  processing:        'Разбор',
  processed:         'Готово',
  processing_failed: 'Ошибка',
}
const STATUS_BADGE: Record<UploadStatus, string> = {
  uploaded:          'badge-neutral',
  scanning:          'badge-info',
  scanned_clean:     'badge-success',
  infected:          'badge-danger',
  processing:        'badge-info',
  processed:         'badge-success',
  processing_failed: 'badge-danger',
}

export default function UploadsPage() {
  const clientId = useAuthStore((s) => s.clientId)!
  const qc       = useQueryClient()
  const { data: usage } = useUsage()

  const [activeUploadId, setActiveUploadId] = useState<string | null>(null)
  const [progressPct, setProgressPct]     = useState(0)
  const fileInputRef = useRef<HTMLInputElement>(null)

  // ── Uploads list ────────────────────────────────────────────────
  const { data: uploads = [], isLoading: listLoading } = useQuery({
    queryKey: ['uploads', clientId],
    queryFn: () => uploadsApi.list(clientId),
    refetchInterval: (q) => {
      const rows = q.state.data as UploadRecord[] | undefined
      // Poll only while a file is actively moving through AV or the parser.
      // `scanned_clean` is a REST state — the file waits for the user to run
      // «Подготовить» in «Подготовка данных» — so it must not keep polling.
      const anyMoving = rows?.some(
        (r) => ['uploaded', 'scanning', 'processing'].includes(r.status),
      )
      return anyMoving ? 3_000 : false
    },
    // PjaxLoader-silent — see PjaxLoader.tsx predicate.
    meta: { silent: true },
  })

  // Most recent processed upload — defines "current catalog size".
  const latestProcessed = useMemo<UploadRecord | undefined>(() => {
    return uploads.find((u) => u.status === 'processed')
  }, [uploads])

  // ── Upload mutation ────────────────────────────────────────────
  const { mutateAsync: doUpload, isPending: uploading } = useMutation({
    mutationFn: (file: File) => uploadsApi.upload(clientId, file, setProgressPct),
    onSuccess: (rec) => {
      setActiveUploadId(rec.upload_id)
      setProgressPct(100)
      toast.success('Файл принят, идёт проверка')
      qc.invalidateQueries({ queryKey: ['uploads', clientId] })
      qc.invalidateQueries({ queryKey: ['usage', clientId] })
    },
    onError: (e) => {
      setProgressPct(0)
      toast.error(errorMessage(e, 'Не удалось загрузить файл'))
    },
  })

  const { data: activeUpload } = useUploadStatus(activeUploadId)

  // Recover the in-flight upload after a hard reload: the user's local
  // state (activeUploadId) is gone, but the backend still has the row
  // in non-terminal status. As soon as the list arrives, pick that one
  // so the progress card reappears instead of disappearing.
  useEffect(() => {
    if (activeUploadId) return
    const inflight = uploads.find(
      (u) => !UPLOADS_TERMINAL.includes(u.status),
    )
    if (inflight) setActiveUploadId(inflight.upload_id)
  }, [uploads, activeUploadId])

  // ── Cancel mutation ────────────────────────────────────────────
  // Calls DELETE /uploads/{id}. Backend cleans up S3 in all 3 zones
  // and removes the registry row. Idempotent server-side (204 even
  // if already gone), so we don't bother handling 404 specially.
  const { mutate: cancelUpload, isPending: cancelling } = useMutation({
    mutationFn: (id: string) => uploadsApi.cancel(id),
    onSuccess: () => {
      setActiveUploadId(null)
      setProgressPct(0)
      toast.success('Загрузка отменена')
      qc.invalidateQueries({ queryKey: ['uploads', clientId] })
    },
    onError: (e) => toast.error(errorMessage(e, 'Не удалось отменить')),
  })

  async function handlePickFile(file: File | null) {
    if (!file) return
    const err = validateUploadClientSide(file)
    if (err) {
      toast.error(err)
      if (fileInputRef.current) fileInputRef.current.value = ''
      return
    }
    setProgressPct(0)
    setActiveUploadId(null)
    await doUpload(file)
  }

  const maxSkus = usage?.max_skus ?? null
  const currentSkus = latestProcessed?.sku_count ?? 0
  const isOverflow = maxSkus !== null && currentSkus > maxSkus
  const nearCap    = maxSkus !== null && !isOverflow && (currentSkus / maxSkus) >= 0.8

  return (
    <div className="max-w-6xl space-y-10">
      {/* ═══════════════════ 1. HERO + SKU LEDGER ═══════════════════ */}
      <header className="grid gap-10 lg:grid-cols-12 items-end">
        {/* voice */}
        <div className="lg:col-span-5">
          <div className="eyebrow">Загрузки</div>
          <h1 className="display-em text-brand-700 text-4xl sm:text-5xl mt-2 leading-[1.05]">
            Ваши данные<br/>о продажах.
          </h1>
          <p className="mt-4 text-ink-muted max-w-md">
            Загрузите CSV или XLSX — файл пройдёт проверку безопасности и
            разбор, а затем станет основой прогноза.
          </p>
        </div>

        {/* ledger — the visual centerpiece of the page */}
        <div className="lg:col-span-7">
          <SkuLedger
            used={currentSkus}
            max={maxSkus}
            planLabel={usage?.display_name ?? '…'}
            modelName={usage?.model_display_name ?? '…'}
            isOverflow={isOverflow}
          />
        </div>
      </header>

      {/* Upgrade teaser when near cap (pre-emptive) or over cap */}
      {(nearCap || isOverflow) && (
        <UpgradeTrigger variant="quota-hit" />
      )}

      {/* ═══════════════════ 2. DROPZONE / ACTIVE UPLOAD ═══════════════════
          One slot in the layout, two states:
          - no in-flight upload  → show Dropzone (user can pick a file)
          - upload in pipeline   → hide Dropzone, show ActiveUploadCard
          Cancel from the card sets activeUploadId=null → Dropzone returns. */}
      {activeUpload ? (
        <ActiveUploadCard
          upload={activeUpload}
          onCancel={() => cancelUpload(activeUpload.upload_id)}
          cancelling={cancelling}
        />
      ) : (
        <section>
          <div className="rule-dot mb-6" />
          <div className="eyebrow mb-3">Новый файл</div>
          <Dropzone
            disabled={uploading}
            onFile={handlePickFile}
            progressPct={uploading ? progressPct : 0}
            inputRef={fileInputRef}
          />
        </section>
      )}

      {/* ═══════════════════ 4. CATALOG SPLIT (soft-lock) ═══════════════════ */}
      {latestProcessed && isOverflow && (
        <CatalogSplit
          total={currentSkus}
          visible={maxSkus!}
          planLabel={usage?.display_name ?? 'Free'}
        />
      )}

      {/* ═══════════════════ 5. HISTORY ═══════════════════ */}
      <section>
        <div className="rule-dot mb-6" />
        <div className="flex items-end justify-between mb-4">
          <div>
            <div className="eyebrow">История</div>
            <h2 className="display-em text-brand-700 text-2xl mt-1">
              Предыдущие загрузки
            </h2>
          </div>
          <span className="eyebrow">{uploads.length} записей</span>
        </div>
        {listLoading ? (
          // PJAX top-bar signals the wait; spacer holds layout.
          <div className="card py-10 h-24" aria-hidden="true" />
        ) : uploads.length === 0 ? (
          <div className="card py-10 text-center text-ink-muted text-sm">
            Загрузок ещё нет.
          </div>
        ) : (
          <ul className="card divide-y divide-surface-border">
            {uploads.map((u) => <UploadRow key={u.upload_id} upload={u} maxSkus={maxSkus} />)}
          </ul>
        )}
      </section>
    </div>
  )
}

// ══════════════════════════════════════════════════════════════════════════
//  SkuLedger — the editorial centerpiece.
//
//  Why not a plain progress bar: the value prop here is the **ceiling**,
//  not the "distance from zero". A progress bar reads as "you're filling
//  up" (anxiety); a ledger reads as "this is the shape of your tier"
//  (context). The used portion is a filled bar in brand teal, the
//  remaining is a thin gold underline showing you "there's room".
//  When overflowing: the excess is drawn as a warm terra extension
//  outside the tier bar, making the "what's above the ceiling" visually
//  explicit.
// ══════════════════════════════════════════════════════════════════════════

function SkuLedger({
  used,
  max,
  planLabel,
  modelName,
  isOverflow,
}: {
  used: number
  max: number | null
  planLabel: string
  modelName: string
  isOverflow: boolean
}) {
  // Unlimited tier — celebratory variant
  if (max === null) {
    return (
      <div className="card p-8 text-right relative overflow-hidden">
        <div className="eyebrow">Лимит позиций</div>
        <div className="display-em text-brand-700 text-[8rem] leading-[0.85] mt-2">∞</div>
        <div className="mt-2 eyebrow">
          тариф {planLabel} · модель {modelName}
        </div>
      </div>
    )
  }

  const pct = Math.min(100, (used / max) * 100)

  return (
    <div className="card p-8 relative overflow-hidden">
      {/* Numerical stack */}
      <div className="flex items-end justify-between gap-4">
        <div>
          <div className="eyebrow">Текущий каталог</div>
          <div className="num font-display text-brand-700 text-[4.5rem] sm:text-[5.5rem] leading-none mt-1">
            {used}
          </div>
          <div className="eyebrow mt-1">
            из <span className="num text-ink">{max}</span> · тариф {planLabel}
          </div>
        </div>
        <div className="text-right">
          <div className="eyebrow">Модель</div>
          <div className="display-em text-brand-700 text-3xl mt-1">{modelName}</div>
          {isOverflow && (
            <div className="mt-2 badge-gold">+ {used - max} в превью</div>
          )}
        </div>
      </div>

      {/* Visual ledger bar — brand + gold ceiling + terra overflow */}
      <div className="mt-7">
        <div className="relative h-3 rounded-full bg-surface-muted overflow-visible">
          {/* used within tier */}
          <div
            className={`absolute left-0 top-0 bottom-0 rounded-full transition-all duration-700 ${
              isOverflow ? 'bg-brand-500' : 'bg-brand-500'
            }`}
            style={{ width: `${pct}%` }}
          />
          {/* gold tick at 80% — "you're near the cap" */}
          <span
            aria-hidden
            className="absolute -top-1 bottom-0 h-5 w-[2px] bg-gold-500 rounded-full"
            style={{ left: '80%' }}
            title="80% от лимита"
          />
          {/* ceiling line and label */}
          <span
            aria-hidden
            className="absolute -top-1 bottom-0 h-5 w-[2px] bg-brand-700 rounded-full"
            style={{ left: '100%', transform: 'translateX(-2px)' }}
            title={`Лимит тарифа: ${max}`}
          />
          {/* overflow — extends past 100%, rendered in terra */}
          {isOverflow && (
            <div
              className="absolute top-0 bottom-0 bg-terra rounded-r-full animate-rise"
              style={{
                left: '100%',
                width: `${Math.min(40, ((used - max) / max) * 100)}%`,
              }}
            />
          )}
        </div>
        <div className="flex justify-between mt-2 eyebrow">
          <span>0</span>
          <span className="num">{max}</span>
          {isOverflow && (
            <span className="num text-terra">{used}</span>
          )}
        </div>
      </div>
    </div>
  )
}

// ══════════════════════════════════════════════════════════════════════════
//  CatalogSplit — appears ONLY when current catalog exceeds plan.
//
//  Left side: "Модель видит N позиций" (active forecasting).
//  Right side: "+M в превью" on warm paper with upgrade CTA.
//  Not a block — the upload already succeeded; this is the emotional
//  anchor that makes the user *feel* the difference.
// ══════════════════════════════════════════════════════════════════════════

function CatalogSplit({
  total,
  visible,
  planLabel,
}: {
  total: number
  visible: number
  planLabel: string
}) {
  const locked = total - visible
  return (
    <section className="grid gap-5 md:grid-cols-2">
      {/* Visible half */}
      <div className="card p-6 sm:p-8">
        <div className="flex items-start justify-between">
          <div>
            <div className="eyebrow">Активный прогноз</div>
            <div className="display-em text-brand-700 text-5xl mt-1 leading-none">
              {visible}
            </div>
            <div className="eyebrow mt-1">позиций в модели</div>
          </div>
          <span className="badge-info">в работе</span>
        </div>
        <p className="text-sm text-ink-muted mt-5 leading-relaxed">
          Эти товары обрабатываются по модели и отображаются в прогнозе
          с полной детализацией.
        </p>
      </div>

      {/* Locked half — premium paper */}
      <div className="card-paper p-6 sm:p-8 relative overflow-hidden">
        {/* decorative giant numeral in paper */}
        <span
          aria-hidden
          className="absolute -right-4 -top-4 display-em text-gold-300/40 text-[10rem] leading-none pointer-events-none"
        >
          +
        </span>
        <div className="relative">
          <div className="flex items-start justify-between">
            <div>
              <div className="chapter-num text-[11px]">· превью тарифа</div>
              <div className="display-em text-brand-700 text-5xl mt-1 leading-none">
                +{locked}
              </div>
              <div className="eyebrow mt-1 !text-paper-ink/60">
                позиций ждут своего тарифа
              </div>
            </div>
            <div className="seal-gold" style={{ width: 56, height: 56 }}>
              Start
            </div>
          </div>

          <p className="text-sm text-paper-ink/80 mt-5 leading-relaxed max-w-sm">
            Тариф <strong>{planLabel}</strong> показывает прогноз по первым
            {' '}{visible} позициям. Остальные {locked} вы можете перенести
            в модель, подключив Start (до 1 500 SKU).
          </p>
          <a href="/plans" className="btn-gold mt-5">
            Разблокировать SKU →
          </a>
        </div>
      </div>
    </section>
  )
}

// ══════════════════════════════════════════════════════════════════════════
//  Dropzone
// ══════════════════════════════════════════════════════════════════════════

function Dropzone({
  disabled,
  onFile,
  progressPct,
  inputRef,
}: {
  disabled: boolean
  onFile: (f: File | null) => void
  progressPct: number
  inputRef: React.RefObject<HTMLInputElement>
}) {
  const [dragging, setDragging] = useState(false)
  return (
    <div
      className={[
        'rounded-2xl border-2 border-dashed py-14 px-6 flex flex-col items-center',
        'transition-colors bg-surface-raised',
        dragging ? 'border-brand-500 bg-brand-50' : 'border-surface-border',
        disabled ? 'opacity-60 pointer-events-none' : '',
      ].join(' ')}
      onDragOver={(e) => { e.preventDefault(); setDragging(true) }}
      onDragLeave={() => setDragging(false)}
      onDrop={(e) => {
        e.preventDefault()
        setDragging(false)
        onFile(e.dataTransfer.files?.[0] ?? null)
      }}
    >
      <input
        ref={inputRef}
        type="file"
        accept={ACCEPT_ATTRIBUTE}
        className="hidden"
        onChange={(e) => onFile(e.target.files?.[0] ?? null)}
        disabled={disabled}
      />

      <div className="h-14 w-14 rounded-full bg-brand-50 flex items-center justify-center text-brand-700 mb-4">
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.75"
             strokeLinecap="round" strokeLinejoin="round" className="h-7 w-7">
          <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4" />
          <path d="M17 8l-5-5-5 5" />
          <path d="M12 3v12" />
        </svg>
      </div>

      <div className="display-em text-brand-700 text-2xl">
        Перетащите файл сюда
      </div>
      <p className="text-sm text-ink-muted mt-1">
        или{' '}
        <button
          type="button"
          className="text-brand-500 underline underline-offset-2 hover:text-brand-600"
          onClick={() => inputRef.current?.click()}
          disabled={disabled}
        >
          выберите с диска
        </button>
      </p>
      <p className="eyebrow mt-3">
        CSV / XLSX · до {(MAX_UPLOAD_BYTES / 1024 / 1024).toFixed(0)} МБ
      </p>

      {progressPct > 0 && progressPct < 100 && (
        <div className="mt-6 w-full max-w-md">
          <div className="h-[2px] rounded-full bg-surface-muted overflow-hidden">
            <div
              className="h-full bg-brand-500 transition-all"
              style={{ width: `${progressPct}%` }}
            />
          </div>
          <p className="eyebrow mt-2 text-center">Загрузка {progressPct}%</p>
        </div>
      )}
    </div>
  )
}

// ══════════════════════════════════════════════════════════════════════════
//  ActiveUploadCard — single continuous progress bar (was 5-step stepper).
//
//  Backend status maps to a percent + a one-line caption. Failed states
//  paint red, success goes 100% green-ish (brand teal). The bar fills
//  smoothly via CSS transition so the user feels progress instead of
//  watching pills light up one by one.
// ══════════════════════════════════════════════════════════════════════════

const STATUS_PERCENT: Record<UploadStatus, number> = {
  uploaded:          25,
  scanning:          65,
  scanned_clean:    100,   // upload is DONE here — prep is a separate section
  processing:        80,
  processed:        100,
  infected:         100,   // bar full, but coloured red
  processing_failed: 100,
}

const STATUS_CAPTION: Record<UploadStatus, string> = {
  uploaded:          'Файл принят, идёт проверка…',
  scanning:          'Проверка безопасности…',
  scanned_clean:     'Файл загружен',
  processing:        'Идёт разбор файла…',
  processed:         'Готово — данные доступны для обучения',
  infected:          'Обнаружена угроза — файл удалён',
  processing_failed: 'Не удалось разобрать файл — см. ошибку ниже',
}

function ActiveUploadCard({
  upload,
  onCancel,
  cancelling,
}: {
  upload: UploadRecord
  onCancel: () => void
  cancelling: boolean
}) {
  const pct = STATUS_PERCENT[upload.status] ?? 0
  const isFailed = upload.status === 'infected' || upload.status === 'processing_failed'
  // The upload flow ENDS at scanned_clean — «Загружено». Prep is a separate,
  // independent section; the upload page never waits on it. (`processed` may
  // also appear here if the file was already prepped elsewhere.)
  const isDone   = upload.status === 'scanned_clean' || upload.status === 'processed'
  // Animated stripes only while the upload/scan is still in motion.
  const isMoving = !isFailed && !isDone

  const barColor =
    isFailed ? 'bg-danger'
    : isDone   ? 'bg-brand-500'
    :            'bg-brand-400'

  return (
    <section className="card p-6 animate-fade-in">
      <div className="flex items-center justify-between mb-4 gap-4">
        <div className="min-w-0">
          <div className="eyebrow">Текущая загрузка</div>
          <div className="font-mono text-sm truncate mt-1" title={upload.filename}>
            {upload.filename}
          </div>
        </div>
        <div className="flex items-baseline gap-3 shrink-0">
          <span className="font-display text-brand-700 text-2xl tabular-nums">
            {pct}%
          </span>
          <span className={STATUS_BADGE[upload.status]}>
            {STATUS_LABEL[upload.status]}
          </span>
        </div>
      </div>

      {/* Single continuous progress bar */}
      <div className="relative h-2 w-full overflow-hidden rounded-full bg-surface-muted">
        <div
          className={[
            barColor,
            'h-full rounded-full transition-[width] duration-700 ease-out',
            isMoving && 'animate-pulse',
          ].filter(Boolean).join(' ')}
          style={{ width: `${pct}%` }}
        />
      </div>

      <div className="mt-3 flex items-center justify-between gap-3">
        <div className="text-xs text-ink-muted">
          {STATUS_CAPTION[upload.status]}
        </div>
        {/* Cancel — visible only while pipeline still moving. After
            terminal status the row is on its own; user dismisses by
            uploading another file or via "Удалить" in the history table. */}
        {isMoving && (
          <button
            type="button"
            className="btn-tertiary !px-3 !py-1.5 text-xs shrink-0"
            onClick={onCancel}
            disabled={cancelling}
          >
            {cancelling ? 'Отмена…' : 'Отменить'}
          </button>
        )}
      </div>

      {upload.error_message && (
        <div className="mt-4 rounded-md bg-danger-bg text-danger px-3 py-2 text-sm">
          {safeUploadError(upload.error_message)}
        </div>
      )}

      {upload.status === 'processed' && upload.sku_count != null && (
        <div className="mt-4 flex items-center gap-4 text-sm text-ink-muted">
          <div>
            <span className="eyebrow">Строк</span>
            <div className="num font-display text-brand-700 text-lg">
              {upload.row_count ?? '—'}
            </div>
          </div>
          <div className="h-8 w-px bg-surface-border" />
          <div>
            <span className="eyebrow">Уникальных SKU</span>
            <div className="num font-display text-brand-700 text-lg">
              {upload.sku_count}
            </div>
          </div>
        </div>
      )}
    </section>
  )
}

// ══════════════════════════════════════════════════════════════════════════
//  UploadRow — compact list item for history
// ══════════════════════════════════════════════════════════════════════════

function UploadRow({
  upload,
  maxSkus,
}: {
  upload: UploadRecord
  maxSkus: number | null
}) {
  const relative = useMemo(() => {
    try {
      return formatDistanceToNow(parseISO(upload.created_at), { addSuffix: true, locale: ru })
    } catch {
      return upload.created_at
    }
  }, [upload.created_at])

  const excess = (
    maxSkus !== null &&
    upload.sku_count !== null &&
    upload.sku_count > maxSkus
  )

  return (
    <li className="p-4 flex items-center gap-4">
      <div className="flex-1 min-w-0">
        <div className="font-mono text-sm truncate" title={upload.filename}>
          {upload.filename}
        </div>
        <div className="eyebrow mt-1">
          {(upload.size_bytes / 1024).toFixed(0)} КБ · {relative}
        </div>
      </div>

      {upload.sku_count !== null && (
        <div className="text-right hidden sm:block">
          <div className="eyebrow">SKU</div>
          <div className={`num font-display text-lg ${excess ? 'text-terra' : 'text-brand-700'}`}>
            {upload.sku_count}
            {excess && maxSkus && (
              <span className="text-xs text-ink-subtle ml-1">/{maxSkus}</span>
            )}
          </div>
        </div>
      )}

      <span className={STATUS_BADGE[upload.status]}>
        {STATUS_LABEL[upload.status]}
      </span>
    </li>
  )
}
