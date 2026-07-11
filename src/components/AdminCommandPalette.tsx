// ADM-v3-9 (#394, инкременты 3/5): command palette (Cmd/Ctrl+K).
// Для одного оператора быстрее любой навигации: раздел, клиент по
// id/email, быстрое действие. Реализация in-house (никаких сторонних
// cmdk-библиотек — feedback_no_third_party_runtimes); палитра v1
// НАВИГАЦИОННАЯ: пункты-«действия» ведут на страницу, где живёт кнопка
// с её confirm'ом — деструктивное из палитры не исполняется.
// #394-5: управляется извне (кнопка «Поиск и действия ⌘K» в шапке),
// результаты сгруппированы по типам с label'ами — как в прототипе.
import { useEffect, useMemo, useRef, useState } from 'react'
import { useQuery } from '@tanstack/react-query'
import { useNavigate } from 'react-router-dom'

import { clientsApi } from '../features/clients/api'

interface Item {
  kind: 'Разделы' | 'Клиенты' | 'Действия'
  label: string
  hint?: string
  to: string
}

const SECTIONS: Item[] = [
  { kind: 'Разделы', label: 'Обзор', to: '/admin' },
  { kind: 'Разделы', label: 'Клиенты', to: '/admin/clients' },
  { kind: 'Разделы', label: 'Тарифы', to: '/admin/plans' },
  { kind: 'Разделы', label: 'Обучение', to: '/admin/training' },
  { kind: 'Разделы', label: 'Данные', to: '/admin/data' },
  { kind: 'Разделы', label: 'Уведомления', to: '/admin/notifications' },
  { kind: 'Разделы', label: 'Аудит', to: '/admin/audit' },
  { kind: 'Разделы', label: 'Безопасность', to: '/admin/security' },
  { kind: 'Разделы', label: 'Система', to: '/admin/system' },
  { kind: 'Разделы', label: 'Юр. документы', to: '/admin/legal' },
]

const ACTIONS: Item[] = [
  { kind: 'Действия', label: 'Новый пользователь', to: '/admin/clients/new' },
  { kind: 'Действия', label: 'Reconcile зависших тренировок', hint: 'Обучение', to: '/admin/training' },
  { kind: 'Действия', label: 'Проверить консистентность хранилища', hint: 'Данные', to: '/admin/data' },
  { kind: 'Действия', label: 'Новый анонс клиентам', hint: 'Уведомления', to: '/admin/notifications' },
  { kind: 'Действия', label: 'Проверить целостность audit-цепочки', hint: 'Аудит', to: '/admin/audit' },
]

const KIND_ORDER: Item['kind'][] = ['Клиенты', 'Действия', 'Разделы']

function rank(q: string, hay: string): number {
  const h = hay.toLowerCase()
  if (h.startsWith(q)) return 0
  if (h.includes(q)) return 1
  return -1
}

