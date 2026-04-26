import { useMemo, useState } from 'react'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { format, parseISO } from 'date-fns'
import { ru } from 'date-fns/locale'
import toast from 'react-hot-toast'

import { useAuthStore } from '../../features/auth/store'
import { trainingApi, type JobStatus } from '../../features/training/api'
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
  const [uploadId, setUploadId] = useState<string>('')
  const [jobId,    setJobId]    = useState<string | null>(null)

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
    mutationFn: () =>
      trainingApi.startTraining(clientId, {
        data_path: selectedUpload
          ? `s3://processed/${clientId}/${selectedUpload.upload_id}/data.parquet`
          : '',
        upload_id: uploadId || undefined,
      }),
    onSuccess: (res) => {
      setJobId(res.job_id)
      toast.success(
        res.status === 'queued'
          ? 'Обучение поставлено в очередь'
          : 'Обучение выполнено синхронно',
      )
      qc.invalidateQueries({ queryKey: ['usage', clientId] })
    },
    onError: (e) => toast.error(errorMessage(e, 'Не удалось запустить обучение')),
  })

  const { data: jobStatus } = useJobPolling(jobId)

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

          {jobStatus && (
            <div className="grid sm:grid-cols-3 gap-3 text-sm">
              <KV label="Поставлена"  value={safeFormat(jobStatus.enqueued)} />
              <KV label="Начата"      value={safeFormat(jobStatus.started)} />
              <KV label="Завершена"   value={safeFormat(jobStatus.ended)} />
              {jobStatus.error && (
                <div className="sm:col-span-3">
                  <div className="text-xs uppercase text-ink-subtle">Ошибка</div>
                  <pre className="mt-1 whitespace-pre-wrap break-words text-danger text-xs bg-danger-bg p-3 rounded">
                    {jobStatus.error}
                  </pre>
                </div>
              )}
              {jobStatus.status === 'finished' && jobStatus.result && (
                <div className="sm:col-span-3">
                  <div className="text-xs uppercase text-ink-subtle mb-2">Метрики</div>
                  <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
                    {Object.entries(jobStatus.result).map(([k, v]) => (
                      <div key={k} className="rounded-md bg-surface-muted p-2">
                        <div className="text-xs text-ink-subtle truncate">{k}</div>
                        <div className="font-mono text-sm">
                          {typeof v === 'number' ? v.toFixed(4) : String(v)}
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </div>
          )}
        </section>
      )}
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
