// NEWS-7 (#409): публичная карточка новости.
import { Link, useParams } from 'react-router-dom'

import PublicLayout from '../components/PublicLayout'
import { NewsPostView } from '../features/news/NewsComponents'

export default function NewsPostPage({ basePath = '/news' }: { basePath?: string } = {}) {
  const { slug = '' } = useParams()
  return (
    <PublicLayout>
      <section className="py-12 lg:py-16">
        <div className="mx-auto max-w-3xl px-5 lg:px-8">
          <Link to={basePath || '/'} className="text-sm text-ink-muted hover:text-ink">← Все новости</Link>
          <div className="mt-4">
            {/* markRead=false: аноним/публичный контекст — отметок нет */}
            <NewsPostView slug={slug} markRead={false} />
          </div>
        </div>
      </section>
    </PublicLayout>
  )
}
