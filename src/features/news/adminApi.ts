// NEWS-6 (#346): админ-API новостей (backend NEWS-2 #342).
import { apiClient } from '../../shared/api/client'

export type NewsCategory = 'release' | 'improvement' | 'maintenance' | 'tip' | 'announcement'
export type NewsStatus = 'draft' | 'published' | 'archived'
export type NewsImportance = 'normal' | 'important'

export interface NewsPostAdmin {
  id: string
  slug: string
  title: string
  summary: string
  body_md: string
  body_html: string
  category: NewsCategory
  status: NewsStatus
  pinned: boolean
  importance: NewsImportance
  publish_at: string | null
  expire_at: string | null
  published_at: string | null
  author_admin_id: string
  created_at: string
  updated_at: string
  live: boolean
}

export interface NewsRevision {
  id: number
  title: string
  body_md: string
  editor_admin_id: string
  created_at: string
}

export interface NewsDraftPayload {
  slug: string
  title: string
  summary?: string
  body_md: string
  category: NewsCategory
  importance?: NewsImportance
  pinned?: boolean
  publish_at?: string | null
  expire_at?: string | null
}

export const newsAdminApi = {
  async list(params: { status?: NewsStatus; category?: NewsCategory; pinned?: boolean }) {
    const { data } = await apiClient.get<{ posts: NewsPostAdmin[]; count: number }>(
      '/admin/news', { params })
    return data
  },
  async get(id: string) {
    const { data } = await apiClient.get<NewsPostAdmin>(`/admin/news/${encodeURIComponent(id)}`)
    return data
  },
  async create(payload: NewsDraftPayload) {
    const { data } = await apiClient.post<NewsPostAdmin>('/admin/news', payload)
    return data
  },
  async update(id: string, payload: Partial<NewsDraftPayload>) {
    const { data } = await apiClient.put<NewsPostAdmin>(
      `/admin/news/${encodeURIComponent(id)}`, payload)
    return data
  },
  async publish(id: string) {
    const { data } = await apiClient.post<NewsPostAdmin & { already_published?: boolean }>(
      `/admin/news/${encodeURIComponent(id)}/publish`)
    return data
  },
  async archive(id: string) {
    const { data } = await apiClient.post<NewsPostAdmin & { already_archived?: boolean }>(
      `/admin/news/${encodeURIComponent(id)}/archive`)
    return data
  },
  async revisions(id: string) {
    const { data } = await apiClient.get<{ revisions: NewsRevision[]; count: number }>(
      `/admin/news/${encodeURIComponent(id)}/revisions`)
    return data
  },
  // превью — ТОЛЬКО серверный санитайзер (клиент Markdown не рендерит)
  async preview(body_md: string) {
    const { data } = await apiClient.post<{ body_html: string }>(
      '/admin/news/preview', { body_md })
    return data.body_html
  },
}

export const CATEGORY_LABELS: Record<NewsCategory, string> = {
  release: 'релиз',
  improvement: 'улучшение',
  maintenance: 'работы',
  tip: 'совет',
  announcement: 'анонс',
}
