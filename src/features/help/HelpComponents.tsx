// HC-4 (#410): общие компоненты базы знаний — публичная витрина и
// кабинет используют одно и то же (как NewsComponents). Рендер статьи —
// ТОЛЬКО санированный body_html с сервера (.cms-body); сниппеты поиска —
// чистый текст с сентинелами [[…]] → <mark> ставим сами, никакого
// dangerouslySetInnerHTML для поиска.
import { useEffect, useRef, useState } from 'react'
import { useMutation, useQuery } from '@tanstack/react-query'
import { Link } from 'react-router-dom'

import {
  helpPublicApi, type HelpCrumb, type HelpTeaser,
} from './publicApi'

// «до [[совпадение]] после» → текст + <mark>
export function SnippetText({ snippet }: { snippet: string }) {
  const parts = snippet.split(/\[\[|\]\]/)
  return (
    <>
      {parts.map((p, i) => (
        i % 2 === 1
          ? <mark key={i} className="bg-brand-500/15 text-inherit rounded-sm px-0.5">{p}</mark>
          : <span key={i}>{p}</span>
      ))}
    </>
  )
}

export function HelpBreadcrumbs({ crumbs, basePath }: {
  crumbs: HelpCrumb[]
  basePath: string
}) {
  if (!crumbs.length) return null
  return (
    <nav className="text-sm text-ink-muted flex items-center gap-1.5 flex-wrap">
      <Link to={basePath} className="hover:text-ink">База знаний</Link>
      {crumbs.map((c) => (
        <span key={c.slug} className="flex items-center gap-1.5">
          <span aria-hidden>/</span>
          <Link to={`${basePath}/${encodeURIComponent(c.slug)}`}
                className="hover:text-ink">{c.title}</Link>
        </span>
      ))}
    </nav>
  )
}

// ── поиск (HC-5): виджет на всех страницах центра ────────────────────────
export function HelpSearchBox({ basePath }: { basePath: string }) {
  const [q, setQ] = useState('')
  const [debounced, setDebounced] = useState('')
  const timer = useRef<number | null>(null)
  const [focused, setFocused] = useState(false)

  const onChange = (v: string) => {
    setQ(v)
    if (timer.current) window.clearTimeout(timer.current)
    timer.current = window.setTimeout(() => setDebounced(v.trim()), 400)
  }
  const enabled = debounced.length >= 2
  const { data, isFetching } = useQuery({
    queryKey: ['help-search', debounced],
    queryFn: () => helpPublicApi.search(debounced),
    enabled,
    staleTime: 60_000,
  })
  const open = focused && enabled

  return (
    <div className="relative">
      <input
        className="input w-full"
        placeholder="Поиск по базе знаний…"
        value={q}
        onChange={(e) => onChange(e.target.value)}
        onFocus={() => setFocused(true)}
        onBlur={() => window.setTimeout(() => setFocused(false), 200)}
      />
      {open && (
        <div className="absolute z-20 mt-1 w-full rounded-md border border-surface-border bg-surface shadow-paper overflow-hidden">
          {isFetching && !data ? (
            <div className="px-4 py-3 text-sm text-ink-muted">Ищем…</div>
          ) : !data?.results.length ? (
            <div className="px-4 py-3 text-sm text-ink-muted">
              Ничего не нашлось — попробуйте другую формулировку
            </div>
          ) : (
            <ul className="divide-y divide-surface-border max-h-80 overflow-y-auto">
              {data.results.map((r) => (
                <li key={r.slug}>
                  <HelpSearchResultLink hit={r} basePath={basePath} />
                </li>
              ))}
            </ul>
          )}
        </div>
      )}
    </div>
  )
}

function HelpSearchResultLink({ hit, basePath }: {
  hit: { slug: string; title: string; snippet: string }
  basePath: string
}) {
  // канонический адрес статьи — {base}/a/{slug} (пространство категорий
  // и статей не пересекается)
  return (
    <Link to={`${basePath}/a/${encodeURIComponent(hit.slug)}`}
          className="block px-4 py-2.5 hover:bg-surface-muted/60">
      <div className="text-sm font-medium text-ink">{hit.title}</div>
      <div className="text-[12.5px] text-ink-muted mt-0.5 line-clamp-2">
        <SnippetText snippet={hit.snippet} />
      </div>
    </Link>
  )
}

