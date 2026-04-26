// src/features/plans/upsell.tsx
//
// Re-usable upsell primitives. Shared aesthetic: warm cream paper (NOT grey),
// antique gold for accents, editorial italics for voice. Lock states feel
// like a premium preview, not a disabled widget.
//
//   <LockOverlay plan="start" reason="… для точных настроек">{locked content}</LockOverlay>
//   <QuotaMeter used={23} max={30} label="SKU" />
//   <UpgradeTrigger variant="quota-hit" onDismiss={…} />
//   <PlanGateBadge required="business" />
import { Link } from 'react-router-dom'
import { useState } from 'react'

import type { PlanId } from './api'

// ── Shared copy ──────────────────────────────────────────────────────────

const PLAN_LABEL: Record<PlanId, string> = {
  free:     'Free',
  start:    'Start',
  business: 'Business',
}
const PLAN_MODEL: Record<PlanId, string> = {
  free:     'Notus',
  start:    'Aether',
  business: 'Chronos',
}

// ══════════════════════════════════════════════════════════════════════════
//  LockOverlay — premium paper overlay atop gated content.
//
//  Use:
//    <LockOverlay required="start" title="Чувствительность модели"
//                 blurb="Регулируйте, как модель реагирует на недавние тренды.">
//      <ChildrenThatAreLockedBehindOverlay />
//    </LockOverlay>
//
//  Prints the locked content in the background (blurred + dimmed), then
//  lays a warm-paper panel on top with a wax-stamp seal and a gold CTA.
// ══════════════════════════════════════════════════════════════════════════

interface LockProps {
  required: PlanId
  title?:   string
  blurb?:   string
  children?: React.ReactNode
  dense?:   boolean         // tighter padding for inline usage
  className?: string
}

export function LockOverlay({
  required,
  title,
  blurb,
  children,
  dense = false,
  className = '',
}: LockProps) {
  return (
    <div className={`relative ${className}`}>
      {/* Locked content underneath — rendered but blurred & muted.
          The blur comes through the paper panel as a tease. */}
      <div
        aria-hidden
        className="pointer-events-none select-none filter blur-[3px] opacity-40"
      >
        {children}
      </div>

      {/* Paper panel */}
      <div
        className={[
          'absolute inset-0 flex items-center justify-center',
          'card-paper',
          dense ? 'p-4' : 'p-6 sm:p-8',
          'animate-fade-in',
        ].join(' ')}
      >
        <div className="text-center max-w-md mx-auto">
          <div className="seal-gold mx-auto mb-5 animate-seal-in">
            {PLAN_LABEL[required]}
          </div>
          {title && (
            <div className="display-em text-brand-700 text-2xl sm:text-3xl leading-tight mb-2">
              {title}
            </div>
          )}
          {blurb && (
            <p className="text-paper-ink/80 text-[13.5px] leading-relaxed max-w-sm mx-auto">
              {blurb}
            </p>
          )}
          <div className="mt-5 flex items-center justify-center gap-3">
            <Link to="/plans" className="btn-gold">
              Открыть тариф {PLAN_LABEL[required]}
            </Link>
            <Link to="/plans" className="btn-ghost text-paper-ink">
              Сравнить
            </Link>
          </div>
          <p className="eyebrow text-paper-ink/60 mt-4">
            Модель {PLAN_MODEL[required]}
          </p>
        </div>
      </div>
    </div>
  )
}

// ══════════════════════════════════════════════════════════════════════════
//  LockTag — tiny inline lock badge for list items.
//  Used in sidebar nav and in SKU lists beyond the Free cap.
// ══════════════════════════════════════════════════════════════════════════

export function LockTag({
  required,
  compact = false,
}: {
  required: PlanId
  compact?: boolean
}) {
  return (
    <span
      title={`Доступно в тарифе ${PLAN_LABEL[required]}`}
      className={[
        'inline-flex items-center gap-1 rounded-sm',
        compact ? 'px-1 py-0.5 text-[9px]' : 'px-1.5 py-0.5 text-[10px]',
        'font-sans font-semibold uppercase tracking-[0.12em]',
        'bg-gold-50 text-gold-700 ring-1 ring-gold-100',
      ].join(' ')}
    >
      <svg
        viewBox="0 0 10 10" className="h-2.5 w-2.5"
        fill="currentColor" aria-hidden
      >
        <path d="M3 4V3a2 2 0 014 0v1h.5A.5.5 0 018 4.5v4a.5.5 0 01-.5.5h-5a.5.5 0 01-.5-.5v-4A.5.5 0 012.5 4H3zm1 0h2V3a1 1 0 00-2 0v1z"/>
      </svg>
      {compact ? PLAN_LABEL[required][0] : PLAN_LABEL[required]}
    </span>
  )
}

// ══════════════════════════════════════════════════════════════════════════
//  PlanGateBadge — for form fields and feature headers.
//  A subtler lock marker; no background, just a muted gold tick.
// ══════════════════════════════════════════════════════════════════════════

export function PlanGateBadge({ required }: { required: PlanId }) {
  return (
    <span
      className="eyebrow text-gold-600 inline-flex items-center gap-1"
      title={`Доступно в тарифе ${PLAN_LABEL[required]}`}
    >
      <span className="h-1 w-1 rounded-full bg-gold-500" />
      {PLAN_LABEL[required]} only
    </span>
  )
}

// ══════════════════════════════════════════════════════════════════════════
//  QuotaMeter — SKU usage in topbar.
//
//  Deliberately NOT a filled progress bar (too corporate). Instead: a tick
//  row reminiscent of a typewriter scale. Each tick is a SKU bucket; the
//  used portion glows brand, the remainder is neutral, and the ceiling
//  tick has a small gold dot to hint at the upgrade path.
// ══════════════════════════════════════════════════════════════════════════

