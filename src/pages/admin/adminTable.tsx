// ADM-v3-9 (#394, инкремент 2): компоненты каркаса операторских таблиц.
// Три ВИЗУАЛЬНО РАЗНЫХ состояния (AUD-12 дисциплина: пусто ≠ ошибка ≠
// загрузка — skeleton вместо немой пустоты), сортируемые заголовки,
// «показать ещё» вместо пагинаторов (ленты bounded на сервере).
// Хук useSort и THEAD_CLS — в adminTableUtils.ts (react-refresh:
// этот файл экспортирует ТОЛЬКО компоненты).

export function Th({ label, sortKey, sort, className = '' }: {
  label: string
  sortKey?: string
  sort?: { key: string; desc: boolean; toggle: (k: never) => void }
  className?: string
}) {
  const active = sort && sortKey && sort.key === sortKey
  return (
    <th className={`px-4 py-2 text-left select-none ${className}`}>
      {sortKey && sort ? (
        <button type="button"
                className={`inline-flex items-center gap-1 uppercase tracking-wider ${
                  active ? 'text-ink' : 'hover:text-ink'}`}
                onClick={() => sort.toggle(sortKey as never)}>
          {label}
          <span className={active ? '' : 'opacity-0'}>{sort.desc ? '↓' : '↑'}</span>
        </button>
      ) : label}
    </th>
  )
}

export function SkeletonRows({ cols, rows = 6 }: { cols: number; rows?: number }) {
  return (
    <>
      {Array.from({ length: rows }, (_, i) => (
        <tr key={i} className="animate-pulse">
          {Array.from({ length: cols }, (_, j) => (
            <td key={j} className="px-4 py-2">
              <div className="h-3 rounded bg-surface-muted" />
            </td>
          ))}
        </tr>
      ))}
    </>
  )
}

export function StateRow({ cols, kind, what }: {
  cols: number
  kind: 'empty' | 'error'
  what: string
}) {
  return (
    <tr>
      <td colSpan={cols} className="px-5 py-8 text-center text-sm">
        {kind === 'error'
          ? <span className="badge-danger">не удалось загрузить {what}</span>
          : <span className="text-ink-muted">{what}: пусто</span>}
      </td>
    </tr>
  )
}

export function ShowMore({ shown, step, max, onMore }: {
  shown: number; step: number; max: number; onMore: (next: number) => void
}) {
  if (shown >= max) return null
  return (
    <div className="px-5 py-2.5 border-t border-surface-border">
      <button type="button" className="btn-secondary text-xs"
              onClick={() => onMore(Math.min(shown + step, max))}>
        Показать ещё (загружено {shown})
      </button>
    </div>
  )
}
