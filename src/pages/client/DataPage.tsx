// DS-2 (#467) — раздел «Данные»: датасеты + история подготовок.
// Порт утверждённого прототипа docs/design/cabinet-v2/screen_data.png
// (backend repo). Правила #320 сохранены: скан → КНОПКА «Подготовить» →
// processed; после подготовки нацеленный файл сам вливается в датасет.
import { useMemo, useState } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'

import { useAuthStore } from '../../features/auth/store'
import {
  datasetsApi,
  orderAccuracyPct,
  type DatasetView,
} from '../../features/datasets/api'
import {
  datasetBadge,
  fmtDate,
  fmtDateTime,
  fmtInt,
  fmtPeriod,
  plural,
} from '../../features/datasets/format'
import {
  safeUploadError,
  uploadsApi,
  type UploadRecord,
  type UploadStatus,
} from '../../features/uploads/api'
import { errorMessage } from '../../shared/api/client'
import { cabPath } from '../../shared/hostRouting'

// ── история подготовок: статусы загрузок ─────────────────────────────────

const UPLOAD_BADGE: Record<UploadStatus, { label: string; cls: string }> = {
  uploaded:          { label: 'Загружен',          cls: 'badge badge-neutral' },
  scanning:          { label: 'Проверка…',         cls: 'badge badge-neutral' },
  scanned_clean:     { label: 'Ждёт подготовки',   cls: 'badge badge-neutral' },
  infected:          { label: 'Отклонён проверкой', cls: 'badge badge-danger' },
  processing:        { label: 'Подготовка…',       cls: 'badge badge-info' },
  processed:         { label: 'Обработан',         cls: 'badge badge-success' },
  processing_failed: { label: 'Ошибка обработки',  cls: 'badge badge-danger' },
}

const MOVING_STATES: UploadStatus[] = ['uploaded', 'scanning', 'processing']

// Прототип: бейдж ошибки несёт ПРИЧИНУ («Ошибка: нет колонки даты»).
// Причина проходит санитайзер (никаких трейсбеков) и укорачивается —
// полный текст в title.
function uploadStatusLabel(u: UploadRecord): string {
  if (u.status !== 'processing_failed') return UPLOAD_BADGE[u.status].label
  const reason = safeUploadError(u.error_message)
  const short = reason.length > 36 ? `${reason.slice(0, 35)}…` : reason
  return `Ошибка: ${short}`
}

// ── создание датасета ────────────────────────────────────────────────────

function CreateDatasetModal({ onClose }: { onClose: () => void }) {
  const clientId = useAuthStore((s) => s.clientId)!
  const qc = useQueryClient()
  const navigate = useNavigate()
  const [name, setName] = useState('')
  const create = useMutation({
    mutationFn: () => datasetsApi.create(clientId, name.trim()),
    onSuccess: (ds) => {
      qc.invalidateQueries({ queryKey: ['datasets', clientId] })
      onClose()
      navigate(cabPath(`/app/data/${ds.dataset_id}`))
    },
  })
  return (
    <div className="fixed inset-0 z-50 grid place-items-center bg-ink/40 p-4"
         onClick={onClose}>
      <div className="card w-full max-w-md p-6"
           onClick={(e) => e.stopPropagation()}>
        <h2 className="text-lg font-semibold text-ink">Новый датасет</h2>
        <p className="mt-1 text-sm text-ink-muted">
          Например, отдельный магазин или склад — у него будут свои файлы,
          своя модель и свои прогнозы.
        </p>
        <input
          autoFocus
          value={name}
          onChange={(e) => setName(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === 'Enter' && name.trim()) create.mutate()
          }}
          maxLength={80}
          placeholder="Название, например «Магазин на Ленина»"
          className="mt-4 w-full rounded-md border border-surface-border bg-surface px-3 py-2 text-sm text-ink outline-none focus:border-brand-500"
        />
        {create.isError && (
          <p className="mt-2 text-sm text-danger">{errorMessage(create.error)}</p>
        )}
        <div className="mt-5 flex justify-end gap-2">
          <button type="button" className="btn-ghost text-sm" onClick={onClose}>
            Отмена
          </button>
          <button
            type="button"
            className="btn-primary text-sm"
            disabled={!name.trim() || create.isPending}
            onClick={() => create.mutate()}
          >
            Создать датасет
          </button>
        </div>
      </div>
    </div>
  )
}

// ── карточка датасета ────────────────────────────────────────────────────

