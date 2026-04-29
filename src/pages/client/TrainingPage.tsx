import { useMemo, useState } from 'react'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { format, parseISO } from 'date-fns'
import { ru } from 'date-fns/locale'
import toast from 'react-hot-toast'

import { useAuthStore } from '../../features/auth/store'
import { trainingApi, type JobProgress, type JobStatus, type TrainingRun } from '../../features/training/api'
import { useJobPolling } from '../../features/training/useJobPolling'
import { uploadsApi, type UploadRecord } from '../../features/uploads/api'
import { useUsage } from '../../features/plans/useUsage'
import { errorMessage } from '../../shared/api/client'

const STATUS_LABEL: Record<JobStatus, string> = {
  queued:   'В очереди',
  started:  'Выполняется',
  finished: 'Готово',
  failed:   'Ошибка',
  unknown:  'Неизвестно',
}
const STATUS_BADGE: Record<JobStatus, string> = {
  queued:   'badge-neutral',
  started:  'badge-info',
  finished: 'badge-success',
  failed:   'badge-danger',
  unknown:  'badge-neutral',
}

function safeFormat(iso: string | null | undefined): string {
  if (!iso || iso === 'None') return '—'
  try {
    return format(parseISO(iso), 'dd MMM yyyy HH:mm', { locale: ru })
  } catch {
    return iso
  }
}

