// src/features/plans/PlanBadge.tsx
// Small pill rendering {model name} · {plan}. Colors vary per tier so the
// user can eyeball their tier without reading text.
import type { PlanId } from './api'

const STYLE: Record<PlanId, string> = {
  free:     'bg-surface-muted text-ink-muted ring-1 ring-surface-border',
  start:    'bg-accent-light/20 text-accent-dark ring-1 ring-accent-light',
  business: 'bg-brand-500 text-ink-invert ring-1 ring-brand-600',
}

export function PlanBadge({
  plan,
  modelName,
  className = '',
}: {
  plan: PlanId
  modelName: string
  className?: string
}) {
  return (
    <span
      className={[
        'inline-flex items-center gap-1.5 rounded-full px-2.5 py-1 text-xs font-medium',
        STYLE[plan],
        className,
      ].join(' ')}
      title={`Тариф: ${plan}`}
    >
      <span className="font-semibold tracking-tight">{modelName}</span>
      <span className="opacity-60">·</span>
      <span className="uppercase text-[10px] tracking-wider">{plan}</span>
    </span>
  )
}
