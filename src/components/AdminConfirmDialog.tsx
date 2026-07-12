// ADM-v3-9 (#394-5): модальные подтверждения консоли вместо нативных
// window.confirm/prompt (утверждённый прототип: «Стереть данные…» —
// двухшаговый confirm с вводом client_id). In-house, без библиотек.
// danger-вариант — красная зона; confirmText — typed-подтверждение.
import { useEffect, useRef, useState } from 'react'

export interface ConfirmSpec {
  title: string
  body: string
  actionLabel: string
  danger?: boolean
  /** typed-подтверждение: точная строка, которую обязан ввести оператор */
  confirmText?: string
  onConfirm: () => void
}

export default function AdminConfirmDialog({ spec, onClose }: {
  spec: ConfirmSpec | null
  onClose: () => void
}) {
  const [typed, setTyped] = useState('')
  const inputRef = useRef<HTMLInputElement>(null)

  useEffect(() => {
    setTyped('')
    if (spec) setTimeout(() => inputRef.current?.focus(), 0)
  }, [spec])

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => { if (e.key === 'Escape') onClose() }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [onClose])

  if (!spec) return null
  const ready = !spec.confirmText || typed === spec.confirmText

  return (
    <div className="fixed inset-0 z-50 bg-slate-900/45 backdrop-blur-[2px] flex items-start justify-center pt-[22vh] p-4"
         role="dialog" aria-modal="true" aria-label={spec.title}
         onClick={onClose}>
      <div className="w-full max-w-md card-paper overflow-hidden admin-pop"
           style={{ boxShadow: 'var(--admin-shadow-lg)' }}
           onClick={(e) => e.stopPropagation()}>
        <div className={`px-5 py-3 border-b font-semibold text-[13px] flex items-center gap-2 ${
          spec.danger
            ? 'border-danger/30 text-danger bg-danger-bg/40'
            : 'border-surface-border text-ink bg-surface-muted/50'}`}>
          <span aria-hidden className={`h-[7px] w-[7px] rounded-full shrink-0 ${
            spec.danger ? 'bg-danger' : 'bg-brand-500'}`} />
          {spec.title}
        </div>
        <div className="px-5 py-4 space-y-3">
          <p className="text-sm text-ink-muted whitespace-pre-line">{spec.body}</p>
          {spec.confirmText && (
            <div>
              <div className="text-xs text-ink-muted mb-1.5">
                Для подтверждения введите <span className="font-mono font-semibold text-ink">{spec.confirmText}</span>
              </div>
              <input ref={inputRef} className="input font-mono" value={typed}
                     onChange={(e) => setTyped(e.target.value)}
                     onKeyDown={(e) => {
                       if (e.key === 'Enter' && ready) { spec.onConfirm(); onClose() }
                     }} />
            </div>
          )}
        </div>
        <div className="px-5 py-3 border-t border-surface-border flex justify-end gap-2">
          <button type="button" className="btn-secondary text-sm" onClick={onClose}>
            Отмена
          </button>
          <button type="button"
                  className={`text-sm ${spec.danger ? 'btn-danger' : 'btn-primary'}`}
                  disabled={!ready}
                  onClick={() => { spec.onConfirm(); onClose() }}>
            {spec.actionLabel}
          </button>
        </div>
      </div>
    </div>
  )
}
