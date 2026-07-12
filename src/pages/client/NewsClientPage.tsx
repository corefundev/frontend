// NEWS-7 (#409): «Новости» в кабинете — та же лента внутри AppLayout;
// открытие поста авто-отмечает прочтение (гасит бейдж).
import { Route, Routes, useParams } from 'react-router-dom'
import { Link } from 'react-router-dom'

import { NewsFeedList, NewsPostView } from '../../features/news/NewsComponents'

function FeedView() {
  return <div className="max-w-3xl"><NewsFeedList basePath="/app/news" /></div>
}

function PostView() {
  const { slug = '' } = useParams()
  return (
    <div className="max-w-3xl space-y-4">
      <Link to="/app/news" className="text-sm text-ink-muted hover:text-ink">← Все новости</Link>
      <NewsPostView slug={slug} markRead />
    </div>
  )
}

export default function NewsClientPage() {
  return (
    <Routes>
      <Route index element={<FeedView />} />
      <Route path=":slug" element={<PostView />} />
    </Routes>
  )
}
