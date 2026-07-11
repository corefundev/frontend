// ADM-v3-9 (#394-2): не-компонентная часть каркаса таблиц (хук сортировки
// + классы sticky-шапки) — отдельным файлом от компонентов, чтобы работал
// react-refresh (only-export-components).
import { useMemo, useState } from 'react'

export function useSort<T>(rows: T[], initialKey: keyof T & string, initialDesc = true) {
  const [key, setKey] = useState<keyof T & string>(initialKey)
  const [desc, setDesc] = useState(initialDesc)

  const sorted = useMemo(() => {
    const copy = [...rows]
    copy.sort((a, b) => {
      const av = a[key] as unknown
      const bv = b[key] as unknown
      if (av == null && bv == null) return 0
      if (av == null) return 1          // null-ы всегда внизу
      if (bv == null) return -1
      const cmp = typeof av === 'number' && typeof bv === 'number'
        ? av - bv
        : String(av).localeCompare(String(bv))
      return desc ? -cmp : cmp
    })
    return copy
  }, [rows, key, desc])

  const toggle = (k: keyof T & string) => {
    if (k === key) setDesc((d) => !d)
    else { setKey(k); setDesc(true) }
  }
  return { sorted, key, desc, toggle }
}

// sticky-шапка живёт ВНУТРИ overflow-контейнера страницы
export const THEAD_CLS =
  'bg-surface-muted text-ink-subtle text-xs uppercase tracking-wider sticky top-0 z-10'