export default function TrainingPage() {
  const clientId = useAuthStore((s) => s.clientId)!
  const qc       = useQueryClient()

  // ── Plan + usage ─────────────────────────────────────────────────
  const { data: usage } = useUsage()

  // ── Processed uploads available for training ─────────────────────
  const { data: uploads = [] } = useQuery({
    queryKey: ['uploads', clientId],
    queryFn: () => uploadsApi.list(clientId),
  })
  const processedUploads = uploads.filter((u) => u.status === 'processed')

  // ── Form state ───────────────────────────────────────────────────
  const [uploadId,     setUploadId]     = useState<string>('')
  const [jobId,        setJobId]        = useState<string | null>(null)
  // When the user has at least one finished training, default to
  // "продолжить с предыдущим набором". They can untick if they want
  // a clean retrain on just the new file.
  const [extendFromPrev, setExtendFromPrev] = useState<boolean>(true)

  const selectedUpload: UploadRecord | undefined = useMemo(
    () => processedUploads.find((u) => u.upload_id === uploadId),
    [uploadId, processedUploads],
  )

  // ── Plan gates ───────────────────────────────────────────────────
  const cooldown = usage?.cooldown_until ? parseISO(usage.cooldown_until) : null
  const now = new Date()
  const blockedByCooldown = !!(cooldown && cooldown > now)
  const blockedByCounter  =
    usage?.training_runs_remaining === 0
  const skuOverLimit =
    !!selectedUpload &&
    usage?.max_skus !== null &&
    usage?.max_skus !== undefined &&
    // row_count is the whole file size — not the sku count — so this is
    // only a soft hint; the server does the real check via manifest.
    // We use the upload's row_count as a coarse flag only.
    selectedUpload.row_count !== null &&
    false  // placeholder — real check is server-side

  const { mutate: train, isPending } = useMutation({
    mutationFn: () => {
      // Find the most recent finished run with a different upload_id —
      // that's what we'd merge with when "extend from previous" is on.
      const prevUploadId = lastFinishedDifferentUploadId
      const extendFrom =
        extendFromPrev && prevUploadId && prevUploadId !== uploadId
          ? prevUploadId
          : undefined
      // We pass only upload_id — backend resolves the actual s3:// URI
      // from the upload registry. Hardcoding "s3://processed/..." here
      // (as we used to) was wrong: "processed" isn't the real bucket
      // name on Beget. data_path stays as a stub so the request
      // satisfies the schema; the backend ignores it when upload_id
      // is present.
      return trainingApi.startTraining(clientId, {
        data_path: selectedUpload?.upload_id
          ? `upload://${selectedUpload.upload_id}`
          : '',
        upload_id: uploadId || undefined,
        extend_from_upload_id: extendFrom,
      })
    },
    onSuccess: (res) => {
      setJobId(res.job_id)
      toast.success(
        res.status === 'queued'
          ? 'Обучение поставлено в очередь'
          : 'Обучение выполнено синхронно',
      )
      qc.invalidateQueries({ queryKey: ['usage', clientId] })
      qc.invalidateQueries({ queryKey: ['training-runs', clientId] })
    },
    onError: (e) => toast.error(errorMessage(e, 'Не удалось запустить обучение')),
  })

  const { data: jobStatus } = useJobPolling(jobId)

  // ── Training history — independent of RQ's 24h result_ttl ─────
  // Refetch while a job is alive so the row transitions visibly
  // queued → running → finished, then settle to a static list.
  const { data: history } = useQuery({
    queryKey: ['training-runs', clientId],
    queryFn: () => trainingApi.listRuns(clientId, 20),
    refetchInterval: (q) => {
      // If we're polling a job and it isn't terminal, also refetch
      // history so the row reflects updates from the worker.
      if (jobStatus && jobStatus.status !== 'finished' && jobStatus.status !== 'failed') {
        return 5000
      }
      return q.state.data ? false : false
    },
  })
  const runs = history?.runs ?? []

  // Most recent successful training that used a different upload from
  // the one currently selected — that's the one we'd merge with.
  const lastFinishedDifferentUploadId = useMemo(() => {
    for (const r of runs) {
      if (r.status === 'finished' && r.upload_id && r.upload_id !== uploadId) {
        return r.upload_id
      }
    }
    return null
  }, [runs, uploadId])

  const lastFinishedRun = useMemo(
    () => runs.find((r) => r.status === 'finished' && r.upload_id) ?? null,
    [runs],
  )
  const lastFinishedUpload: UploadRecord | undefined = useMemo(
    () =>
      lastFinishedRun?.upload_id
        ? processedUploads.find((u) => u.upload_id === lastFinishedRun.upload_id)
        : undefined,
    [lastFinishedRun, processedUploads],
  )

  return (
    <div className="space-y-6 max-w-4xl">
      <div className="flex items-start justify-between gap-4">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight">Обучение модели</h1>
          <p className="text-ink-muted mt-1 text-sm">
            Запустите обучение на уже загруженном и проверенном наборе данных.
            Результат станет активной моделью для прогнозов.
          </p>
        </div>
        {usage && <UsageCard usage={usage} />}
      </div>

      {/* ── Form ─────────────────────────────────────────────── */}
      <section className="card p-6">
        <h2 className="text-sm font-semibold text-ink-muted uppercase tracking-wide mb-4">
          Параметры запуска
        </h2>

        <label className="label">Набор данных (обработанный)</label>
        {processedUploads.length === 0 ? (
          <div className="rounded-md bg-surface-muted px-3 py-2 text-sm text-ink-muted">
            Нет готовых загрузок. Сначала загрузите CSV/XLSX на вкладке
            «Загрузки».
          </div>
        ) : (
          <select
            className="input"
            value={uploadId}
            onChange={(e) => setUploadId(e.target.value)}
          >
            <option value="">— выберите —</option>
            {processedUploads.map((u) => (
              <option key={u.upload_id} value={u.upload_id}>
                {u.filename} · {u.row_count ?? '?'} строк · {safeFormat(u.created_at)}
              </option>
            ))}
          </select>
        )}

        {/* Continue-training toggle — appears only when there's a
            prior finished training run on a different upload.
            Default ON: typical workflow is "user re-uploads delta,
            wants combined training". They can untick for clean retrain. */}
        {!!lastFinishedDifferentUploadId && !!uploadId && (
          <label className="mt-4 flex items-start gap-3 cursor-pointer rounded-md border border-surface-border p-3 hover:bg-surface-muted/40">
            <input
              type="checkbox"
              className="mt-0.5 h-4 w-4 accent-brand-500"
              checked={extendFromPrev}
              onChange={(e) => setExtendFromPrev(e.target.checked)}
            />
            <div className="flex-1 text-sm">
              <div className="text-ink font-medium">
                Продолжить обучение с предыдущим набором
              </div>
              <div className="text-ink-subtle text-xs mt-0.5">
                Объединит выбранный файл{selectedUpload?.row_count != null && ` (${selectedUpload.row_count.toLocaleString('ru-RU')} строк)`}
                {' '}с предыдущим обученным датасетом
                {lastFinishedUpload?.filename && ` «${lastFinishedUpload.filename}»`}
                {lastFinishedUpload?.row_count != null && ` (${lastFinishedUpload.row_count.toLocaleString('ru-RU')} строк)`}
                {' '}и переобучит модель на полном объёме.
                Совпадающие даты по SKU заменятся новыми значениями.
              </div>
            </div>
          </label>
        )}

        {/* Plan-driven warnings */}
        <div className="mt-4 space-y-2">
          {blockedByCooldown && cooldown && (
            <NoticeRow tone="warn">
              Тариф Free: следующий запуск доступен
              с {format(cooldown, 'dd MMM HH:mm', { locale: ru })}.
            </NoticeRow>
          )}
          {blockedByCounter && usage && (
            <NoticeRow tone="warn">
              Исчерпан лимит запусков на месяц
              ({usage.training_runs_used} / {usage.training_runs_per_month}).
            </NoticeRow>
          )}
          {skuOverLimit && (
            <NoticeRow tone="danger">
              Размер датасета превышает лимит тарифа.
            </NoticeRow>
          )}
        </div>

        <div className="mt-6 flex items-center gap-3">
          <button
            type="button"
            className="btn-primary"
            onClick={() => train()}
            disabled={
              !uploadId ||
              isPending ||
              blockedByCooldown ||
              blockedByCounter
            }
          >
            {isPending ? 'Запуск…' : 'Запустить обучение'}
          </button>
          {usage && usage.training_runs_per_month !== null && (
            <span className="text-sm text-ink-muted">
              Осталось запусков в этом месяце:{' '}
              <strong className="text-ink">{usage.training_runs_remaining}</strong>
              {' / '}
              {usage.training_runs_per_month}
            </span>
          )}
        </div>
      </section>

      {/* ── Active job status ────────────────────────────────── */}
      {jobId && (
        <section className="card p-5 animate-fade-in">
          <div className="flex items-center justify-between mb-3">
            <div>
              <div className="text-sm text-ink-muted">Текущая задача</div>
              <div className="font-mono text-sm">{jobId}</div>
            </div>
            {jobStatus && (
              <span className={STATUS_BADGE[jobStatus.status] ?? 'badge-neutral'}>
                {STATUS_LABEL[jobStatus.status] ?? jobStatus.status}
              </span>
            )}
          </div>

          {jobStatus && jobStatus.status !== 'finished' && jobStatus.status !== 'failed' && (
            <>
              <ProgressBar progress={jobStatus.progress} status={jobStatus.status} />
              <div className="grid sm:grid-cols-3 gap-3 text-sm">
                <KV label="Поставлена" value={safeFormat(jobStatus.enqueued)} />
                <KV label="Начата"     value={safeFormat(jobStatus.started)} />
                <KV label="Завершена"  value={safeFormat(jobStatus.ended)} />
              </div>
            </>
          )}

          {jobStatus?.status === 'failed' && jobStatus.error && (
            <div>
              <div className="text-xs uppercase text-ink-subtle">Ошибка</div>
              <pre className="mt-1 whitespace-pre-wrap break-words text-danger text-xs bg-danger-bg p-3 rounded">
                {jobStatus.error}
              </pre>
            </div>
          )}

          {jobStatus?.status === 'finished' && jobStatus.result && (
            <FinishedSummary result={jobStatus.result} ended={jobStatus.ended} />
          )}
        </section>
      )}

      {/* ── Training history ─────────────────────────────────── */}
      {runs.length > 0 && <HistorySection runs={runs} uploads={uploads} />}
    </div>
  )
}