// ── списки ───────────────────────────────────────────────────────────────
export function HelpCategoriesGrid({ basePath }: { basePath: string }) {
  const { data: cats, isLoading, isError } = useQuery({
    queryKey: ['help-categories'],
    queryFn: () => helpPublicApi.categories(),
  })
  if (isLoading) {
    return <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-3">
      {[0, 1, 2].map((i) => <div key={i} className="h-24 rounded-lg bg-surface-muted animate-pulse" />)}
    </div>
  }
  if (isError) return <p className="text-sm text-danger">Не удалось загрузить категории.</p>
  if (!cats?.length) return <p className="text-sm text-ink-muted">Статьи готовятся к публикации.</p>
  return (
    <div className="grid sm:grid-cols-2 gap-3">
      {cats.map((c) => (
        <Link key={c.slug} to={`${basePath}/${encodeURIComponent(c.slug)}`}
              className="flex items-start gap-3.5 rounded-lg border border-surface-border bg-surface p-4 hover:border-brand-500/40 hover:shadow-paper transition-shadow">
          <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg bg-surface-muted text-lg"
                aria-hidden>
            {c.icon || '📄'}
          </span>
          <span className="min-w-0">
            <span className="block font-medium text-ink">{c.title}</span>
            {c.description && (
              <span className="block text-sm text-ink-muted mt-0.5">{c.description}</span>
            )}
            <span className="block text-xs text-ink-subtle mt-1.5">
              {c.articles_count ?? 0} стат{plural(c.articles_count ?? 0)}
            </span>
          </span>
        </Link>
      ))}
    </div>
  )
}

function plural(n: number): string {
  const m10 = n % 10, m100 = n % 100
  if (m10 === 1 && m100 !== 11) return 'ья'
  if (m10 >= 2 && m10 <= 4 && (m100 < 12 || m100 > 14)) return 'ьи'
  return 'ей'
}

export function HelpTeaserList({ items, basePath }: {
  items: HelpTeaser[]
  basePath: string
}) {
  if (!items.length) return <p className="text-sm text-ink-muted">В категории пока пусто.</p>
  return (
    <ul className="divide-y divide-surface-border rounded-lg border border-surface-border bg-surface">
      {items.map((a) => (
        <li key={a.slug}>
          <Link to={`${basePath}/a/${encodeURIComponent(a.slug)}`}
                className="block px-4 py-3 hover:bg-surface-muted/60">
            <div className="font-medium text-ink">{a.title}</div>
            {a.excerpt && <div className="text-sm text-ink-muted mt-0.5">{a.excerpt}</div>}
          </Link>
        </li>
      ))}
    </ul>
  )
}

// ── статья ───────────────────────────────────────────────────────────────
export function HelpArticleView({ slug, basePath }: {
  slug: string
  basePath: string
}) {
  const { data: art, isLoading, isError } = useQuery({
    queryKey: ['help-article', slug],
    queryFn: () => helpPublicApi.article(slug),
  })
  const bodyRef = useRef<HTMLDivElement>(null)
  // SEO из API (публичная витрина)
  useEffect(() => {
    if (!art) return
    const prev = document.title
    document.title = art.seo_title || art.title
    return () => { document.title = prev }
  }, [art])

  if (isLoading) return <div className="h-40 rounded-lg bg-surface-muted animate-pulse" />
  if (isError || !art) {
    return (
      <p className="text-sm text-ink-muted">
        Статья не найдена — возможно, она снята с публикации.{' '}
        <Link to={basePath} className="text-brand-600 hover:underline">К базе знаний</Link>
      </p>
    )
  }
  return (
    <div className="lg:grid lg:grid-cols-[minmax(0,1fr)_200px] lg:gap-12">
      <article className="min-w-0">
        <HelpBreadcrumbs crumbs={art.breadcrumbs} basePath={basePath} />
        <h1 className="text-2xl font-semibold tracking-tight text-ink mt-3">{art.title}</h1>
        {art.published_at && (
          <div className="text-xs text-ink-subtle mt-1">
            Обновлено {new Date(art.updated_at).toLocaleDateString('ru-RU')}
          </div>
        )}
        <div ref={bodyRef} className="cms-body text-[15px] text-ink mt-5"
             dangerouslySetInnerHTML={{ __html: art.body_html }} />
        <HelpFeedbackBlock slug={art.slug} />
        {!!art.related.length && (
          <div className="mt-8">
            <div className="text-sm font-semibold text-ink mb-2">Ещё по теме</div>
            <ul className="space-y-1.5">
              {art.related.map((r) => (
                <li key={r.slug}>
                  <Link to={`${basePath}/a/${encodeURIComponent(r.slug)}`}
                        className="text-sm text-brand-600 hover:underline">{r.title}</Link>
                </li>
              ))}
            </ul>
          </div>
        )}
      </article>
      <HelpArticleToc bodyRef={bodyRef} articleKey={art.slug} />
    </div>
  )
}

