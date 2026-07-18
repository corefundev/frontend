// DS-2 (#467) — страница датасета: состав файлов, отчёт слияния, версии,
// «Доложить CSV» и «Обучить модель». Порт утверждённого прототипа
// docs/design/cabinet-v2/screen_dataset.png (backend repo).
import { useEffect, useMemo, useRef, useState } from 'react'
import { Link, useParams, useSearchParams } from 'react-router-dom'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'

import { useAuthStore } from '../../features/auth/store'
import {
  datasetsApi,
  orderAccuracyPct,
  type DatasetDetail,
  type DatasetVersionRow,
} from '../../features/datasets/api'
import {
  uploadsApi,
  validateUploadClientSide,
  ACCEPT_ATTRIBUTE,
  type UploadStatus,
} from '../../features/uploads/api'
import { cooldownEta, errorMessage, trainingDenial } from '../../shared/api/client'
import { datasetBadge, fmtDate, fmtDateTime, fmtInt, fmtPeriod } from '../../features/datasets/format'
import { cabPath } from '../../shared/hostRouting'

const FILE_BADGE: Partial<Record<UploadStatus | 'deleted', { label: string; cls: string }>> = {
  processed:         { label: 'Обработан',         cls: 'badge badge-success' },
  processing:        { label: 'Подготовка…',       cls: 'badge badge-info' },
  processing_failed: { label: 'Ошибка обработки',  cls: 'badge badge-danger' },
  infected:          { label: 'Отклонён проверкой', cls: 'badge badge-danger' },
  scanned_clean:     { label: 'Ждёт подготовки',   cls: 'badge badge-neutral' },
  scanning:          { label: 'Проверка…',         cls: 'badge badge-neutral' },
  uploaded:          { label: 'Загружен',          cls: 'badge badge-neutral' },
  deleted:           { label: 'Удалён',            cls: 'badge badge-neutral' },
}

const PENDING_MOVING: UploadStatus[] = ['uploaded', 'scanning', 'processing']

// «Слияние»: +N · заменено M (прочерк для pre-DS-2 прикреплений)
function mergeCell(added: number | null, replaced: number | null): string {
  if (added == null) return '—'
  const base = `+${fmtInt(added)}`
  return replaced ? `${base} · заменено ${fmtInt(replaced)}` : base
}

// Строка «Версий данных»: что изменилось в версии
function versionLine(v: DatasetVersionRow,
                     fileNames: Map<string, string>): string {
  const r = (v.merge_report ?? {}) as Record<string, unknown>
  if (v.status === 'failed') return 'ошибка сборки'
  if (r.kind === 'append') {
    const src = fileNames.get(String(r.source_upload_id ?? '')) ?? 'файл'
    const repl = Number(r.replaced ?? 0)
    return repl > 0 ? `+ ${src} (заменено ${fmtInt(repl)})` : `+ ${src}`
  }
  if (r.kind === 'rebuild') return `пересборка из ${r.files ?? '?'} файлов`
  return 'изменение состава'
}

