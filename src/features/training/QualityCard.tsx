// #232 (QW2-B5): карточка качества модели — сигнал доверия для клиента.
// Данные — из последнего ПРОМОУТНУТОГО рана (артефакт сервится, #268).
// Формулировки честные (#181): сравнение с сезонным наивным прогнозом
// (та же неделя назад) — единственный бейзлайн, который клиент может
// проверить сам; никакого overclaiming, «хуже наивного» показываем прямо.
import { useMemo } from 'react'
import { Link } from 'react-router-dom'
import { useQuery } from '@tanstack/react-query'

import { trainingApi } from './api'

export function QualityCard({ clientId }: { clientId: string }) {
  const { data } = useQuery({
    queryKey: ['training-runs', clientId, 'quality-card'],
    queryFn: () => trainingApi.listRuns(clientId),
    meta: { silent: true },
  })

  const run = useMemo(
    () => data?.runs?.find(
      (r) => r.status === 'finished' && r.model_path && r.wmape != null),
    [data],
  )

  if (!run) return null                       // нет промоутнутой модели — нет карточки

  const ageDays = run.ended_at
    ? Math.floor((Date.now() - new Date(run.ended_at).getTime()) / 86_400_000)
    : null
  const vsNaive = run.mase_seasonal            // <1 = лучше наивного
  const accuracyPct = run.wmape != null ? Math.max(0, (1 - run.wmape) * 100) : null

  return (
    <div className="card-paper p-5">
      <div className="flex items-baseline justify-between">
        <h3 className="text-sm font-semibold text-ink">Качество модели</h3>
        {ageDays != null && (
          <span className={ageDays > 45 ? 'badge-warn' : 'badge-neutral'}>
            обучена {ageDays === 0 ? 'сегодня' : `${ageDays} дн. назад`}
          </span>
        )}
      </div>
      <dl className="mt-4 grid grid-cols-2 gap-4">
        <div>
          <dt className="text-xs text-ink-muted">Точность прогноза</dt>
          <dd className="text-2xl font-semibold tracking-tight">
            {accuracyPct != null ? `${accuracyPct.toFixed(0)}%` : '—'}
          </dd>
          <dd className="text-[11px] text-ink-faint">
            доля объёма, предсказанная верно (100% − WMAPE)
          </dd>
        </div>
        <div>
          <dt className="text-xs text-ink-muted">Против наивного прогноза</dt>
          <dd className="text-2xl font-semibold tracking-tight">
            {vsNaive == null ? '—'
              : vsNaive < 1 ? `на ${((1 - vsNaive) * 100).toFixed(0)}% точнее`
              : 'не точнее'}
          </dd>
          <dd className="text-[11px] text-ink-faint">
            наивный = «как в тот же день неделю назад»
          </dd>
        </div>
      </dl>
      {run.gate_passed === false && (
        <p className="mt-3 text-xs text-ink-muted">
          Последняя модель прошла с предупреждением контроля качества —
          показатели могут быть скромнее обычного.
        </p>
      )}
      {run.eval_coverage != null && (
        <p className="mt-3 text-[11px] text-ink-faint">
          Методика оценки v2 (июль 2026): покрытие 100% дней окна.{' '}
          <Link
            to="/help/a/metodika-ocenki-tochnosti"
            className="underline underline-offset-2 hover:text-ink"
          >
            Как мы считаем точность
          </Link>
        </p>
      )}
    </div>
  )
}
