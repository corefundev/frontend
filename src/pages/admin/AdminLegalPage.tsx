// src/pages/admin/AdminLegalPage.tsx
//
// Admin editor for legal documents (currently just privacy). Plain
// textarea + preview pane — no fancy WYSIWYG. Markdown subset rendered
// by SimpleMarkdown, same as the public page.

import { useEffect, useState } from 'react'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import toast from 'react-hot-toast'

import { useParams } from 'react-router-dom'

import { legalApi } from '../../features/legal/api'
import SimpleMarkdown from '../../components/SimpleMarkdown'
import { errorMessage } from '../../shared/api/client'
import AdminQueryError from './AdminQueryError'

const DOC_TITLES: Record<string, string> = {
  privacy: 'Политика конфиденциальности',
  terms: 'Пользовательское соглашение',
  consent: 'Согласие на обработку ПДн',
  pdn: 'Политика обработки ПДн (152-ФЗ)',
  requisites: 'Реквизиты',
}

export default function AdminLegalPage() {
  // Обёртка: key=DOC_ID полностью пересоздаёт редактор при переключении
  // документа — локальное состояние (title/content) не перетекает между
  // документами (баг: после переключения «Сохранить» записал бы текст
  // одного документа в другой).
  const { docId = 'privacy' } = useParams()
  const DOC_ID = docId in DOC_TITLES ? docId : 'privacy'
  return <LegalDocEditor key={DOC_ID} DOC_ID={DOC_ID} />
}

function LegalDocEditor({ DOC_ID }: { DOC_ID: string }) {
  const qc = useQueryClient()

  const { data, isLoading, isError, refetch } = useQuery({
    queryKey: ['legal', DOC_ID],
    queryFn:  () => legalApi.get(DOC_ID),
  })

  const [title,   setTitle]   = useState('')
  const [content, setContent] = useState('')
  const [preview, setPreview] = useState(false)
  // LEG-3 #431: пометка версии как требующей повторного согласия
  const [requiresReconsent, setRequiresReconsent] = useState(false)
  const [changeSummary, setChangeSummary] = useState('')

  // Seed local state once when query lands. Don't overwrite the user's
  // unsaved edits if the query refetches.
  useEffect(() => {
    if (data && !title && !content) {
      setTitle(data.title)
      setContent(data.content)
    }
  }, [data, title, content])

  const save = useMutation({
    mutationFn: () => legalApi.update(DOC_ID, {
      title, content,
      requires_reconsent: requiresReconsent,
      change_summary: changeSummary.trim() || undefined,
    }),
    onSuccess: (resp) => {
      toast.success(`Сохранено (версия ${resp.version})`)
      setRequiresReconsent(false)
      setChangeSummary('')
      qc.invalidateQueries({ queryKey: ['legal', DOC_ID] })
    },
    onError: (e) => toast.error(errorMessage(e, 'Не удалось сохранить')),
  })

  if (isError) {
    // Editing over a failed load would let the operator save an empty doc.
    return (
      <div className="max-w-5xl">
        <AdminQueryError what="правовые документы" onRetry={() => void refetch()} />
      </div>
    )
  }
  if (isLoading) {
    // PJAX top-bar signals the wait; this placeholder reserves height.
    return <div className="p-6 h-64" aria-hidden="true" />
  }

  return (
    <div className="max-w-5xl">
      <div className="flex items-center justify-between mb-6">
        <div>
          {/* заголовок раздела рендерит топ-бар консоли (TITLES) —
              в теле не дублируем, только подсказка по разметке */}
          <p className="text-sm text-ink-muted">
            Публичный документ «{DOC_TITLES[DOC_ID]}». Markdown: # H1, ## H2,
            ### H3, **bold**, *italic*, - bullet
          </p>
        </div>
        <div className="flex gap-2">
          <button
            type="button"
            onClick={() => setPreview((p) => !p)}
            className="btn-secondary"
          >
            {preview ? 'Скрыть превью' : 'Превью'}
          </button>
          <button
            type="button"
            onClick={() => save.mutate()}
            disabled={save.isPending || !title.trim() || !content.trim()}
            className="btn-primary"
          >
            {save.isPending ? 'Сохранение…' : 'Сохранить'}
          </button>
        </div>
      </div>

      <label className="label" htmlFor="legal-title">Заголовок</label>
      <input
        id="legal-title"
        className="input"
        value={title}
        onChange={(e) => setTitle(e.target.value)}
      />

      <label className="label mt-4" htmlFor="legal-content">Содержание (Markdown)</label>
      <textarea
        id="legal-content"
        className="input font-mono text-sm"
        rows={24}
        value={content}
        onChange={(e) => setContent(e.target.value)}
      />

      {/* LEG-3 #431: сигнал повторного согласия для НОВОЙ версии */}
      <div className="mt-4 rounded-lg border border-surface-border p-4 space-y-2">
        <label className="flex items-center gap-2 text-sm select-none">
          <input type="checkbox" checked={requiresReconsent}
                 onChange={(e) => setRequiresReconsent(e.target.checked)} />
          Эта версия требует повторного согласия пользователей
        </label>
        {requiresReconsent && (
          <input className="input text-sm" maxLength={1000}
                 placeholder="Что изменилось (кратко — покажем пользователям)"
                 value={changeSummary}
                 onChange={(e) => setChangeSummary(e.target.value)} />
        )}
        <p className="text-xs text-ink-subtle">
          Сбор повторных согласий (модалка на входе) — следующий этап LEG-3;
          пометка версии уже фиксируется сейчас.
        </p>
      </div>

      <p className="text-xs text-ink-subtle mt-2">
        Текущая версия: {data?.version}. Последнее обновление:{' '}
        {data ? new Date(data.updated_at).toLocaleString('ru-RU') : '—'}
        {typeof data?.reconsent_required_since === 'number' &&
          ` · повторное согласие требуется с версии ${data.reconsent_required_since}`}
      </p>

      {preview && (
        <div className="card p-6 mt-6">
          <h2 className="text-sm font-semibold text-ink-muted mb-4 uppercase tracking-wider">
            Превью
          </h2>
          <SimpleMarkdown text={content} className="text-ink" />
        </div>
      )}
    </div>
  )
}
