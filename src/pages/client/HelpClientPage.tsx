// HC-4 (#410): «Помощь» в кабинете — тот же центр внутри AppLayout.
// h1 не дублируем: AppLayout уже рендерит pageTitle (см. память
// applayout-pagetitle).
import { useQuery } from '@tanstack/react-query'
import { Link, Route, Routes, useParams } from 'react-router-dom'

import {
  HelpArticleView, HelpBreadcrumbs, HelpCategoriesGrid, HelpSearchBox,
  HelpTeaserList,
} from '../../features/help/HelpComponents'
import { helpPublicApi } from '../../features/help/publicApi'

const BASE = '/app/help'

function IndexView() {
  return (
    <div className="max-w-5xl space-y-6">
      <HelpSearchBox basePath={BASE} />
      <HelpCategoriesGrid basePath={BASE} />
    </div>
  )
}

function CategoryView() {
  const { catSlug = '' } = useParams()
  const { data: cat, isLoading, isError } = useQuery({
    queryKey: ['help-category', catSlug],
    queryFn: () => helpPublicApi.category(catSlug),
  })
  return (
    <div className="max-w-4xl space-y-4">
      <HelpSearchBox basePath={BASE} />
      {isLoading ? (
        <div className="h-32 rounded-lg bg-surface-muted animate-pulse" />
      ) : isError || !cat ? (
        <p className="text-sm text-ink-muted">
          Категория не найдена.{' '}
          <Link to={BASE} className="text-brand-600 hover:underline">К базе знаний</Link>
        </p>
      ) : (
        <div>
          <HelpBreadcrumbs crumbs={cat.breadcrumbs.slice(0, -1)} basePath={BASE} />
          <h2 className="text-xl font-semibold tracking-tight text-ink mt-2">
            {cat.icon && <span className="mr-2">{cat.icon}</span>}{cat.title}
          </h2>
          {cat.description && <p className="text-ink-muted mt-1 text-sm">{cat.description}</p>}
          <div className="mt-4">
            <HelpTeaserList items={cat.articles} basePath={BASE} />
          </div>
        </div>
      )}
    </div>
  )
}

function ArticleView() {
  const { artSlug = '' } = useParams()
  return (
    <div className="max-w-5xl space-y-4">
      <HelpSearchBox basePath={BASE} />
      <HelpArticleView slug={artSlug} basePath={BASE} />
    </div>
  )
}

export default function HelpClientPage() {
  return (
    <Routes>
      <Route index element={<IndexView />} />
      <Route path="a/:artSlug" element={<ArticleView />} />
      <Route path=":catSlug" element={<CategoryView />} />
    </Routes>
  )
}