// ── оглавление статьи (правый рейл, lg+) ─────────────────────────────────
// Секции берём из УЖЕ отрендеренного санированного body (h2/h3 —
// содержимое прошло серверный санитайзер, мы только читаем текст и
// проставляем id для якорей). Активная секция — по IntersectionObserver;
// рейл = сплошная светлая линия, активный сегмент — тёмный (референс —
// help-центры Anthropic/Intercom).
function HelpArticleToc({ bodyRef, articleKey }: {
  bodyRef: React.RefObject<HTMLDivElement>
  articleKey: string
}) {
  const [items, setItems] = useState<{ id: string; text: string; sub: boolean }[]>([])
  const [active, setActive] = useState<string | null>(null)

  useEffect(() => {
    const root = bodyRef.current
    if (!root) return
    const seen = new Map<string, number>()
    const found = Array.from(root.querySelectorAll<HTMLElement>('h2, h3')).map((h) => {
      const text = (h.textContent || '').trim()
      let id = h.id || text.toLowerCase()
        .replace(/[^a-zа-яё0-9\s-]/gi, '').trim().replace(/\s+/g, '-') || 'section'
      const n = seen.get(id) ?? 0
      seen.set(id, n + 1)
      if (n > 0) id = `${id}-${n + 1}`
      h.id = id
      h.style.scrollMarginTop = '84px'
      return { id, text, sub: h.tagName === 'H3', el: h }
    }).filter((i) => i.text)
    setItems(found.map((i) => ({ id: i.id, text: i.text, sub: i.sub })))
    setActive(found[0]?.id ?? null)
    if (!found.length) return

    const io = new IntersectionObserver((entries) => {
      const visible = entries
        .filter((e) => e.isIntersecting)
        .sort((a, b) => a.boundingClientRect.top - b.boundingClientRect.top)
      if (visible[0]) setActive(visible[0].target.id)
    }, { rootMargin: '-80px 0px -70% 0px' })
    found.forEach((i) => io.observe(i.el))
    return () => io.disconnect()
  }, [bodyRef, articleKey])

  if (items.length < 2) return null
  return (
    <nav className="hidden lg:block" aria-label="Содержание статьи">
      <ul className="sticky top-24 max-h-[calc(100vh-8rem)] overflow-y-auto border-l border-surface-border">
        {items.map((i) => (
          <li key={i.id}>
            <a href={`#${i.id}`}
               onClick={(e) => {
                 e.preventDefault()
                 document.getElementById(i.id)?.scrollIntoView({ behavior: 'smooth', block: 'start' })
                 setActive(i.id)
               }}
               className={[
                 'block -ml-px border-l-2 py-1.5 pr-2 text-[13px] leading-snug transition-colors',
                 i.sub ? 'pl-7' : 'pl-4',
                 active === i.id
                   ? 'border-ink text-ink font-medium'
                   : 'border-transparent text-ink-muted hover:text-ink',
               ].join(' ')}>
              {i.text}
            </a>
          </li>
        ))}
      </ul>
    </nav>
  )
}

// ── «Была ли статья полезна?» (HC-6) ─────────────────────────────────────
function HelpFeedbackBlock({ slug }: { slug: string }) {
  const [voted, setVoted] = useState<'yes' | 'no' | 'dup' | null>(null)
  const [comment, setComment] = useState('')
  const [showComment, setShowComment] = useState(false)

  const mut = useMutation({
    mutationFn: (v: { helpful: boolean; comment?: string }) =>
      helpPublicApi.feedback(slug, v.helpful, v.comment),
    onSuccess: (recorded, v) => {
      setVoted(recorded ? (v.helpful ? 'yes' : 'no') : 'dup')
      setShowComment(false)
    },
    onError: () => setVoted('dup'),
  })

  if (voted) {
    return (
      <div className="mt-8 rounded-lg border border-surface-border bg-surface-muted/40 px-4 py-3 text-sm text-ink-muted text-center">
        {voted === 'dup'
          ? 'Ваш голос по этой статье уже учтён.'
          : 'Спасибо! Ваш отзыв поможет сделать статьи лучше.'}
      </div>
    )
  }
  return (
    <div className="mt-8 rounded-lg border border-surface-border bg-surface-muted/40 px-4 py-4">
      <div className="flex items-center justify-center gap-3 flex-wrap text-center">
        <span className="text-sm text-ink">Была ли статья полезна?</span>
        <button type="button" className="btn-secondary text-xs" disabled={mut.isPending}
                onClick={() => mut.mutate({ helpful: true, comment })}>
          👍 Да
        </button>
        <button type="button" className="btn-secondary text-xs" disabled={mut.isPending}
                onClick={() => setShowComment(true)}>
          👎 Нет
        </button>
      </div>
      {showComment && (
        <div className="mt-3 space-y-2">
          <textarea className="input text-sm min-h-[70px] w-full"
                    maxLength={1000}
                    placeholder="Чего не хватило? (необязательно, без личных данных)"
                    value={comment}
                    onChange={(e) => setComment(e.target.value)} />
          <button type="button" className="btn-primary text-xs" disabled={mut.isPending}
                  onClick={() => mut.mutate({ helpful: false, comment })}>
            Отправить
          </button>
        </div>
      )}
    </div>
  )
}
