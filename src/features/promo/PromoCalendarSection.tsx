// #570 PC-3: секция «Календарь акций» на странице датасета.
// Подача утверждена владельцем: слоган «Прогноз знает историю продаж,
// но не знает ваших планов», явное «загрузите и прошлые акции», честный
// отчёт по строкам, применение отдельной кнопкой, «влияние — после
// следующего обучения» + кнопка «Обучить» рядом. Никаких обещаний «+X%».
import { useRef } from 'react'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import toast from 'react-hot-toast'

import { errorMessage } from '../../shared/api/client'
import { promoCalendarApi } from './api'

const MOVING = new Set(['uploaded', 'scanning', 'scanned_clean', 'processing'])

function fmtD(iso: string | null): string {
  if (!iso) return '—'
  const d = new Date(iso)
  return Number.isNaN(d.getTime())
    ? iso
    : d.toLocaleDateString('ru-RU', { day: '2-digit', month: '2-digit', year: 'numeric' })
}

export function PromoCalendarSection({ clientId, datasetId, onTrain, trainPending }: {
  clientId: string
  datasetId: string
  onTrain: () => void
  trainPending: boolean
}) {
  const qc = useQueryClient()
  const fileInput = useRef<HTMLInputElement | null>(null)

  const { data: state } = useQuery({
    queryKey: ['promo-calendar', clientId, datasetId],
    queryFn: () => promoCalendarApi.state(clientId, datasetId),
    refetchInterval: (q) =>
      q.state.data?.last_upload && MOVING.has(q.state.data.last_upload.status)
        ? 3000
        : false,
  })
  const refresh = () =>
    qc.invalidateQueries({ queryKey: ['promo-calendar', clientId, datasetId] })

  const upload = useMutation({
    mutationFn: (file: File) => promoCalendarApi.upload(clientId, datasetId, file),
    onSuccess: () => { toast.success('Календарь загружен — проверяем'); refresh() },
    onError: (e) => toast.error(errorMessage(e, 'Не удалось загрузить календарь')),
  })
  const apply = useMutation({
    mutationFn: (calendarId: string) =>
      promoCalendarApi.apply(clientId, datasetId, calendarId),
    onSuccess: () => { toast.success('Календарь применён'); refresh() },
    onError: (e) => toast.error(errorMessage(e, 'Не удалось применить календарь')),
  })
  const remove = useMutation({
    mutationFn: () => promoCalendarApi.remove(clientId, datasetId),
    onSuccess: () => { toast.success('Календарь убран'); refresh() },
    onError: (e) => toast.error(errorMessage(e, 'Не удалось убрать календарь')),
  })

  const active = state?.active ?? null
  const candidate = state?.candidate ?? null
  const moving = state?.last_upload && MOVING.has(state.last_upload.status)
  const failed = state?.last_upload?.status === 'processing_failed'
      || state?.last_upload?.status === 'infected'

  return (
    <section className="card mt-6 p-5">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h3 className="font-semibold text-ink">Календарь акций</h3>
          <p className="mt-1 max-w-2xl text-sm text-ink-muted">
            Прогноз знает историю продаж, но не знает ваших планов — загрузите
            план акций. Загрузите и прошлые акции: без них модели не на чем
            оценить их эффект.
          </p>
        </div>
        <div className="flex shrink-0 gap-2">
          <button
            type="button"
            className="btn-secondary text-sm"
            onClick={() => promoCalendarApi.downloadTemplate(clientId)
              .catch(() => toast.error('Не удалось скачать шаблон'))}
          >
            Скачать шаблон
          </button>
          <button
            type="button"
            className="btn-primary text-sm"
            disabled={upload.isPending || Boolean(moving)}
            onClick={() => fileInput.current?.click()}
          >
            {moving ? 'Проверяем…' : 'Загрузить календарь'}
          </button>
        </div>
      </div>
      <input
        ref={fileInput}
        type="file"
        accept=".csv,.xlsx"
        className="hidden"
        onChange={(e) => {
          const f = e.target.files?.[0]
          if (f) upload.mutate(f)
          e.target.value = ''
        }}
      />

      {failed && state?.last_upload && (
        <div className="mt-4 rounded-md bg-danger-bg p-3 text-sm text-danger">
          «{state.last_upload.filename}»: {state.last_upload.error_message
            ?? 'файл не прошёл проверку'}
        </div>
      )}

      {/* кандидат: честный отчёт + Применить */}
      {candidate && (
        <div className="mt-4 rounded-lg border border-brand-200 bg-brand-50 p-4">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div className="text-sm text-ink">
              <span className="font-semibold">«{candidate.filename}» проверен:</span>{' '}
              принято {candidate.report.rows_accepted} из {candidate.report.rows_total}
              {candidate.report.rows_rejected > 0 && (
                <>, отклонено {candidate.report.rows_rejected}</>
              )}
              {' · '}период {fmtD(candidate.date_min)}–{fmtD(candidate.date_max)}
            </div>
            <button
              type="button"
              className="btn-primary shrink-0 text-sm"
              disabled={apply.isPending}
              onClick={() => apply.mutate(candidate.calendar_id)}
            >
              Применить{active ? ' (заменит текущий)' : ''}
            </button>
          </div>
          {candidate.report.rejected_examples.length > 0 && (
            <ul className="mt-2 space-y-0.5 text-xs text-ink-muted">
              {candidate.report.rejected_examples.slice(0, 5).map((r) => (
                <li key={r.line}>строка {r.line}: {r.reason}</li>
              ))}
              {candidate.report.rows_rejected > 5 && (
                <li>… и ещё {candidate.report.rows_rejected - 5}</li>
              )}
            </ul>
          )}
        </div>
      )}

      {/* активный календарь */}
      {active ? (
        <div className="mt-4 flex flex-wrap items-center justify-between gap-3 text-sm">
          <div className="text-ink-muted">
            Действует: <span className="font-semibold text-ink">{active.rows_accepted}</span>{' '}
            акций, {fmtD(active.date_min)}–{fmtD(active.date_max)}
            {' · '}применён {fmtD(active.applied_at)}
          </div>
          <button
            type="button"
            className="text-sm font-medium text-ink-muted hover:text-danger"
            disabled={remove.isPending}
            onClick={() => remove.mutate()}
          >
            Убрать календарь
          </button>
        </div>
      ) : !candidate && !moving && (
        <p className="mt-4 text-sm text-ink-subtle">
          Календарь не загружен — прогноз строится только по истории продаж.
        </p>
      )}

      {(active || candidate) && (
        <div className="mt-4 flex flex-wrap items-center justify-between gap-3 rounded-md bg-surface-sunken p-3 text-sm text-ink-muted">
          <span>Календарь влияет на прогноз после следующего обучения модели.</span>
          <button
            type="button"
            className="btn-secondary shrink-0 text-sm"
            disabled={trainPending}
            onClick={onTrain}
          >
            Обучить модель
          </button>
        </div>
      )}
    </section>
  )
}