export default function DatasetPage() {
  const clientId = useAuthStore((s) => s.clientId)!
  const { datasetId = '' } = useParams()
  const [search, setSearch] = useSearchParams()
  const qc = useQueryClient()
  const fileInput = useRef<HTMLInputElement>(null)
  const [uploadErr, setUploadErr] = useState<string | null>(null)
  const [uploadPct, setUploadPct] = useState<number | null>(null)
  const [trainNote, setTrainNote] = useState<string | null>(null)

  const { data: ds, isLoading, isError, error } = useQuery({
    queryKey: ['dataset', clientId, datasetId],
    queryFn: () => datasetsApi.get(clientId, datasetId),
    refetchInterval: (q) => {
      const d = q.state.data as DatasetDetail | undefined
      return (d?.pending_uploads ?? []).some((p) => PENDING_MOVING.includes(p.status))
        ? 3000
        : false
    },
  })

  const invalidate = () => {
    qc.invalidateQueries({ queryKey: ['dataset', clientId, datasetId] })
    qc.invalidateQueries({ queryKey: ['datasets', clientId] })
    qc.invalidateQueries({ queryKey: ['uploads', clientId] })
  }

  const upload = useMutation({
    mutationFn: (file: File) =>
      uploadsApi.upload(clientId, file, setUploadPct, datasetId),
    onSuccess: invalidate,
    onSettled: () => setUploadPct(null),
  })

  const prepare = useMutation({
    mutationFn: (uploadId: string) => uploadsApi.prepare(clientId, uploadId),
    onSuccess: invalidate,
  })

  const train = useMutation({
    mutationFn: () => datasetsApi.train(clientId, datasetId),
    onSuccess: () => {
      setTrainNote('Обучение запущено — модель обновится автоматически.')
      invalidate()
    },
    onError: (e) => {
      const denial = trainingDenial(e)
      if (denial?.reasonCode === 'cooldown') {
        const eta = cooldownEta(denial.cooldownUntil, denial.retryAfterSec)
        setTrainNote(eta
          ? `Обучение будет доступно через ${eta}.`
          : denial.message || errorMessage(e))
      } else if (denial) {
        setTrainNote('Обучение уже идёт — дождитесь завершения.')
      } else {
        setTrainNote(errorMessage(e))
      }
    },
  })

  // ?upload=1 / ?train=1 с карточки списка — сразу открыть нужный флоу
  useEffect(() => {
    if (!ds) return
    if (search.get('upload') === '1') {
      fileInput.current?.click()
      setSearch({}, { replace: true })
    } else if (search.get('train') === '1') {
      setSearch({}, { replace: true })
      if (!train.isPending) train.mutate()
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [ds != null])

  const fileNames = useMemo(() => {
    const m = new Map<string, string>()
    ;(ds?.files_detail ?? []).forEach((f) => {
      if (f.filename) m.set(f.upload_id, f.filename)
    })
    ;(ds?.pending_uploads ?? []).forEach((p) => m.set(p.upload_id, p.filename))
    return m
  }, [ds])

  if (isLoading) {
    return <p className="text-sm text-ink-subtle">Загружаем датасет…</p>
  }
  if (isError || !ds) {
    return (
      <div className="card p-6">
        <p className="text-sm text-danger">{errorMessage(error)}</p>
        <Link to={cabPath(cabPath('/app/data'))} className="mt-3 inline-block text-sm font-medium text-brand-600 hover:underline">
          ← К датасетам
        </Link>
      </div>
    )
  }

  // старый кеш/недокативший бэк могут не отдать новые поля — не падаем
  const filesDetail = ds.files_detail ?? []
  const pendingUploads = ds.pending_uploads ?? []
  const versions = ds.versions ?? []
  const badge = datasetBadge(ds)
  const acc = orderAccuracyPct(ds.model?.wmape_order_14)
  const stale = ds.model?.up_to_date === false
  const waiting = pendingUploads.filter((p) => p.status === 'scanned_clean')
  const modelVersionMark = ds.model?.dataset_version ?? null

  const onPickFile = (f: File | null) => {
    if (!f) return
    const err = validateUploadClientSide(f)
    if (err) { setUploadErr(err); return }
    setUploadErr(null)
    upload.mutate(f)
  }

  return (
    <div>
      {/* хлебные крошки */}
      <nav className="text-sm text-ink-subtle">
        <Link to={cabPath(cabPath('/app/data'))} className="hover:text-ink hover:underline">Датасеты</Link>
        <span className="mx-1.5">/</span>
        <span className="font-medium text-ink">{ds.name}</span>
      </nav>

      {/* шапка */}
      <div className="mt-2 flex flex-wrap items-end justify-between gap-3">
        <div>
          <h2 className="text-2xl font-bold text-ink">{ds.name}</h2>
          <p className="mt-1 text-sm text-ink-muted">
            {fmtPeriod(ds.date_min, ds.date_max)}
            {' · '}{ds.files} файлов · {fmtInt(ds.row_count)} строк
            {' · '}версия данных v{ds.current_version}
          </p>
        </div>
        <div className="flex gap-2">
          <button
            type="button"
            className="btn-secondary text-sm"
            disabled={upload.isPending}
            onClick={() => fileInput.current?.click()}
          >
            {uploadPct != null ? `Загрузка… ${uploadPct}%` : 'Доложить CSV'}
          </button>
          <button
            type="button"
            className="btn-primary text-sm"
            disabled={train.isPending || ds.current_version < 1}
            onClick={() => train.mutate()}
          >
            Обучить модель
          </button>
        </div>
      </div>
      <input
        ref={fileInput}
        type="file"
        accept={ACCEPT_ATTRIBUTE}
        className="hidden"
        onChange={(e) => {
          onPickFile(e.target.files?.[0] ?? null)
          e.target.value = ''
        }}
      />
      {uploadErr && <p className="mt-2 text-sm text-danger">{uploadErr}</p>}
      {upload.isError && (
        <p className="mt-2 text-sm text-danger">{errorMessage(upload.error)}</p>
      )}

      <div className="mt-6 grid gap-6 lg:grid-cols-[minmax(0,1fr)_320px]">
        {/* ── файлы ── */}
        <div className="card self-start">
          <div className="flex items-center justify-between px-5 pt-4">
            <h3 className="font-semibold text-ink">Файлы датасета</h3>
            <span className="text-xs text-ink-subtle">
              новый файл заменяет пересекающиеся дни
            </span>
          </div>
          <div className="mt-2 overflow-x-auto">
            <table className="w-full min-w-[640px] text-sm">
              <thead>
                <tr className="border-b border-surface-border text-left text-xs uppercase tracking-wide text-ink-subtle">
                  <th className="px-5 py-3 font-medium">Файл</th>
                  <th className="px-5 py-3 font-medium">Период</th>
                  <th className="px-5 py-3 font-medium">Строк</th>
                  <th className="px-5 py-3 font-medium">Слияние</th>
                  <th className="px-5 py-3 font-medium">Статус</th>
                </tr>
              </thead>
              <tbody>
                {pendingUploads.map((p) => (
                  <tr key={p.upload_id}
                      className="border-b border-surface-border/60">
                    <td className="px-5 py-3.5 font-medium text-ink">{p.filename}</td>
                    <td className="px-5 py-3.5 text-ink-muted">
                      {fmtPeriod(p.date_min, p.date_max)}
                    </td>
                    <td className="px-5 py-3.5 text-ink-muted">{fmtInt(p.row_count)}</td>
                    <td className="px-5 py-3.5 text-ink-subtle">—</td>
                    <td className="px-5 py-3.5">
                      <span className={FILE_BADGE[p.status]?.cls ?? 'badge badge-neutral'}>
                        {FILE_BADGE[p.status]?.label ?? p.status}
                      </span>
                    </td>
                  </tr>
                ))}
                {[...filesDetail].reverse().map((f) => (
                  <tr key={f.upload_id}
                      className="border-b border-surface-border/60 last:border-0">
                    <td className="px-5 py-3.5 font-medium text-ink">
                      {f.filename ?? '(файл удалён)'}
                    </td>
                    <td className="px-5 py-3.5 text-ink-muted">
                      {fmtPeriod(f.date_min, f.date_max)}
                    </td>
                    <td className="px-5 py-3.5 text-ink-muted">{fmtInt(f.row_count)}</td>
                    <td className="px-5 py-3.5 text-ink-muted">
                      {mergeCell(f.merge_added, f.merge_replaced)}
                    </td>
                    <td className="px-5 py-3.5">
                      <span className={FILE_BADGE[f.status]?.cls ?? 'badge badge-neutral'}>
                        {FILE_BADGE[f.status]?.label ?? f.status}
                      </span>
                    </td>
                  </tr>
                ))}
                {filesDetail.length === 0 && pendingUploads.length === 0 && (
                  <tr>
                    <td colSpan={5} className="px-5 py-8 text-center text-ink-subtle">
                      В датасете пока нет файлов — нажмите «Доложить CSV»
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
          {waiting.length > 0 && (
            <div className="border-t border-surface-border px-5 py-3 text-sm text-ink-muted">
              Файл «{waiting[0].filename}» просканирован и ждёт вашей команды —{' '}
              <button
                type="button"
                className="font-medium text-brand-600 hover:underline"
                disabled={prepare.isPending}
                onClick={() => prepare.mutate(waiting[0].upload_id)}
              >
                Подготовить
              </button>
            </div>
          )}
        </div>

        {/* ── сайдбар ── */}
        <div className="space-y-6">
          <div className="card p-5">
            <div className="flex items-center justify-between gap-3">
              <h3 className="font-semibold text-ink">Модель</h3>
              <span className={badge.cls}>{badge.label}</span>
            </div>
            {ds.model ? (
              <div className="mt-3 space-y-1.5 text-sm text-ink-muted">
                <p>
                  Обучена: <span className="font-semibold text-ink">{fmtDate(ds.model.trained_at)}</span>
                  {ds.model.dataset_version != null && (
                    <> на версии <span className="font-semibold text-ink">v{ds.model.dataset_version}</span></>
                  )}
                </p>
                <p>
                  Точность для заказа (14 дн):{' '}
                  <span className="font-semibold text-ink">
                    {acc == null ? '—' : `${acc}%`}
                  </span>
                </p>
                {ds.model.improvement_vs_naive != null && (
                  <p>
                    Точнее наивного прогноза на{' '}
                    <span className="font-semibold text-ink">
                      {Math.round(ds.model.improvement_vs_naive * 100)}%
                    </span>
                  </p>
                )}
              </div>
            ) : (
              <p className="mt-3 text-sm text-ink-muted">
                Модель ещё не обучена — доложите данные и запустите обучение.
              </p>
            )}
            {(stale || !ds.model) && ds.current_version >= 1 && (
              <>
                <div className="mt-4 rounded-md bg-brand-50 p-3 text-sm text-ink-muted">
                  {stale
                    ? `Версия данных v${ds.current_version} новее модели. Обучите модель, чтобы прогнозы учли новые данные.`
                    : 'Данные готовы — обучите модель, чтобы получить прогнозы и автозаказ.'}
                </div>
                <button
                  type="button"
                  className="btn-primary mt-3 w-full text-sm"
                  disabled={train.isPending}
                  onClick={() => train.mutate()}
                >
                  Обучить модель на v{ds.current_version}
                </button>
              </>
            )}
            {trainNote && (
              <p className="mt-3 text-sm text-ink-muted">{trainNote}</p>
            )}
          </div>

          <div className="card p-5">
            <h3 className="font-semibold text-ink">Версии данных</h3>
            <ul className="mt-3 space-y-2.5">
              {versions.map((v) => (
                <li key={v.version} className="flex items-baseline justify-between gap-2 text-sm">
                  <span className="min-w-0 text-ink-muted">
                    <span className="font-semibold text-ink">v{v.version}</span>{' '}
                    {versionLine(v, fileNames)}
                    {modelVersionMark === v.version && (
                      <span className="badge badge-neutral ml-2">модель</span>
                    )}
                  </span>
                  <span className="shrink-0 text-xs text-ink-subtle">
                    {fmtDate(v.created_at).slice(0, 5)}
                  </span>
                </li>
              ))}
              {versions.length === 0 && (
                <li className="text-sm text-ink-subtle">Версий пока нет</li>
              )}
            </ul>
          </div>
        </div>
      </div>

      {/* история этого датасета — время последней загрузки для контекста */}
      {pendingUploads.length > 0 && (
        <p className="mt-4 text-xs text-ink-subtle">
          Последняя загрузка: {fmtDateTime(pendingUploads[pendingUploads.length - 1].created_at)}
        </p>
      )}
    </div>
  )
}
