import { useEffect, useMemo, useRef, useState } from 'react'
import { Link } from 'react-router-dom'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { format, parseISO } from 'date-fns'
import { ru } from 'date-fns/locale'
import toast from 'react-hot-toast'

import { useAuthStore } from '../../features/auth/store'
import { trainingApi, type JobProgress, type JobStatus, type TrainingRun } from '../../features/training/api'
import { useJobPolling } from '../../features/training/useJobPolling'
import { safeFormat, formatDuration } from '../../features/training/format'
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

  // Failed jobs the user has dismissed via × — persisted across reloads
  // so the resume-active-job effect doesn't grab a stale `running` row
  // (which can linger in DB if the worker died before the FAILED update
  // landed) and re-show the red frame the user just closed.
  const dismissedKey = `dismissedFailedJobs:${clientId}`
  const [dismissedJobs, setDismissedJobs] = useState<Set<string>>(() => {
    try {
      const raw = localStorage.getItem(dismissedKey)
      if (!raw) return new Set()
      return new Set(JSON.parse(raw) as string[])
    } catch {
      return new Set()
    }
  })
  const dismissJob = (id: string) => {
    setDismissedJobs((prev) => {
      const next = new Set(prev)
      next.add(id)
      try {
        localStorage.setItem(dismissedKey, JSON.stringify([...next]))
      } catch {
        /* quota / Safari private — best-effort only */
      }
      return next
    })
    setJobId(null)
  }

  // Resume an in-flight job after a page reload. Local state lost the
  // jobId, but the server still has a `running`/`queued` row with the
  // RQ job_id — pick it up and re-attach polling so the progress bar
  // reappears instead of looking like training was lost. Skip any job
  // the user has already dismissed.
  useEffect(() => {
    if (jobId) return
    const active = runs.find(
      (r) =>
        (r.status === 'running' || r.status === 'queued') &&
        r.job_id != null &&
        !dismissedJobs.has(r.job_id),
    )
    if (active?.job_id) setJobId(active.job_id)
  }, [runs, jobId, dismissedJobs])

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
      {/* Success card lives ABOVE the launch form so the user sees
          "Обучение прошло успешно" first, then the form to start a
          new run sits beneath it — the obvious next-action place. */}
      {jobId && jobStatus?.status === 'finished' && (
        <FinishedCard
          ended={jobStatus.ended}
          elapsedSec={
            typeof (jobStatus.result as { elapsed_sec?: number } | null)?.elapsed_sec === 'number'
              ? (jobStatus.result as { elapsed_sec?: number }).elapsed_sec ?? null
              : null
          }
          onDismiss={() => setJobId(null)}
        />
      )}

      {/* ── Form ─────────────────────────────────────────────── */}
      {/* Hide the launch form while a job is actively running so the
          user can't accidentally trigger a second training. The
          progress section below stays visible instead. Form returns
          once status reaches finished/failed. */}
      {(() => {
        const isTraining =
          !!jobId &&
          jobStatus?.status !== 'finished' &&
          jobStatus?.status !== 'failed'
        if (isTraining) return null
        return (
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
        )
      })()}

      {/* ── Active job status — progress / errors only.
          The "finished" success card moved to the very top of the
          page so it doesn't sit below the launch form. ─────────── */}
      {jobId && jobStatus?.status !== 'finished' && (
        <section className="card p-5 animate-fade-in">
          <div className="flex items-center justify-between mb-3">
            <div>
              <div className="text-sm text-ink-muted">Текущая задача</div>
              <div className="font-mono text-xs text-ink-subtle">{jobId}</div>
            </div>
            <div className="flex items-center gap-2">
              {jobStatus && (
                <span className={STATUS_BADGE[jobStatus.status] ?? 'badge-neutral'}>
                  {STATUS_LABEL[jobStatus.status] ?? jobStatus.status}
                </span>
              )}
              {/* Dismiss × — only for terminal failed jobs. dismissJob
                  also persists the jobId so the resume-active-job effect
                  doesn't re-attach a stale `running` row from the DB
                  (the worker can die mid-run before the FAILED update
                  lands, leaving the row in `running` forever). */}
              {jobStatus?.status === 'failed' && jobId && (
                <button
                  type="button"
                  aria-label="Скрыть"
                  onClick={() => dismissJob(jobId)}
                  className="text-ink-subtle hover:text-ink transition-colors text-lg leading-none px-1"
                  title="Скрыть"
                >
                  ×
                </button>
              )}
            </div>
          </div>

          {jobStatus && jobStatus.status !== 'failed' && (
            <>
              <ProgressBar progress={jobStatus.progress} status={jobStatus.status} />
              <TimingRow
                jobId={jobId}
                started={jobStatus.started}
                ended={jobStatus.ended}
                progress={jobStatus.progress}
                pastRuns={runs}
              />
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

        </section>
      )}

      {/* ── Link to full history (separate page) ─────────────── */}
      {runs.length > 0 && (
        <div className="text-right">
          <Link
            to="/app/training/history"
            className="text-sm text-ink-muted hover:text-ink underline-offset-4 hover:underline"
          >
            Открыть полную историю обучений →
          </Link>
        </div>
      )}
    </div>
  )
}