export function QuotaMeter({
  used,
  max,
  label,
  href = '/plans',
}: {
  used: number
  max: number | null     // null → unlimited
  label: string
  href?: string
}) {
  if (max === null) {
    // Unlimited — show an elegant infinity glyph, no bar.
    return (
      <div className="flex items-center gap-2 text-ink-muted">
        <span className="eyebrow">{label}</span>
        <span className="font-display italic text-brand-500 text-lg leading-none">∞</span>
      </div>
    )
  }

  const pct = Math.min(100, Math.round((used / max) * 100))
  const tone =
    pct >= 95 ? 'terra' :
    pct >= 75 ? 'gold'  :
                'brand'

  const toneBg: Record<typeof tone, string> = {
    brand: 'bg-brand-500',
    gold:  'bg-gold-500',
    terra: 'bg-terra',
  }

  return (
    <Link
      to={href}
      className="group inline-flex items-center gap-3 select-none"
      title="Тариф и лимиты"
    >
      <div className="flex flex-col items-end leading-tight">
        <span className="num font-display text-brand-700 text-lg font-medium">
          {used}
          <span className="text-ink-subtle">/{max}</span>
        </span>
        <span className="eyebrow !text-[10px] !tracking-[0.16em]">{label}</span>
      </div>
      {/* Tick scale: 24 ticks, proportional, last tick is gold */}
      <div className="flex items-end gap-[2px]" aria-hidden>
        {Array.from({ length: 24 }).map((_, i) => {
          const isLast  = i === 23
          const isUsed  = (i + 1) / 24 <= used / max
          return (
            <span
              key={i}
              className={[
                'block w-[2px] rounded-full transition-all',
                isLast ? 'h-4 bg-gold-500' :
                  isUsed
                    ? `h-3 ${toneBg[tone]} group-hover:h-4`
                    : 'h-2 bg-surface-border group-hover:bg-surface-deep',
              ].join(' ')}
            />
          )
        })}
      </div>
    </Link>
  )
}

// ══════════════════════════════════════════════════════════════════════════
//  UpgradeTrigger — contextual teaser. Appears at the three planned
//  upgrade moments (first-prediction, quota-hit, save-scenario).
//  NOT a pop-up modal; it's a dismissible editorial teaser box.
// ══════════════════════════════════════════════════════════════════════════

type TriggerVariant =
  | 'first-forecast'       // "Ваш прогноз готов. Хотите настроить модель?"
  | 'quota-hit'            // "Лимит SKU почти исчерпан"
  | 'save-scenario'        // "Сохраните и автоматизируйте промо"
  | 'why-detail'           // "Узнайте, что влияет на прогноз"

const TRIGGER_COPY: Record<TriggerVariant, {
  eyebrow: string
  title:   string
  body:    string
  target:  PlanId
  cta:     string
}> = {
  'first-forecast': {
    eyebrow: '01 · первый прогноз',
    title:   'Готово. Хотите научить модель вашему бизнесу?',
    body:    'Подстройте её под праздники, сезон и акции — точность растёт в разы.',
    target:  'start',
    cta:     'Что даёт Start',
  },
  'quota-hit': {
    eyebrow: '02 · катлог растёт',
    title:   'Тариф Free вмещает до 30 позиций.',
    body:    'На Start можно прогнозировать до 1 500 SKU и экспортировать отчёты.',
    target:  'start',
    cta:     'Перейти на Start',
  },
  'save-scenario': {
    eyebrow: '03 · сценарий',
    title:   'Сохраните сценарий и автоматизируйте расчёт.',
    body:    'Планируйте промо и "что-если" по всему ассортименту — это Business.',
    target:  'business',
    cta:     'Что даёт Business',
  },
  'why-detail': {
    eyebrow: '· объяснение',
    title:   'Почему модель предсказала именно столько?',
    body:    'На Start вы увидите, какие факторы — тренд, сезон, праздник — дали этот прогноз.',
    target:  'start',
    cta:     'Узнать больше',
  },
}

export function UpgradeTrigger({
  variant,
  onDismiss,
  compact = false,
}: {
  variant: TriggerVariant
  onDismiss?: () => void
  compact?:   boolean
}) {
  const [dismissed, setDismissed] = useState(false)
  if (dismissed) return null
  const copy = TRIGGER_COPY[variant]

  return (
    <aside
      className={[
        'card-paper relative overflow-hidden animate-rise',
        compact ? 'p-4' : 'p-5 sm:p-6',
      ].join(' ')}
    >
      {/* decorative numeral in corner */}
      <span
        aria-hidden
        className="absolute -top-6 -right-2 display-em text-gold-300/50 text-[108px] leading-none pointer-events-none"
      >
        {variant.startsWith('01') ? '01' : variant === 'quota-hit' ? '02' : variant === 'save-scenario' ? '03' : '·'}
      </span>

      <div className="relative">
        <div className="chapter-num">{copy.eyebrow}</div>
        <h3 className="display-em text-brand-700 text-xl sm:text-2xl leading-snug mt-1">
          {copy.title}
        </h3>
        <p className="text-paper-ink/80 text-sm mt-2 max-w-xl">{copy.body}</p>

        <div className="mt-4 flex items-center gap-3">
          <Link to="/plans" className="btn-gold">{copy.cta}</Link>
          <button
            type="button"
            className="btn-ghost text-paper-ink/70"
            onClick={() => { setDismissed(true); onDismiss?.() }}
          >
            Не сейчас
          </button>
        </div>
      </div>
    </aside>
  )
}
