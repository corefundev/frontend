// src/pages/PrivacyPage.tsx
//
// Public privacy-policy view. Content lives in postgres (legal_documents
// table) and is admin-editable via /app/admin/legal. Cached lightly so
// the signup flow's "open in new tab" doesn't refetch every click.

import { useQuery } from '@tanstack/react-query'
import { Link } from 'react-router-dom'

import { legalApi } from '../features/legal/api'
import SimpleMarkdown from '../components/SimpleMarkdown'

export default function PrivacyPage() {
  const { data, isLoading, error } = useQuery({
    queryKey: ['legal', 'privacy'],
    queryFn:  () => legalApi.get('privacy'),
    staleTime: 5 * 60_000,   // 5 min — admin edits propagate after refresh
  })

  return (
    <div className="min-h-screen bg-surface px-4 py-10">
      <div className="max-w-3xl mx-auto">
        <div className="mb-6">
          <Link to="/" className="text-sm text-brand-500 underline underline-offset-2">
            ← На главную
          </Link>
        </div>

        {isLoading && (
          <div className="text-ink-muted">Загрузка документа…</div>
        )}

        {error && (
          <div className="card p-6 border-red-200 bg-red-50 text-red-700">
            Не удалось загрузить документ. Попробуйте обновить страницу.
          </div>
        )}

        {data && (
          <article className="card p-8">
            <SimpleMarkdown text={data.content} className="text-ink prose-sm" />
            <hr className="my-8 border-ink-subtle/20" />
            <p className="text-xs text-ink-subtle">
              Версия документа: {data.version}. Последнее обновление:{' '}
              {new Date(data.updated_at).toLocaleString('ru-RU', {
                dateStyle: 'long',
                timeStyle: 'short',
              })}
            </p>
          </article>
        )}
      </div>
    </div>
  )
}
