// src/pages/PrivacyPage.tsx
//
// Публичная страница политики конфиденциальности. Использует PublicLayout
// (общий header/footer). Markdown рендерится через SimpleMarkdown.

import { useQuery } from '@tanstack/react-query'

import { legalApi } from '../features/legal/api'
import SimpleMarkdown from '../components/SimpleMarkdown'
import PublicLayout from '../components/PublicLayout'

export default function PrivacyPage() {
  const { data, isLoading, error } = useQuery({
    queryKey: ['legal', 'privacy'],
    queryFn:  () => legalApi.get('privacy'),
    staleTime: 5 * 60_000,
  })

  return (
    <PublicLayout>
      <section className="py-12 lg:py-16">
        <div className="mx-auto max-w-3xl px-5 lg:px-8">
          {/* PJAX-loader at viewport top covers the wait; spacer here
              just reserves vertical room so the layout doesn't pop. */}
          {isLoading && <div className="h-48" aria-hidden="true" />}

          {error && (
            <div className="p-6 rounded-2xl bg-red-50 border border-red-200 text-red-700">
              Не удалось загрузить документ. Попробуйте обновить страницу.
            </div>
          )}

          {data && (
            <article>
              <SimpleMarkdown text={data.content} className="text-ink" />
              <hr className="my-8 border-ink/10" />
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
      </section>
    </PublicLayout>
  )
}