// ── helpers ──────────────────────────────────────────────────────────────────

function UsageCard({
  usage,
}: {
  usage: NonNullable<ReturnType<typeof useUsage>['data']>
}) {
  return (
    <div className="card p-4 shrink-0 w-64">
      <div className="text-xs uppercase tracking-wider text-ink-subtle">
        Тариф
      </div>
      <div className="text-lg font-semibold mt-0.5">
        {usage.display_name}{' '}
        <span className="text-ink-muted text-sm font-normal">
          · {usage.model_display_name}
        </span>
      </div>
      <dl className="mt-3 space-y-1.5 text-xs">
        <Row label="Лимит SKU"  value={usage.max_skus ?? 'без ограничений'} />
        <Row label="Горизонт"   value={
          usage.max_horizon_days ? `до ${usage.max_horizon_days} дн.` : 'без ограничений'
        } />
        <Row label="Кулдаун"    value={
          usage.training_cooldown_hours ? `${usage.training_cooldown_hours} ч.` : '—'
        } />
        <Row label="В месяц"    value={
          usage.training_runs_per_month !== null
            ? `${usage.training_runs_used}/${usage.training_runs_per_month}`
            : 'без ограничений'
        } />
      </dl>
    </div>
  )
}

function Row({ label, value }: { label: string; value: React.ReactNode }) {
  return (
    <div className="flex justify-between gap-2">
      <dt className="text-ink-subtle">{label}</dt>
      <dd className="text-ink font-medium truncate">{value}</dd>
    </div>
  )
}

