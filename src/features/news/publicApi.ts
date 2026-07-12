// NEWS-7 (#409): публичное API новостей (+ авторизованные unread/read).
// apiClient сам подставляет Bearer при живой сессии → read-флаги в ленте
// появляются автоматически; для анонима их просто нет.
import { apiClient } from '../../shared/api/client'
import type { NewsCategory, NewsImportance } from './adminApi'

export interface NewsFeedItem {
  id: string
  slug: string
  title: string
  summary: string
  category: NewsCategory
  pinned: boolean
  importance: NewsImportance
  published_at: string | null
  read?: boolean
}

export interface NewsPostPublic extends NewsFeedItem {
  body_html: string
}

export const newsPublicApi = {
  async feed(limit = 20, offset = 0) {
    const { data } = await apiClient.get<{ posts: NewsFeedItem[]; count: number }>(
      '/news', { params: { limit, offset } })
    return data
  },
  async post(slug: string) {
    const { data } = await apiClient.get<NewsPostPublic>(
      `/news/${encodeURIComponent(slug)}`)
    return data
  },
  async unreadCount() {
    const { data } = await apiClient.get<{ unread: number }>('/news/unread-count')
    return data.unread
  },
  async markRead(postId: string) {
    await apiClient.post(`/news/${encodeURIComponent(postId)}/read`)
  },
}
