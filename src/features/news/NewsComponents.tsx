// NEWS-7 (#409): общие компоненты ленты/поста — используются публичной
// страницей и разделом кабинета (одна вёрстка, два обрамления).
import { useState } from 'react'
import { useQuery, useQueryClient } from '@tanstack/react-query'
import { Link } from 'react-router-dom'

import { CATEGORY_LABELS } from './adminApi'
import { newsPublicApi, type NewsFeedItem } from './publicApi'

const CATEGORY_BADGE: Record<string, string> = {
  release: 'badge-info',
  improvement: 'badge-success',
  maintenance: 'badge-warn',
  tip: 'badge-neutral',
  announcement: 'badge-info',
}

export function NewsCategoryChip({ category }: { category: string }) {
  return (
    <span className={CATEGORY_BADGE[category] ?? 'badge-neutral'}>
      {CATEGORY_LABELS[category as keyof typeof CATEGORY_LABELS] ?? category}
    </span>
  )
}

export function NewsFeedList({ basePath }: { basePath: string }) {
  const [limit, setLimit] = useState(20)
  const { data, isLoading, isError } = useQuery({
    queryKey: ['news-feed', limit],
    queryFn: () => newsPublicApi.feed(limit, 0),
  })

  if (isLoading) {
    return (
      <div className="space-y-3 animate-pulse" aria-label="Загрузка ленты">
        {[0, 1, 2].map((i) => (
          <div key={i} className="card h-24 p-5">
            <div className="h-3 w-2/5 rounded bg-surface-muted" />
            <div className="h-3 w-4/5 rounded bg-surface-muted mt-3" />
          </div>
        ))}
      </div>
    )
  }
  if (isError) {
    return (
      <div className="p-6 rounded-lg bg-danger-bg text-danger text-sm">
        Не удалось загрузить новости. Попробуйте обновить страницу.
      </div>
    )
  }
  if (!data?.posts.length) {
    return <div className="text-sm text-ink-muted">Новостей пока нет.</div>
  }
  return (
    <div className="space-y-3">
      {data.posts.map((p: NewsFeedItem) => (
        <Link key={p.id} to={`${basePath}/${encodeURIComponent(p.slug)}`}
              className="card block p-5 hover:shadow-md transition-shadow">
          <div className="flex items-center gap-2 flex-wrap">
            {p.pinned && <span title="закреплено">📌</span>}
            <NewsCategoryChip category={p.category} />
            {p.read === false && (
              <span className="h-2 w-2 rounded-full bg-brand-500" title="не прочитано" />
            )}
            <span className="text-xs text-ink-subtle ml-auto">
              {p.published_at
                ? new Date(p.published_at).toLocaleDateString('ru-RU')
                : ''}
            </span>
          </div>
          <h3 className="font-semibold mt-2 text-ink">{p.title}</h3>
          {p.summary && <p className="text-sm text-ink-muted mt-1">{p.summary}</p>}
        </Link>
      ))}
      {data.posts.length >= limit && (
        <button type="button" className="btn-secondary text-sm"
                onClick={() => setLimit((l) => Math.min(l + 20, 50))}>
          Показать ещё
        </button>
      )}
    </div>
  )
}

export function NewsPostView({ slug, markRead }: { slug: string; markRead: boolean }) {
  const qc = useQueryClient()
  const { data, isLoading, isError } = useQuery({
    queryKey: ['news-post', slug],
    queryFn: async () => {
      const post = await newsPublicApi.post(slug)
      // авто-отметка прочтения при открытии (только в кабинете) —
      // best-effort, страницу не блокирует
      if (markRead && post.read === false) {
        newsPublicApi.markRead(post.id)
          .then(() => {
            qc.invalidateQueries({ queryKey: ['news-unread'] })
            qc.invalidateQueries({ queryKey: ['news-feed'] })
          })
          .catch(() => undefined)
      }
      return post
    },
  })

  if (isLoading) return <div className="h-48 animate-pulse card" aria-hidden />
  if (isError || !data) {
    return (
      <div className="p-6 rounded-lg bg-danger-bg text-danger text-sm">
        Новость не найдена или уже недоступна.
      </div>
    )
  }
  return (
    <article className="card p-6">
      <div className="flex items-center gap-2 flex-wrap">
        <NewsCategoryChip category={data.category} />
        <span className="text-xs text-ink-subtle">
          {data.published_at
            ? new Date(data.published_at).toLocaleDateString('ru-RU', { dateStyle: 'long' })
            : ''}
        </span>
      </div>
      <h1 className="text-2xl font-semibold tracking-tight mt-3 text-ink">{data.title}</h1>
      {/* body_html — ТОЛЬКО серверный санитайзер (nh3), клиент не рендерит MD */}
      <div className="prose prose-sm max-w-none mt-4 text-ink [&_a]:text-brand-700"
           dangerouslySetInnerHTML={{ __html: data.body_html }} />
    </article>
  )
}
