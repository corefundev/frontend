// HC-4 (#410): публичная страница категории базы знаний.
import { useQuery } from '@tanstack/react-query'
import { Link, useParams } from 'react-router-dom'

import PublicLayout from '../components/PublicLayout'
import {
  HelpBreadcrumbs, HelpSearchBox, HelpTeaserList,
} from '../features/help/HelpComponents'
import { helpPublicApi } from '../features/help/publicApi'

export default function HelpCategoryPage() {
  const { catSlug = '' } = useParams()
  const { data: cat, isLoading, isError } = useQuery({
    queryKey: ['help-category', catSlug],
    queryFn: () => helpPublicApi.category(catSlug),
  })
  return (
    <PublicLayout>
      <section className="py-12 lg:py-16">
        <div className="mx-auto max-w-4xl px-5 lg:px-8">
          <div className="mb-6"><HelpSearchBox basePath="/help" /></div>
          {isLoading ? (
            <div className="h-32 rounded-lg bg-surface-muted animate-pulse" />
          ) : isError || !cat ? (
            <p className="text-sm text-ink-muted">
              Категория не найдена.{' '}
              <Link to="/help" className="text-brand-600 hover:underline">К базе знаний</Link>
            </p>
          ) : (
            <>
              <HelpBreadcrumbs crumbs={cat.breadcrumbs.slice(0, -1)} basePath="/help" />
              <h1 className="text-2xl font-semibold tracking-tight text-ink mt-3">
                {cat.icon && <span className="mr-2">{cat.icon}</span>}{cat.title}
              </h1>
              {cat.description && <p className="text-ink-muted mt-1">{cat.description}</p>}
              <div className="mt-6">
                <HelpTeaserList items={cat.articles} basePath="/help" />
              </div>
            </>
          )}
        </div>
      </section>
    </PublicLayout>
  )
}
