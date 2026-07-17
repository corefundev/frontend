// NEWS-7 (#409): публичная лента новостей — видна без логина.
import PublicLayout from '../components/PublicLayout'
import { NewsFeedList } from '../features/news/NewsComponents'

export default function NewsPage({ basePath = '/news' }: { basePath?: string } = {}) {
  return (
    <PublicLayout>
      <section className="py-12 lg:py-16">
        <div className="mx-auto max-w-3xl px-5 lg:px-8">
          <h1 className="text-3xl font-semibold tracking-tight text-ink">Новости</h1>
          <p className="text-ink-muted mt-2 mb-8">
            Релизы, улучшения точности и плановые работы сервиса.
          </p>
          <NewsFeedList basePath={basePath} />
        </div>
      </section>
    </PublicLayout>
  )
}
