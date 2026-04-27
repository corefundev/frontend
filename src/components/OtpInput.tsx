// src/components/OtpInput.tsx
//
// Six-cell numeric OTP input. Behaviour matches the iOS / Stripe / Claude
// pattern that users now expect:
//
//   • Type a digit       → focus advances to next cell
//   • Backspace empty    → focus retreats and clears previous
//   • Paste 6 digits     → fills all six instantly
//   • inputmode=numeric  → mobile shows the digit pad
//   • autocomplete=one-time-code → iOS/macOS surface SMS/email-pulled code
//
// Only digits 0–9 accepted; everything else is silently dropped.

import { useEffect, useRef, useState } from 'react'

interface Props {
  value:    string
  onChange: (next: string) => void
  onComplete?: (full: string) => void
  length?:    number
  disabled?:  boolean
  autoFocus?: boolean
}

export function OtpInput({
  value,
  onChange,
  onComplete,
  length = 6,
  disabled = false,
  autoFocus = true,
}: Props) {
  const refs = useRef<(HTMLInputElement | null)[]>([])
  const [focusedIdx, setFocusedIdx] = useState<number | null>(autoFocus ? 0 : null)

  useEffect(() => {
    if (autoFocus) refs.current[0]?.focus()
  }, [autoFocus])

  // Fire onComplete EXACTLY ONCE per "0…length" → "length" transition.
  // The previous implementation depended on `onComplete` (a fresh inline
  // arrow on every parent render) and re-fired the callback on every
  // re-render — which made react-query mutations restart in a tight loop
  // (one wrong-code submit produced 15+ POSTs to /auth/login/verify).
  const onCompleteRef = useRef(onComplete)
  onCompleteRef.current = onComplete
  const firedRef = useRef(false)
  useEffect(() => {
    const isComplete = value.length === length && /^\d+$/.test(value)
    if (isComplete && !firedRef.current) {
      firedRef.current = true
      onCompleteRef.current?.(value)
    } else if (!isComplete) {
      firedRef.current = false   // reset so the next full entry fires too
    }
  }, [value, length])

  function setDigit(i: number, d: string) {
    const arr = value.padEnd(length, ' ').split('')
    arr[i] = d
    const next = arr.join('').replace(/ /g, '').slice(0, length)
    onChange(next)
  }

  function handleChange(i: number, e: React.ChangeEvent<HTMLInputElement>) {
    const raw = e.target.value
    // Keep only the latest digit. If user pasted 6 digits into one cell,
    // distribute them across cells.
    const digits = raw.replace(/\D/g, '')
    if (digits.length <= 1) {
      setDigit(i, digits)
      if (digits) refs.current[Math.min(i + 1, length - 1)]?.focus()
    } else {
      // bulk paste handled by onPaste, but support direct typing too
      const next = (value.slice(0, i) + digits).slice(0, length).padEnd(value.length, '')
      onChange(next.slice(0, length).replace(/ /g, ''))
      const advance = Math.min(i + digits.length, length - 1)
      refs.current[advance]?.focus()
    }
  }

  function handleKeyDown(i: number, e: React.KeyboardEvent<HTMLInputElement>) {
    if (e.key === 'Backspace') {
      if (value[i]) {
        // Cell has a digit — clear it and stay
        setDigit(i, '')
      } else if (i > 0) {
        // Cell empty → step back and clear previous
        const prev = value.slice(0, -1)
        onChange(prev)
        refs.current[i - 1]?.focus()
        e.preventDefault()
      }
    } else if (e.key === 'ArrowLeft' && i > 0) {
      refs.current[i - 1]?.focus()
      e.preventDefault()
    } else if (e.key === 'ArrowRight' && i < length - 1) {
      refs.current[i + 1]?.focus()
      e.preventDefault()
    }
  }

  function handlePaste(e: React.ClipboardEvent<HTMLInputElement>) {
    const text = e.clipboardData.getData('text').replace(/\D/g, '').slice(0, length)
    if (!text) return
    e.preventDefault()
    onChange(text)
    refs.current[Math.min(text.length, length - 1)]?.focus()
  }

  return (
    <div className="flex items-center gap-2 sm:gap-3" role="group" aria-label="OTP">
      {Array.from({ length }).map((_, i) => (
        <input
          key={i}
          ref={(el) => { refs.current[i] = el }}
          type="text"
          inputMode="numeric"
          autoComplete={i === 0 ? "one-time-code" : "off"}
          maxLength={length}            // allow paste into first; we slice
          value={value[i] ?? ''}
          disabled={disabled}
          onChange={(e) => handleChange(i, e)}
          onKeyDown={(e) => handleKeyDown(i, e)}
          onPaste={i === 0 ? handlePaste : undefined}
          onFocus={() => setFocusedIdx(i)}
          onBlur={() => setFocusedIdx((cur) => (cur === i ? null : cur))}
          aria-label={`Digit ${i + 1} of ${length}`}
          className={[
            'w-11 h-14 sm:w-12 sm:h-16',
            'text-center font-display text-2xl sm:text-3xl text-brand-700',
            'rounded-md bg-surface-raised',
            'ring-1 ring-surface-border',
            'transition-all duration-100',
            focusedIdx === i ? 'ring-2 ring-brand-500 shadow-sm' : '',
            value[i] ? 'bg-brand-50/40' : '',
            disabled ? 'opacity-60 cursor-not-allowed' : '',
            'tabular-nums',
            'focus:outline-none',
          ].join(' ')}
        />
      ))}
    </div>
  )
}
