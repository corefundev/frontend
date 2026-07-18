// DS-2 (#467) — форматирование и статусные бейджи раздела «Данные».
// Отдельный модуль: страницы экспортируют только компоненты (fast refresh).
import type { DatasetView } from './api'

export function fmtInt(n: number | null | undefined): string {
  return n == null ? '—' : n.toLocaleString('ru-RU')
}

export function fmtDate(iso: string | null | undefined): string {
  if (!iso) return '—'
  const d = new Date(iso)
  if (isNaN(d.getTime())) return '—'
  return d.toLocaleDateString('ru-RU',
    { day: '2-digit', month: '2-digit', year: 'numeric' })
}

export function fmtDateTime(iso: string | null | undefined): string {
  if (!iso) return '—'
  const d = new Date(iso)
  if (isNaN(d.getTime())) return '—'
  return `${d.toLocaleDateString('ru-RU',
    { day: '2-digit', month: '2-digit', year: 'numeric' })}, ${d.toLocaleTimeString('ru-RU',
    { hour: '2-digit', minute: '2-digit' })}`
}

export function fmtPeriod(min: string | null, max: string | null): string {
  if (!min || !max) return '—'
  return `${fmtDate(min)} — ${fmtDate(max)}`
}

export function plural(n: number, one: string, few: string, many: string): string {
  const m10 = n % 10, m100 = n % 100
  if (m10 === 1 && m100 !== 11) return one
  if (m10 >= 2 && m10 <= 4 && (m100 < 12 || m100 > 14)) return few
  return many
}

export function datasetBadge(ds: DatasetView): {
  label: string
  cls: string
} {
  if (!ds.model) {
    return { label: 'Модель не обучена', cls: 'badge badge-neutral' }
  }
  if (ds.model.up_to_date === false) {
    return { label: 'Данные новее модели', cls: 'badge badge-warn' }
  }
  return { label: 'Модель актуальна', cls: 'badge badge-success' }
}

