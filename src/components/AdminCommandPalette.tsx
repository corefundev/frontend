// ADM-v3-9 (#394, инкремент 3): command palette (Cmd/Ctrl+K).
// Для одного оператора быстрее любой навигации: раздел, клиент по
// id/email, быстрое действие. Реализация in-house (никаких сторонних
// cmdk-библиотек — feedback_no_third_party_runtimes); палитра v1
// НАВИГАЦИОННАЯ: пункты-«действия» ведут на страницу, где живёт кнопка
// с её confirm'ом — деструктивное из палитры не исполняется.
import { useEffect, useMemo, useRef, useState } from 'react'
import { useQuery } from '@tanstack/react-query'
import { useNavigate } from 'react-router-dom'

import { clientsApi } from '../features/clients/api'

interface Item {
  kind: 'раздел' | 'клиент' | 'действие'
  label: string
  hint?: string
  to: string
}

const SECTIONS: Item[] = [
  { kind: 'раздел', label: 'Обзор', to: '/admin' },
  { kind: 'раздел', label: 'Клиенты', to: '/admin/clients' },
  { kind: 'раздел', label: 'Тарифы', to: '/admin/plans' },
  { kind: 'раздел', label: 'Обучение', to: '/admin/training' },
  { kind: 'раздел', label: 'Данные', to: '/admin/data' },
  { kind: 'раздел', label: 'Уведомления', to: '/admin/notifications' },
  { kind: 'раздел', label: 'Аудит', to: '/admin/audit' },
  { kind: 'раздел', label: 'Безопасность', to: '/admin/security' },
  { kind: 'раздел', label: 'Система', to: '/admin/system' },
  { kind: 'раздел', label: 'Юр. документы', to: '/admin/legal' },
]

const ACTIONS: Item[] = [
  { kind: 'действие', label: 'Новый пользователь', to: '/admin/clients/new' },
  { kind: 'действие', label: 'Reconcile зависших тренировок',
    hint: 'кнопка с confirm — на «Обучении»', to: '/admin/training' },
  { kind: 'действие', label: 'Проверить консистентность хранилища',
    hint: 'кнопка — на «Данных»', to: '/admin/data' },
  { kind: 'действие', label: 'Новый анонс клиентам', to: '/admin/notifications' },
  { kind: 'действие', label: 'Проверить целостность audit-цепочки',
    hint: 'кнопка — на «Аудите»', to: '/admin/audit' },
]

function rank(q: string, hay: string): number {
  const h = hay.toLowerCase()
  if (h.startsWith(q)) return 0
  if (h.includes(q)) return 1
  return -1
}

export default function AdminCommandPalette() {
  const [open, setOpen] = useState(false)
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
        setOpen((o) => !o)
      } else if (e.key === 'Escape') {
        setOpen(false)
      }
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [])

  useEffect(() => {
    if (open) {
      setQuery('')
      setCursor(0)
      // фокус после рендера оверлея
      setTimeout(() => inputRef.current?.focus(), 0)
    }
  }, [open])

  const results = useMemo<Item[]>(() => {
    const q = query.trim().toLowerCase()
    const clientItems: Item[] = clients.map((c) => ({
      kind: 'клиент' as const,
      label: c.client_id,
      hint: [c.email ?? undefined, c.plan].filter(Boolean).join(' · '),
      to: `/admin/clients/${encodeURIComponent(c.client_id)}`,
    }))
    const all = [...SECTIONS, ...ACTIONS, ...clientItems]
    if (!q) return [...SECTIONS.slice(0, 5), ...ACTIONS.slice(0, 3)]
    return all
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
      .slice(0, 10)
      .map((x) => x.it)
  }, [query, clients])

  useEffect(() => { setCursor(0) }, [results.length, query])

  if (!open) return null

  const go = (it: Item) => { setOpen(false); nav(it.to) }

  return (
    <div className="fixed inset-0 z-50 bg-slate-900/40 flex items-start justify-center pt-[15vh]"
         role="dialog" aria-modal="true" aria-label="Командная палитра"
         onClick={() => setOpen(false)}>
      <div className="w-full max-w-lg card-paper shadow-xl overflow-hidden"
           onClick={(e) => e.stopPropagation()}>
        <input
          ref={inputRef}
          className="w-full px-4 py-3 text-sm outline-none border-b border-surface-border bg-transparent"
          placeholder="Раздел, клиент (id/email) или действие…"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === 'ArrowDown') { e.preventDefault(); setCursor((c) => Math.min(c + 1, results.length - 1)) }
            else if (e.key === 'ArrowUp') { e.preventDefault(); setCursor((c) => Math.max(c - 1, 0)) }
            else if (e.key === 'Enter' && results[cursor]) go(results[cursor])
          }}
        />
        <ul role="listbox" aria-label="Результаты" className="max-h-72 overflow-y-auto py-1">
          {!results.length ? (
            <li className="px-4 py-3 text-sm text-ink-muted">Ничего не найдено</li>
          ) : results.map((it, i) => (
            <li key={`${it.kind}:${it.to}:${it.label}`} role="option" aria-selected={i === cursor}>
              <button type="button"
                      className={`w-full flex items-center gap-3 px-4 py-2 text-left text-sm ${
                        i === cursor ? 'bg-brand-50 text-ink' : 'hover:bg-surface-muted/60'}`}
                      onMouseEnter={() => setCursor(i)}
                      onClick={() => go(it)}>
                <span className="badge-neutral shrink-0">{it.kind}</span>
                <span className="font-medium truncate">{it.label}</span>
                {it.hint && <span className="text-xs text-ink-muted truncate ml-auto">{it.hint}</span>}
              </button>
            </li>
          ))}
        </ul>
        <div className="px-4 py-2 border-t border-surface-border text-[11px] text-ink-muted flex gap-4">
          <span>↑↓ — выбор</span><span>Enter — перейти</span><span>Esc — закрыть</span>
          <span className="ml-auto">Cmd/Ctrl+K</span>
        </div>
      </div>
    </div>
  )
}
