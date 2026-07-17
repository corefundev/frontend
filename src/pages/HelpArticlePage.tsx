// HC-4 (#410): публичная статья базы знаний.
import { useParams } from 'react-router-dom'

import PublicLayout from '../components/PublicLayout'
import { HelpArticleView, HelpSearchBox } from '../features/help/HelpComponents'

export default function HelpArticlePage({ basePath = '/help' }: { basePath?: string } = {}) {
  const { artSlug = '' } = useParams()
  return (
    <PublicLayout>
      <section className="py-12 lg:py-16">
        <div className="mx-auto max-w-5xl px-5 lg:px-8">
          <div className="mb-6"><HelpSearchBox basePath={basePath} /></div>
          <HelpArticleView slug={artSlug} basePath={basePath} />
        </div>
      </section>
    </PublicLayout>
  )
}
