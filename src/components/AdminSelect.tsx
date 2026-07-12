// Консольный выпадающий список вместо нативного <select> — нативное меню
// рисует ОС (macOS-стиль), выбивается из стилистики консоли. In-house,
// без библиотек: кнопка-триггер в стиле .input + всплывающий листбокс
// card-paper с admin-pop. Клавиатура: ↑/↓/Enter/Escape; клик-вне закрывает.
import { useEffect, useRef, useState } from 'react'

export interface AdminSelectOption {
  value: string
  label: string
}

export default function AdminSelect({ value, onChange, options, className = '', ariaLabel }: {
  value: string
  onChange: (value: string) => void
  options: AdminSelectOption[]
  className?: string
  ariaLabel?: string
}) {
  const [open, setOpen] = useState(false)
  const [active, setActive] = useState(-1)
  const rootRef = useRef<HTMLDivElement>(null)
  const listRef = useRef<HTMLDivElement>(null)
  const current = options.find((o) => o.value === value)

  useEffect(() => {
    if (!open) return
    const onDown = (e: MouseEvent) => {
      if (rootRef.current && !rootRef.current.contains(e.target as Node)) setOpen(false)
    }
    document.addEventListener('mousedown', onDown)
    return () => document.removeEventListener('mousedown', onDown)
  }, [open])

  useEffect(() => {
    if (open) setActive(options.findIndex((o) => o.value === value))
  }, [open, options, value])

  useEffect(() => {
    if (open && active >= 0) {
      listRef.current?.children[active]?.scrollIntoView({ block: 'nearest' })
    }
  }, [open, active])

  const pick = (v: string) => { onChange(v); setOpen(false) }

  const onKey = (e: React.KeyboardEvent) => {
    if (e.key === 'Escape') { setOpen(false); return }
    if (!open && (e.key === 'Enter' || e.key === ' ' || e.key === 'ArrowDown')) {
      e.preventDefault(); setOpen(true); return
    }
    if (!open) return
    if (e.key === 'ArrowDown') { e.preventDefault(); setActive((a) => Math.min(a + 1, options.length - 1)) }
    if (e.key === 'ArrowUp')   { e.preventDefault(); setActive((a) => Math.max(a - 1, 0)) }
    if (e.key === 'Enter' && active >= 0) { e.preventDefault(); pick(options[active].value) }
  }

  return (
    <div ref={rootRef} className={`relative ${className}`}>
      <button type="button"
              className="input w-full flex items-center justify-between gap-2 text-left cursor-pointer"
              aria-haspopup="listbox" aria-expanded={open} aria-label={ariaLabel}
              onClick={() => setOpen((o) => !o)} onKeyDown={onKey}>
        <span className="truncate">{current?.label ?? '—'}</span>
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"
             strokeLinecap="round" strokeLinejoin="round"
             className={`h-3.5 w-3.5 shrink-0 text-ink-subtle transition-transform ${open ? 'rotate-180' : ''}`}
             aria-hidden>
          <path d="M6 9l6 6 6-6" />
        </svg>
      </button>
      {open && (
        <div ref={listRef} role="listbox" aria-label={ariaLabel}
             className="absolute z-30 top-full mt-1 left-0 min-w-full card-paper overflow-y-auto max-h-64 py-1 admin-pop"
             style={{ boxShadow: 'var(--admin-shadow-lg)' }}>
          {options.map((o, i) => (
            <button key={o.value} type="button" role="option"
                    aria-selected={o.value === value}
                    className={`w-full flex items-center gap-2 px-3 py-1.5 text-left text-[13px] whitespace-nowrap transition-colors ${
                      i === active ? 'bg-surface-muted' : ''} ${
                      o.value === value ? 'font-semibold text-ink' : 'text-ink-muted'} hover:bg-surface-muted`}
                    onMouseEnter={() => setActive(i)}
                    onClick={() => pick(o.value)}>
              <span className={`h-[6px] w-[6px] rounded-full shrink-0 ${
                o.value === value ? 'bg-brand-500' : 'bg-transparent'}`} aria-hidden />
              {o.label}
            </button>
          ))}
        </div>
      )}
    </div>
  )
}