function KV({ label, value }: { label: string; value: string }) {
  return (
    <div>
      <div className="text-xs uppercase text-ink-subtle">{label}</div>
      <div className="font-mono text-ink">{value}</div>
    </div>
  )
}

function formatDuration(sec: number): string {
  if (!Number.isFinite(sec) || sec < 0) return '—'
  const m = Math.floor(sec / 60)
  const s = Math.round(sec - m * 60)
  return m === 0 ? `${s} сек` : `${m} мин ${s.toString().padStart(2, '0')} сек`
}

function FinishedSummary({
  result,
  ended,
}: {
  result: Record<string, unknown>
  ended: string
}) {
  const metrics  = (result.metrics  as Record<string, number> | undefined) ?? {}
  const wmape    = metrics.wmape_mean
  const mase     = metrics.mase_mean
  const smape    = metrics.smape_mean
  const elapsed  = typeof result.elapsed_sec === 'number' ? result.elapsed_sec : null
  const nSkus    = typeof result.n_skus      === 'number' ? result.n_skus     : null
  const nRows    = typeof result.n_rows      === 'number' ? result.n_rows     : null
  const nFeats   = typeof result.n_features  === 'number' ? result.n_features : null

  return (
    <div className="space-y-5 animate-fade-in">
      {/* ── Hero ───────────────────────────────────────────────── */}
      <div className="flex items-start gap-3 rounded-lg bg-success-bg/60 border border-success/20 p-4">
        <div className="mt-0.5 flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-success text-ink-invert text-sm font-semibold">
          ✓
        </div>
        <div className="flex-1">
          <div className="font-semibold text-ink">Модель обучена и активна</div>
          <div className="text-xs text-ink-muted mt-0.5">
            {safeFormat(ended)}
            {elapsed != null && <> · обучение заняло {formatDuration(elapsed)}</>}
          </div>
        </div>
      </div>

      {/* ── Metrics ────────────────────────────────────────────── */}
      <div>
        <div className="text-xs uppercase tracking-wider text-ink-subtle mb-2">
          Точность модели
        </div>
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
          <MetricCard
            label="WMAPE"
            value={wmape}
            hint="Средняя ошибка по всем SKU. Ниже — точнее."
            quality={qualityWMAPE(wmape)}
          />
          <MetricCard
            label="MASE"
            value={mase}
            hint="Сравнение с наивным прогнозом. < 1 — модель лучше базовой."
            quality={qualityMASE(mase)}
          />
          <MetricCard
            label="sMAPE"
            value={smape}
            hint="Симметричная относительная ошибка, %."
            quality={qualityWMAPE(smape)}
            isPercent
          />
        </div>
      </div>

      {/* ── Dataset summary ────────────────────────────────────── */}
      <div className="text-sm text-ink-muted">
        Обучено на{' '}
        <span className="text-ink font-medium">{nSkus ?? '—'} SKU</span>
        {nRows != null && (
          <> · <span className="text-ink font-medium">{nRows.toLocaleString('ru-RU')}</span> строк</>
        )}
        {nFeats != null && (
          <> · <span className="text-ink font-medium">{nFeats}</span> признаков</>
        )}
      </div>
    </div>
  )
}

