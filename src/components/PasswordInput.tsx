// src/components/PasswordInput.tsx
//
// Правки владельца 2026-07-15: пароль с «глазиком» (показать/скрыть) и
// подсказка-«?» у лейбла вместо строки-eyebrow под полем. Иконки —
// инлайн-SVG (feather-style), внешних icon-библиотек в проекте нет.

import { InputHTMLAttributes, useState } from 'react'

type Props = Omit<InputHTMLAttributes<HTMLInputElement>, 'type'>

export function PasswordInput({ className, ...rest }: Props) {
  const [visible, setVisible] = useState(false)
  return (
    <div className="relative">
      <input
        {...rest}
        type={visible ? 'text' : 'password'}
        className={`input pr-11 ${className ?? ''}`}
      />
      <button
        type="button"
        onClick={() => setVisible((v) => !v)}
        aria-label={visible ? 'Скрыть пароль' : 'Показать пароль'}
        tabIndex={-1}
        className="absolute inset-y-0 right-0 flex items-center px-3 text-ink-subtle hover:text-ink transition-colors"
      >
        {visible ? <EyeOffIcon /> : <EyeIcon />}
      </button>
    </div>
  )
}

export function LabelHint({ text }: { text: string }) {
  return (
    <span className="group relative ml-1.5 inline-flex align-middle">
      <span
        tabIndex={0}
        aria-label={text}
        className="flex h-4 w-4 cursor-help select-none items-center justify-center rounded-full
                   border border-ink-subtle/60 text-[10px] font-bold leading-none text-ink-subtle"
      >
        ?
      </span>
      <span
        role="tooltip"
        className="pointer-events-none absolute bottom-full left-1/2 z-10 mb-2 hidden w-64
                   -translate-x-1/2 rounded-md bg-ink px-3 py-2 text-left text-xs font-normal
                   normal-case leading-snug text-ink-invert shadow-lg
                   group-hover:block group-focus-within:block"
      >
        {text}
      </span>
    </span>
  )
}

function EyeIcon() {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8"
         strokeLinecap="round" strokeLinejoin="round" className="h-5 w-5" aria-hidden>
      <path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z" />
      <circle cx="12" cy="12" r="3" />
    </svg>
  )
}

function EyeOffIcon() {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8"
         strokeLinecap="round" strokeLinejoin="round" className="h-5 w-5" aria-hidden>
      <path d="M17.94 17.94A10.07 10.07 0 0 1 12 20c-7 0-11-8-11-8a18.45 18.45 0 0 1 5.06-5.94" />
      <path d="M9.9 4.24A9.12 9.12 0 0 1 12 4c7 0 11 8 11 8a18.5 18.5 0 0 1-2.16 3.19" />
      <path d="M14.12 14.12a3 3 0 1 1-4.24-4.24" />
      <line x1="1" y1="1" x2="23" y2="23" />
    </svg>
  )
}