// ── helpers ──────────────────────────────────────────────────────────────────

function FinishedCard({
  ended,
  elapsedSec,
  onDismiss,
}: {
  ended:      string
  elapsedSec: number | null
  onDismiss:  () => void
}) {
  return (
    <section className="card p-5 animate-fade-in border border-success/30 bg-success-bg/40">
      <div className="flex items-center gap-4">
        <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-success text-ink-invert text-base font-semibold">
          ✓
        </div>
        <div className="flex-1 min-w-0">
          <div className="font-semibold text-ink">Обучение прошло успешно</div>
          <div className="text-xs text-ink-muted mt-0.5">
            Завершено {safeFormat(ended)}
            {elapsedSec != null && <> · заняло {formatDuration(elapsedSec)}</>}
            . Модель активна, прогноз обновлён.
          </div>
        </div>
        <Link to="/app/forecasts" className="btn-primary text-sm whitespace-nowrap">
          Открыть прогноз →
        </Link>
        <button
          type="button"
          aria-label="Скрыть"
          onClick={onDismiss}
          className="text-ink-subtle hover:text-ink transition-colors text-lg leading-none px-1"
        >
          ×
        </button>
      </div>
    </section>
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

function TimingRow({
  jobId,
  started,
  ended,
  progress,
  pastRuns,
}: {
  jobId:    string | null
  started:  string
  ended:    string
  progress: JobProgress | null
  pastRuns: TrainingRun[]
}) {
  // Tick "now" every 30s so the ETA stays accurate without
  // re-rendering the whole page.
  const [, forceTick] = useState(0)
  useEffect(() => {
    const id = setInterval(() => forceTick((t) => t + 1), 30_000)
    return () => clearInterval(id)
  }, [])

  // Average elapsed across past finished runs — our prior on how
  // long this client's trainings usually take. Falls back to a
  // sane default if there's no history yet (first training).
  const avgPastSec = useMemo(() => {
    const finished = pastRuns.filter(
      (r) => r.status === 'finished' && typeof r.elapsed_sec === 'number',
    )
    if (finished.length === 0) return null
    const sum = finished.reduce<number>((s, r) => s + (r.elapsed_sec ?? 0), 0)
    return sum / finished.length
  }, [pastRuns])

  // Estimated remaining seconds.
  //
  // Two-stage logic so the counter never grows on a wall-clock tick:
  //
  // 1. RECALIBRATE only when the worker reports a NEW step (or on
  //    first sight of progress). At that moment we compute a fresh
  //    estimate from elapsed + step + past-runs prior, store it as
  //    a "base" with timestamp. Persisted in localStorage keyed by
  //    jobId so a Cmd+R doesn't reset the lock.
  //
  // 2. BETWEEN step transitions, the displayed ETA is just
  //    base_remaining − (now − base_timestamp). Pure countdown,
  //    monotonically decreasing.
  //
  // Why not the naive elapsed × (total/step − 1) every tick:
  // when a step lingers (HPO, walk-forward), elapsed keeps growing
  // while step stays put → projection inflates with the clock and
  // remaining GROWS. Same story on a fresh page mount if we don't
  // persist — that's why localStorage matters.
  const storageKey = jobId ? `eta-base:${jobId}` : null

  // Restore once when jobId becomes known. Defaults are fresh
  // refs that get filled on first observation if nothing in storage.
  const baseRemainingRef = useRef<number | null>(null)
  const baseTimestampRef = useRef<number>(Date.now())
  const lastStepRef      = useRef<number>(-1)

  // Hydrate from localStorage on jobId change. Doing this in an
  // effect so refs match the active job before the first render
  // computes the displayed value.
  useEffect(() => {
    if (!storageKey) {
      baseRemainingRef.current = null
      baseTimestampRef.current = Date.now()
      lastStepRef.current = -1
      return
    }
    try {
      const raw = localStorage.getItem(storageKey)
      if (!raw) return
      const saved = JSON.parse(raw) as {
        step: number
        baseRemaining: number | null
        baseTimestamp: number
      }
      if (typeof saved.step === 'number') lastStepRef.current = saved.step
      if (typeof saved.baseTimestamp === 'number') baseTimestampRef.current = saved.baseTimestamp
      baseRemainingRef.current = saved.baseRemaining ?? null
    } catch {
      // Ignore — a corrupt entry just means we recalibrate now.
    }
  }, [storageKey])

  const remainingSec = (() => {
    if (!started || started === 'None') {
      lastStepRef.current = -1
      baseRemainingRef.current = null
      return null
    }
    let startedAt: number
    try { startedAt = parseISO(started).getTime() }
    catch { return null }
    const elapsedMs = Date.now() - startedAt
    if (elapsedMs < 0) return null
    const elapsedSec = elapsedMs / 1000
    const step  = progress?.step ?? 0
    const total = progress?.total ?? 9

    // Recalibrate base only on step change (or first observation
    // for this jobId — if storage was empty, lastStepRef started
    // at -1 and any reported step counts as a change).
    if (step !== lastStepRef.current) {
      lastStepRef.current = step
      baseTimestampRef.current = Date.now()

      const linearTotal =
        step > 0 && total > 0 ? elapsedSec * (total / step) : null
      let expectedTotal: number | null = null
      if (avgPastSec != null && linearTotal != null) {
        expectedTotal = Math.max(avgPastSec, linearTotal)
      } else if (avgPastSec != null) {
        expectedTotal = avgPastSec
      } else if (linearTotal != null) {
        expectedTotal = linearTotal
      }
      baseRemainingRef.current =
        expectedTotal != null ? Math.max(0, expectedTotal - elapsedSec) : null

      // Persist so a page reload doesn't blow the lock away.
      if (storageKey) {
        try {
          localStorage.setItem(storageKey, JSON.stringify({
            step,
            baseRemaining: baseRemainingRef.current,
            baseTimestamp: baseTimestampRef.current,
          }))
        } catch {
          // Quota / private mode — ignore, we just lose persistence.
        }
      }
    }

    // Steady-state: countdown from the locked base.
    if (baseRemainingRef.current == null) return null
    const sinceBaseSec = (Date.now() - baseTimestampRef.current) / 1000
    return Math.max(0, baseRemainingRef.current - sinceBaseSec)
  })()

  // Tidy up storage when this job hits a terminal state.
  useEffect(() => {
    if (!storageKey) return
    if (ended && ended !== 'None') {
      try { localStorage.removeItem(storageKey) } catch {}
    }
  }, [storageKey, ended])

  const etaText = (() => {
    if (remainingSec == null) return '—'
    if (remainingSec < 60) return 'осталось < 1 мин'
    const min = Math.round(remainingSec / 60)
    return `осталось ~${min} мин`
  })()

  const etaArrival = (() => {
    if (remainingSec == null) return null
    const arrival = new Date(Date.now() + remainingSec * 1000)
    return format(arrival, 'HH:mm', { locale: ru })
  })()

  return (
    <div className="grid sm:grid-cols-3 gap-3 text-sm">
      <KV label="Начата" value={safeFormat(started)} />
      <div>
        <div className="text-xs uppercase text-ink-subtle">Прогноз</div>
        <div className="font-mono text-ink">{etaText}</div>
        {etaArrival && (
          <div className="text-xs text-ink-subtle mt-0.5">
            ≈ {etaArrival}
          </div>
        )}
      </div>
      <KV label="Завершена" value={safeFormat(ended)} />
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

  // While the backend hasn't reported a step yet (queued, or just-
  // started), we use an indeterminate "marching" bar so the UI doesn't
  // look frozen. Once a step lands, we switch to a determinate fill
  // that grows with progress; a soft moving stripe pattern keeps the
  // whole thing visually alive even when the percentage is stable.
  const indeterminate = pct === 0

  return (
    <div className="mb-4">
      <div className="flex items-baseline justify-between mb-1.5 text-sm">
        {/* Tiny pulsing dot so the eye picks up "still running"
            even before reading the label. */}
        <span className="flex items-center gap-2 text-ink">
          <span
            aria-hidden
            className="h-1.5 w-1.5 rounded-full bg-brand-500 animate-ping-slow"
          />
          <span>{label}</span>
        </span>
        <span className="font-mono text-xs text-ink-muted tabular-nums">
          {indeterminate ? '…' : `${step}/${total} · ${pct}%`}
        </span>
      </div>
      <div className="relative h-2 w-full rounded-full bg-surface-muted overflow-hidden">
        {indeterminate ? (
          // Indeterminate: a slim chip slides across the track.
          <div
            className="absolute top-0 h-full w-1/3 bg-brand-500/80 rounded-full animate-progress-indeterminate"
            aria-label="идёт подготовка"
          />
        ) : (
          <div
            className="relative h-full bg-brand-500 transition-[width] duration-500 ease-out overflow-hidden"
            style={{ width: `${pct}%` }}
          >
            {/* Marching diagonal stripes inside the filled portion —
                guarantees visible movement even when step lingers
                (e.g. 5-min HPO at Step 5/9). */}
            <div className="absolute inset-0 progress-stripes opacity-30" />
          </div>
        )}
      </div>
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