// Quality bands — used for the colour bar under the metric value.
//   green — модель точная
//   yellow — приемлемо
//   red — слабо, надо больше данных или другие признаки
function qualityWMAPE(v: number | undefined): 'good' | 'ok' | 'poor' | null {
  if (v == null || !Number.isFinite(v)) return null
  if (v < 0.20) return 'good'
  if (v < 0.40) return 'ok'
  return 'poor'
}
function qualityMASE(v: number | undefined): 'good' | 'ok' | 'poor' | null {
  if (v == null || !Number.isFinite(v)) return null
  if (v < 0.80) return 'good'
  if (v < 1.10) return 'ok'
  return 'poor'
}

function MetricCard({
  label,
  value,
  hint,
  quality,
  isPercent = false,
}: {
  label: string
  value: number | undefined
  hint: string
  quality: 'good' | 'ok' | 'poor' | null
  isPercent?: boolean
}) {
  const display =
    value == null || !Number.isFinite(value)
      ? '—'
      : isPercent
        ? `${(value * 100).toFixed(1)}%`
        : value.toFixed(3)

  const qualityClass =
    quality === 'good' ? 'bg-success'
      : quality === 'ok'   ? 'bg-warn'
      : quality === 'poor' ? 'bg-danger'
      : 'bg-surface-border'

  return (
    <div className="rounded-lg border border-surface-border p-4">
      <div className="flex items-baseline justify-between">
        <div className="text-sm font-medium text-ink-muted">{label}</div>
        <div className="font-display text-2xl tabular-nums text-ink">{display}</div>
      </div>
      <div className={`mt-2 h-1 w-full rounded-full ${qualityClass}`} />
      <div className="mt-2 text-xs text-ink-subtle leading-snug">{hint}</div>
    </div>
  )
}

function ProgressBar({
  progress,
  status,
}: {
  progress: JobProgress | null
  status: JobStatus
}) {
  // Worker hasn't reported yet — show indeterminate state for "queued".
  const step  = progress?.step ?? 0
  const total = progress?.total ?? 9
  const pct   = Math.min(100, Math.round((step / total) * 100))
  const label = progress?.label
    ?? (status === 'queued' ? 'Ожидание свободного воркера…' : 'Запуск…')

  return (
    <div className="mb-4">
      <div className="flex items-baseline justify-between mb-1.5 text-sm">
        <span className="text-ink">{label}</span>
        <span className="font-mono text-xs text-ink-muted tabular-nums">
          {step}/{total} · {pct}%
        </span>
      </div>
      <div className="h-2 w-full rounded-full bg-surface-muted overflow-hidden">
        <div
          className="h-full bg-brand-500 transition-[width] duration-500 ease-out"
          style={{ width: `${pct}%` }}
        />
      </div>
    </div>
  )
}

