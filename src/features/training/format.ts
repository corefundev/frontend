import { format, parseISO } from 'date-fns'
import { ru } from 'date-fns/locale'

import type { TrainingRun } from './api'

export function safeFormat(iso: string | null | undefined): string {
  if (!iso || iso === 'None') return '—'
  try {
    return format(parseISO(iso), 'dd MMM yyyy HH:mm', { locale: ru })
  } catch {
    return iso
  }
}

export function formatDuration(sec: number): string {
  if (!Number.isFinite(sec) || sec < 0) return '—'
  const m = Math.floor(sec / 60)
  const s = Math.round(sec - m * 60)
  return m === 0 ? `${s} сек` : `${m} мин ${s.toString().padStart(2, '0')} сек`
}

export const RUN_STATUS_LABEL: Record<TrainingRun['status'], string> = {
  queued:   'В очереди',
  running:  'Выполняется',
  finished: 'Готово',
  failed:   'Ошибка',
}

export const RUN_STATUS_BADGE: Record<TrainingRun['status'], string> = {
  queued:   'badge-neutral',
  running:  'badge-info',
  finished: 'badge-success',
  failed:   'badge-danger',
}
