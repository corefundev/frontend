// ADM-v3-3 (#388) / ADM-v3-9 (#394): вкладка «Качество» карточки —
// ДОСЛОВНЫЙ порт quality-grid из утверждённого прототипа (без recharts):
//   • слева (1.6fr) ОДИН WMAPE-график прототипной SVG-графикой: три
//     горизонтальные сетки, area-заливка brand 9%, линия 2px, конечная
//     точка r4 с обводкой цветом поверхности; под графиком
//     «<первое> · <месяц>» и «текущая <последнее>» (mono 11px);
//   • справа (1fr) «История gate-вердиктов»: чип прошла/блок + run-id +
//     «· чемпион» + WMAPE + относительное время; строка текущего
//     чемпиона подсвечена brand-bg.
// Линия = только promoted-чемпионы (реально служившее качество);
// вердикты — все finished. Данные реальные — никаких иллюстративных.
import { useMemo } from 'react'

export interface TrendRun {
  run_id: string
  status: string
  ended_at: string | null
  wmape: number | null
  mase: number | null
  gate_passed: boolean | null
  model_path: string | null
}

const MONTHS_RU = ['январь', 'февраль', 'март', 'апрель', 'май', 'июнь',
  'июль', 'август', 'сентябрь', 'октябрь', 'ноябрь', 'декабрь']

function relWhen(iso: string): string {
  const d = Math.floor((Date.now() - new Date(iso).getTime()) / 86_400_000)
  if (d <= 0) return 'сегодня'
  if (d === 1) return 'вчера'
  if (d < 30) return `${d} дн`
  return new Date(iso).toLocaleDateString('ru-RU')
}

// Прототипный SVG-график: viewBox 0 0 560 150, preserveAspectRatio none,
// сетки y=30/75/120 (сплошные 1px цветом line, как в прототипе)
function ProtoChart({ points }: { points: { v: number; at: string }[] }) {
  const vs = points.map((p) => p.v)
  const min = Math.min(...vs)
  const max = Math.max(...vs)
  const span = max - min || min || 1
  const xy = vs.map((v, i) => [
    (i / (vs.length - 1)) * 560,
    130 - ((v - min) / span) * 110,   // рабочая зона 20..130, как в прототипе
  ] as const)
  const line = xy.map(([x, y]) => `${x.toFixed(1)},${y.toFixed(1)}`).join(' ')
  const area = `${line} 560,150 0,150`
  const last = xy[xy.length - 1]
  const firstAt = new Date(points[0].at)
  return (
    <div>
      <svg width="100%" height="150" viewBox="0 0 560 150" preserveAspectRatio="none"
           role="img"
           aria-label={`Тренд WMAPE: от ${vs[0].toFixed(3)} к ${vs[vs.length - 1].toFixed(3)}`}>
        {[30, 75, 120].map((y) => (
          <line key={y} x1="0" y1={y} x2="560" y2={y}
                stroke="rgb(var(--surface-border))" strokeWidth="1" />
        ))}
        <polygon points={area} fill="var(--admin-brand)" opacity="0.09" />
        <polyline points={line} fill="none" stroke="var(--admin-brand)"
                  strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
        <circle cx={last[0]} cy={last[1]} r="4" fill="var(--admin-brand)"
                stroke="rgb(var(--surface-raised))" strokeWidth="2" />
      </svg>
      <div className="flex justify-between font-mono text-[11px] text-ink-subtle tabular-nums">
        <span>{vs[0].toFixed(2)} · {MONTHS_RU[firstAt.getMonth()]}</span>
        <span>текущая {vs[vs.length - 1].toFixed(3)}</span>
      </div>
    </div>
  )
}

export default function QualityTrendSection({ runs, bare = false }: {
  runs: TrendRun[]; bare?: boolean
}) {
  const { chart, verdicts, championId } = useMemo(() => {
    const championId = runs.find(
      (r) => r.status === 'finished' && r.model_path != null)?.run_id ?? null
    // линия — promoted-чемпионы, хронологически, последние 12 (прототип)
    const chart = runs
      .filter((r) => r.status === 'finished' && r.ended_at != null
        && r.model_path != null && r.wmape != null)
      .slice()
      .reverse()
      .slice(-12)
      .map((r) => ({ v: r.wmape as number, at: r.ended_at as string }))
    // список вердиктов — свежие сверху, как в прототипе
    const verdicts = runs
      .filter((r) => r.status === 'finished' && r.ended_at != null)
      .slice(0, 6)
    return { chart, verdicts, championId }
  }, [runs])

  return (
    <section className={bare ? '' : 'card-paper p-5'}>
      {!verdicts.length ? (
        <div className="text-sm text-ink-muted">Завершённых тренировок ещё нет.</div>
      ) : (
        <div className="grid grid-cols-[1.6fr_1fr] gap-3 items-start">
          <div>
            <p className="m-0 mb-2 text-xs font-semibold text-ink-muted">
              WMAPE по тренировкам · {chart.length} последних
            </p>
            {chart.length >= 2 ? (
              <ProtoChart points={chart} />
            ) : (
              <div className="text-sm text-ink-muted">
                Для линии нужно ≥ 2 promoted-обучений — gate-блоки и
                эксперименты в линию не входят (они в списке справа).
              </div>
            )}
          </div>
          <div>
            <p className="m-0 mb-2 text-xs font-semibold text-ink-muted">
              История gate-вердиктов
            </p>
            <ul className="m-0 p-0 list-none rounded-lg ring-1 ring-surface-border overflow-hidden divide-y divide-surface-border">
              {verdicts.map((r) => {
                const isChampion = r.run_id === championId
                return (
                  <li key={r.run_id}
                      className="flex items-center gap-2.5 px-3 py-2 text-[12.5px]"
                      style={isChampion ? { background: 'var(--admin-brand-bg)' } : undefined}>
                    {r.gate_passed === false && !r.model_path
                      ? <span className="badge-warn">блок</span>
                      : r.gate_passed === false
                        ? <span className="badge-warn">fail (перв.)</span>
                        : <span className="badge-success">прошла</span>}
                    <span className="font-mono text-xs">run {r.run_id.slice(0, 6)}</span>
                    {isChampion && <span className="text-[11.5px]">· чемпион</span>}
                    {r.wmape != null && (
                      <span className="font-mono text-[11px] text-ink-subtle tabular-nums">
                        {r.wmape.toFixed(3)}
                      </span>
                    )}
                    <span className="ml-auto text-[11.5px] text-ink-subtle whitespace-nowrap">
                      {relWhen(r.ended_at as string)}
                    </span>
                  </li>
                )
              })}
            </ul>
          </div>
        </div>
      )}
    </section>
  )
}