function DatasetCard({ ds }: { ds: DatasetView }) {
  const navigate = useNavigate()
  const badge = datasetBadge(ds)
  const acc = orderAccuracyPct(ds.model?.wmape_order_14)
  const stale = ds.model?.up_to_date === false
  const needsTraining = stale || (!ds.model && ds.current_version >= 1)
  const cta = needsTraining
    ? { label: 'Обучить модель', cls: 'btn-primary', to: cabPath(`/app/data/${ds.dataset_id}?train=1`) }
    : { label: 'Доложить данные', cls: 'btn-secondary', to: cabPath(`/app/data/${ds.dataset_id}?upload=1`) }
  return (
    <div
      role="link"
      tabIndex={0}
      onClick={() => navigate(cabPath(`/app/data/${ds.dataset_id}`))}
      onKeyDown={(e) => {
        if (e.key === 'Enter') navigate(cabPath(`/app/data/${ds.dataset_id}`))
      }}
      className="card cursor-pointer p-5 text-left transition-shadow hover:shadow-floating"
    >
      <div className="flex items-start justify-between gap-3">
        <h3 className="font-semibold text-ink">{ds.name}</h3>
        <span className={badge.cls}>{badge.label}</span>
      </div>
      <p className="mt-2 text-sm text-ink-muted">
        {fmtPeriod(ds.date_min, ds.date_max)}
        {' · '}{ds.files} {plural(ds.files, 'файл', 'файла', 'файлов')}
        {' · '}{fmtInt(ds.row_count)} строк
      </p>
      <p className="mt-1 text-xs text-ink-subtle">
        Версия данных v{ds.current_version}
        {ds.model?.dataset_version != null && (
          <> · модель обучена на v{ds.model.dataset_version}
            {ds.model.trained_at && <> · {fmtDate(ds.model.trained_at)}</>}
          </>
        )}
      </p>
      <div className="mt-4 flex items-end justify-between gap-3">
        <div className="text-sm text-ink-muted">
          Точность для заказа (14 дн):{' '}
          <span className="font-semibold text-ink">
            {acc == null ? '—' : `${acc}%`}
          </span>
        </div>
        <Link
          to={cta.to}
          onClick={(e) => e.stopPropagation()}
          className={`${cta.cls} shrink-0 text-sm`}
        >
          {cta.label}
        </Link>
      </div>
    </div>
  )
}

// ── страница ─────────────────────────────────────────────────────────────

