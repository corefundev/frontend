// src/pages/admin/AdminLegalPage.tsx
//
// Admin editor for legal documents (currently just privacy). Plain
// textarea + preview pane — no fancy WYSIWYG. Markdown subset rendered
// by SimpleMarkdown, same as the public page.

import { useEffect, useState } from 'react'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import toast from 'react-hot-toast'

import { legalApi } from '../../features/legal/api'
import SimpleMarkdown from '../../components/SimpleMarkdown'
import { errorMessage } from '../../shared/api/client'

const DOC_ID = 'privacy'

export default function AdminLegalPage() {
  const qc = useQueryClient()

  const { data, isLoading } = useQuery({
    queryKey: ['legal', DOC_ID],
    queryFn:  () => legalApi.get(DOC_ID),
  })

  const [title,   setTitle]   = useState('')
  const [content, setContent] = useState('')
  const [preview, setPreview] = useState(false)

  // Seed local state once when query lands. Don't overwrite the user's
  // unsaved edits if the query refetches.
  useEffect(() => {
    if (data && !title && !content) {
      setTitle(data.title)
      setContent(data.content)
    }
  }, [data, title, content])

  const save = useMutation({
    mutationFn: () => legalApi.update(DOC_ID, { title, content }),
    onSuccess: (resp) => {
      toast.success(`Сохранено (версия ${resp.version})`)
      qc.invalidateQueries({ queryKey: ['legal', DOC_ID] })
    },
    onError: (e) => toast.error(errorMessage(e, 'Не удалось сохранить')),
  })

  if (isLoading) {
    // PJAX top-bar signals the wait; this placeholder reserves height.
    return <div className="p-6 h-64" aria-hidden="true" />
  }

  return (
    <div className="p-6 max-w-5xl mx-auto">
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-2xl font-semibold">Юридические документы</h1>
          <p className="text-sm text-ink-muted mt-1">
            Markdown: # H1, ## H2, ### H3, **bold**, *italic*, - bullet
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

      <p className="text-xs text-ink-subtle mt-2">
        Текущая версия: {data?.version}. Последнее обновление:{' '}
        {data ? new Date(data.updated_at).toLocaleString('ru-RU') : '—'}
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