const RUN_STATUS_LABEL: Record<TrainingRun['status'], string> = {
  queued:   'В очереди',
  running:  'Выполняется',
  finished: 'Готово',
  failed:   'Ошибка',
}
const RUN_STATUS_BADGE: Record<TrainingRun['status'], string> = {
  queued:   'badge-neutral',
  running:  'badge-info',
  finished: 'badge-success',
  failed:   'badge-danger',
}

function HistorySection({
  runs,
  uploads,
}: {
  runs: TrainingRun[]
  uploads: UploadRecord[]
}) {
  // Map upload_id → human filename so the row can show "promo_q1.csv"
  // instead of an opaque hash. Falls back to the hash if the upload
  // was deleted.
  const uploadName = useMemo(() => {
    const map = new Map<string, string>()
    for (const u of uploads) map.set(u.upload_id, u.filename)
    return map
  }, [uploads])

  return (
    <section className="card p-5">
      <div className="flex items-baseline justify-between mb-4">
        <h2 className="text-sm font-semibold text-ink-muted uppercase tracking-wide">
          История запусков
        </h2>
        <span className="text-xs text-ink-subtle">всего: {runs.length}</span>
      </div>

      <div className="overflow-x-auto -mx-5 px-5">
        <table className="w-full text-sm">
          <thead>
            <tr className="text-xs uppercase text-ink-subtle border-b border-surface-border">
              <th className="text-left py-2 pr-3 font-medium">Когда</th>
              <th className="text-left py-2 pr-3 font-medium">Датасет</th>
              <th className="text-left py-2 pr-3 font-medium">Тариф</th>
              <th className="text-right py-2 pr-3 font-medium">SKU</th>
              <th className="text-right py-2 pr-3 font-medium">WMAPE</th>
              <th className="text-right py-2 pr-3 font-medium">MASE</th>
              <th className="text-right py-2 pr-3 font-medium">Длит.</th>
              <th className="text-right py-2 font-medium">Статус</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-surface-border">
            {runs.map((r) => {
              const dsName = r.upload_id
                ? (uploadName.get(r.upload_id) ?? `${r.upload_id.slice(0, 8)}…`)
                : '—'
              return (
                <tr key={r.run_id} className="hover:bg-surface-muted/40">
                  <td className="py-2 pr-3 text-ink whitespace-nowrap">
                    {safeFormat(r.enqueued_at)}
                  </td>
                  <td className="py-2 pr-3 text-ink truncate max-w-[14rem]" title={dsName}>
                    {dsName}
                  </td>
                  <td className="py-2 pr-3 text-ink-muted text-xs uppercase">{r.plan}</td>
                  <td className="py-2 pr-3 text-right tabular-nums">
                    {r.n_skus ?? '—'}
                  </td>
                  <td className="py-2 pr-3 text-right tabular-nums font-mono">
                    {r.wmape != null ? r.wmape.toFixed(3) : '—'}
                  </td>
                  <td className="py-2 pr-3 text-right tabular-nums font-mono">
                    {r.mase != null ? r.mase.toFixed(3) : '—'}
                  </td>
                  <td className="py-2 pr-3 text-right tabular-nums text-ink-muted">
                    {r.elapsed_sec != null ? formatDuration(r.elapsed_sec) : '—'}
                  </td>
                  <td className="py-2 text-right">
                    <span className={RUN_STATUS_BADGE[r.status] ?? 'badge-neutral'}>
                      {RUN_STATUS_LABEL[r.status] ?? r.status}
                    </span>
                  </td>
                </tr>
              )
            })}
          </tbody>
        </table>
      </div>
    </section>
  )
}

function NoticeRow({
  tone,
  children,
}: {
  tone: 'warn' | 'danger'
  children: React.ReactNode
}) {
  const cls = tone === 'warn'
    ? 'bg-warn-bg text-warn'
    : 'bg-danger-bg text-danger'
  return (
    <div className={`rounded-md px-3 py-2 text-sm ${cls}`}>{children}</div>
  )
}