export default function DataPage() {
  const clientId = useAuthStore((s) => s.clientId)!
  const qc = useQueryClient()
  const [showCreate, setShowCreate] = useState(false)
  const [dsFilter, setDsFilter] = useState<string>('all')
  const [stFilter, setStFilter] = useState<string>('all')

  const { data: datasets = [], isLoading: dsLoading } = useQuery({
    queryKey: ['datasets', clientId],
    queryFn: () => datasetsApi.list(clientId),
  })

  const { data: uploads = [] } = useQuery({
    queryKey: ['uploads', clientId],
    queryFn: () => uploadsApi.list(clientId),
    refetchInterval: (q) =>
      (q.state.data ?? []).some((u) => MOVING_STATES.includes(u.status))
        ? 3000
        : false,
  })

  const dsName = useMemo(() => {
    const m = new Map<string, string>()
    datasets.forEach((d) => m.set(d.dataset_id, d.name))
    return m
  }, [datasets])

  const prepare = useMutation({
    mutationFn: (uploadId: string) => uploadsApi.prepare(clientId, uploadId),
    onSuccess: () =>
      qc.invalidateQueries({ queryKey: ['uploads', clientId] }),
  })

  const history = uploads.filter((u) => {
    if (dsFilter !== 'all' && (u.dataset_id ?? '') !== dsFilter) return false
    if (stFilter === 'ok' && u.status !== 'processed') return false
    if (stFilter === 'error'
        && u.status !== 'processing_failed' && u.status !== 'infected') {
      return false
    }
    if (stFilter === 'waiting' && u.status !== 'scanned_clean') return false
    return true
  })

  return (
    <div className="space-y-10">
      {/* ── Датасеты ── */}
      <section>
        <div className="flex flex-wrap items-end justify-between gap-3">
          <div>
            <h2 className="text-xl font-semibold text-ink">Датасеты</h2>
            <p className="mt-1 text-sm text-ink-muted">
              Каждый датасет — своя история продаж, своя модель и свои прогнозы
            </p>
          </div>
          <button
            type="button"
            className="btn-primary text-sm"
            onClick={() => setShowCreate(true)}
          >
            + Создать датасет
          </button>
        </div>

        <div className="mt-5 grid gap-4 md:grid-cols-2 xl:grid-cols-3">
          {datasets.map((ds) => (
            <DatasetCard key={ds.dataset_id} ds={ds} />
          ))}
          <button
            type="button"
            onClick={() => setShowCreate(true)}
            className="grid min-h-[172px] place-items-center rounded-lg border border-dashed border-surface-border text-center transition-colors hover:border-brand-500"
          >
            <span>
              <span className="block text-2xl text-ink-subtle">+</span>
              <span className="mt-1 block text-sm font-medium text-ink-muted">
                Новый датасет
              </span>
              <span className="mt-0.5 block text-xs text-ink-subtle">
                например, отдельный магазин или склад
              </span>
            </span>
          </button>
        </div>
        {dsLoading && (
          <p className="mt-3 text-sm text-ink-subtle">Загружаем датасеты…</p>
        )}
      </section>

      {/* ── История подготовок ── */}
      <section>
        <div className="flex flex-wrap items-center justify-between gap-3">
          <h2 className="text-xl font-semibold text-ink">История подготовок</h2>
          <div className="flex gap-2">
            <select
              value={dsFilter}
              onChange={(e) => setDsFilter(e.target.value)}
              className="rounded-md border border-surface-border bg-surface-raised px-3 py-1.5 text-sm text-ink"
            >
              <option value="all">Все датасеты</option>
              {datasets.map((d) => (
                <option key={d.dataset_id} value={d.dataset_id}>{d.name}</option>
              ))}
            </select>
            <select
              value={stFilter}
              onChange={(e) => setStFilter(e.target.value)}
              className="rounded-md border border-surface-border bg-surface-raised px-3 py-1.5 text-sm text-ink"
            >
              <option value="all">Любой статус</option>
              <option value="ok">Обработан</option>
              <option value="waiting">Ждёт подготовки</option>
              <option value="error">Ошибка</option>
            </select>
          </div>
        </div>

        <div className="card mt-4 overflow-x-auto">
          <table className="w-full min-w-[720px] text-sm">
            <thead>
              <tr className="border-b border-surface-border text-left text-xs uppercase tracking-wide text-ink-subtle">
                <th className="px-5 py-3 font-medium">Файл</th>
                <th className="px-5 py-3 font-medium">Датасет</th>
                <th className="px-5 py-3 font-medium">Период данных</th>
                <th className="px-5 py-3 font-medium">Строк</th>
                <th className="px-5 py-3 font-medium">Статус</th>
                <th className="px-5 py-3 font-medium">Загружен</th>
              </tr>
            </thead>
            <tbody>
              {history.map((u: UploadRecord) => (
                <tr key={u.upload_id}
                    className="border-b border-surface-border/60 last:border-0">
                  <td className="px-5 py-3.5 font-medium text-ink">{u.filename}</td>
                  <td className="px-5 py-3.5 text-ink-muted">
                    {u.dataset_id
                      ? (dsName.get(u.dataset_id) ?? '—')
                      : '—'}
                  </td>
                  <td className="px-5 py-3.5 text-ink-muted">
                    {/* период данных загрузки бэк ещё не отдаёт (#467 хвост) */}
                    —
                  </td>
                  <td className="px-5 py-3.5 text-ink-muted">{fmtInt(u.row_count)}</td>
                  <td className="px-5 py-3.5">
                    <span
                      className={UPLOAD_BADGE[u.status].cls}
                      title={u.status === 'processing_failed'
                        ? safeUploadError(u.error_message) : undefined}
                    >
                      {uploadStatusLabel(u)}
                    </span>
                    {u.status === 'scanned_clean' && (
                      <button
                        type="button"
                        className="ml-3 text-sm font-medium text-brand-600 hover:underline"
                        disabled={prepare.isPending}
                        onClick={() => prepare.mutate(u.upload_id)}
                      >
                        Подготовить
                      </button>
                    )}
                  </td>
                  <td className="px-5 py-3.5 text-ink-muted">{fmtDateTime(u.created_at)}</td>
                </tr>
              ))}
              {history.length === 0 && (
                <tr>
                  <td colSpan={6} className="px-5 py-8 text-center text-ink-subtle">
                    Пока нет загрузок — создайте датасет и доложите в него CSV
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </section>

      {showCreate && <CreateDatasetModal onClose={() => setShowCreate(false)} />}
    </div>
  )
}