export default function AdminCommandPalette({ open, onOpenChange }: {
  open: boolean
  onOpenChange: (open: boolean) => void
}) {
  const [query, setQuery] = useState('')
  const [cursor, setCursor] = useState(0)
  const inputRef = useRef<HTMLInputElement>(null)
  const nav = useNavigate()

  // клиенты подтягиваются только при открытой палитре (общий query-ключ)
  const { data: clients = [] } = useQuery({
    queryKey: ['admin-clients'],
    queryFn: () => clientsApi.list(),
    enabled: open,
    meta: { silent: true },
  })

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === 'k') {
        e.preventDefault()
        onOpenChange(!open)
      } else if (e.key === 'Escape') {
        onOpenChange(false)
      }
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [open, onOpenChange])

  useEffect(() => {
    if (open) {
      setQuery('')
      setCursor(0)
      setTimeout(() => inputRef.current?.focus(), 0)
    }
  }, [open])

  const results = useMemo<Item[]>(() => {
    const q = query.trim().toLowerCase()
    const clientItems: Item[] = clients.map((c) => ({
      kind: 'Клиенты' as const,
      label: c.client_id,
      hint: [c.email ?? undefined, c.plan].filter(Boolean).join(' · '),
      to: `/admin/clients/${encodeURIComponent(c.client_id)}`,
    }))
    const pool = q
      ? [...SECTIONS, ...ACTIONS, ...clientItems]
          .map((it) => {
            const r = Math.min(
              ...[it.label, it.hint ?? ''].map((h) => {
                const rr = rank(q, h)
                return rr === -1 ? 99 : rr
              }),
            )
            return { it, r }
          })
          .filter((x) => x.r < 99)
          .sort((a, b) => a.r - b.r || a.it.label.localeCompare(b.it.label))
          .slice(0, 12)
          .map((x) => x.it)
      : [...clientItems.slice(0, 4), ...ACTIONS.slice(0, 4), ...SECTIONS.slice(0, 4)]
    // группировка по типам в порядке прототипа (Клиенты → Действия → Разделы)
    return KIND_ORDER.flatMap((k) => pool.filter((it) => it.kind === k))
  }, [query, clients])

  useEffect(() => { setCursor(0) }, [results.length, query])

  if (!open) return null

  const go = (it: Item) => { onOpenChange(false); nav(it.to) }

  let lastKind: Item['kind'] | null = null

  return (
    <div className="fixed inset-0 z-50 bg-slate-900/45 flex items-start justify-center pt-[14vh]"
         role="dialog" aria-modal="true" aria-label="Поиск и действия"
         onClick={() => onOpenChange(false)}>
      <div className="w-[560px] max-w-[calc(100vw-32px)] card-paper shadow-xl overflow-hidden"
           onClick={(e) => e.stopPropagation()}>
        <input
          ref={inputRef}
          className="w-full px-4 py-3.5 text-sm outline-none border-b border-surface-border bg-transparent text-ink placeholder:text-ink-subtle"
          placeholder="Клиент, раздел или действие…"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === 'ArrowDown') { e.preventDefault(); setCursor((c) => Math.min(c + 1, results.length - 1)) }
            else if (e.key === 'ArrowUp') { e.preventDefault(); setCursor((c) => Math.max(c - 1, 0)) }
            else if (e.key === 'Enter' && results[cursor]) go(results[cursor])
          }}
        />
        <div role="listbox" aria-label="Результаты" className="max-h-80 overflow-y-auto p-2">
          {!results.length ? (
            <div className="px-3 py-3 text-sm text-ink-muted">Ничего не найдено</div>
          ) : results.map((it, i) => {
            const showLabel = it.kind !== lastKind
            lastKind = it.kind
            return (
              <div key={`${it.kind}:${it.to}:${it.label}`}>
                {showLabel && (
                  <p className="m-0 px-2 pt-1.5 pb-0.5 text-[10px] font-bold uppercase tracking-widest text-ink-subtle">
                    {it.kind}
                  </p>
                )}
                <button type="button" role="option" aria-selected={i === cursor}
                        className={`w-full flex items-center gap-2.5 px-2.5 py-2 rounded-md text-left text-[13px] transition-colors ${
                          i === cursor ? '' : 'hover:bg-surface-muted/60'}`}
                        style={i === cursor
                          ? { background: 'var(--admin-brand-bg)', color: 'var(--admin-brand-ink)' }
                          : undefined}
                        onMouseEnter={() => setCursor(i)}
                        onClick={() => go(it)}>
                  <span className={it.kind === 'Клиенты' ? 'font-mono text-xs' : 'font-medium'}>
                    {it.label}
                  </span>
                  {it.hint && <span className="text-[11px] text-ink-subtle truncate ml-auto">{it.hint}</span>}
                </button>
              </div>
            )
          })}
        </div>
        <div className="px-4 py-2 border-t border-surface-border text-[11px] text-ink-subtle flex gap-4">
          <span>↑↓ — выбор</span><span>Enter — перейти</span><span>Esc — закрыть</span>
          <span className="ml-auto">Cmd/Ctrl+K</span>
        </div>
      </div>
    </div>
  )
}
