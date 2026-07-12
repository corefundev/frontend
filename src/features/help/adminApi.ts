// HC-3 (#335): админ-API Help Center.
import { apiClient } from '../../shared/api/client'

export type HelpStatus = 'draft' | 'published' | 'archived'

export interface HelpCategoryAdmin {
  id: string
  slug: string
  title: string
  description: string
  icon: string
  sort_order: number
  parent_id: string | null
  published_count?: number
  total_count?: number
}

export interface HelpArticleAdmin {
  id: string
  slug: string
  category_id: string
  title: string
  body_md: string
  body_html: string
  excerpt: string
  status: HelpStatus
  sort_order: number
  seo_title: string
  seo_description: string
  view_count: number
  published_at: string | null
  updated_at: string
}

export interface HelpRevision {
  id: number
  title: string
  body_md: string
  editor_admin_id: string
  created_at: string
}

export interface HelpArticleAnalytics {
  id: string
  slug: string
  title: string
  status: HelpStatus
  view_count: number
  helpful: number
  total: number
  helpful_ratio: number | null
}

export interface HelpFeedbackComment {
  article_id: string
  helpful: boolean
  comment: string
  created_at: string
  slug: string | null
  title: string | null
}

export interface HelpSearchStat {
  query: string
  hits: number
  last_at: string
  avg_results?: number
}

export interface HelpCategoryPayload {
  slug: string
  title: string
  description?: string
  icon?: string
  sort_order?: number
  parent_id?: string | null
}

export interface HelpArticlePayload {
  slug: string
  category_id: string
  title: string
  body_md: string
  excerpt?: string
  sort_order?: number
  seo_title?: string
  seo_description?: string
}

export const helpAdminApi = {
  async categories() {
    const { data } = await apiClient.get<{ categories: HelpCategoryAdmin[] }>(
      '/admin/help/categories')
    return data.categories
  },
  async createCategory(payload: HelpCategoryPayload) {
    const { data } = await apiClient.post<HelpCategoryAdmin>(
      '/admin/help/categories', payload)
    return data
  },
  async updateCategory(id: string, payload: Partial<HelpCategoryPayload>) {
    const { data } = await apiClient.put<HelpCategoryAdmin>(
      `/admin/help/categories/${encodeURIComponent(id)}`, payload)
    return data
  },
  async articles(params: { category_id?: string; status?: HelpStatus }) {
    const { data } = await apiClient.get<{ articles: HelpArticleAdmin[]; count: number }>(
      '/admin/help/articles', { params })
    return data
  },
  async article(id: string) {
    const { data } = await apiClient.get<HelpArticleAdmin>(
      `/admin/help/articles/${encodeURIComponent(id)}`)
    return data
  },
  async createArticle(payload: HelpArticlePayload) {
    const { data } = await apiClient.post<HelpArticleAdmin>(
      '/admin/help/articles', payload)
    return data
  },
  async updateArticle(id: string, payload: Partial<HelpArticlePayload>) {
    const { data } = await apiClient.put<HelpArticleAdmin>(
      `/admin/help/articles/${encodeURIComponent(id)}`, payload)
    return data
  },
  async publish(id: string) {
    const { data } = await apiClient.post<HelpArticleAdmin>(
      `/admin/help/articles/${encodeURIComponent(id)}/publish`)
    return data
  },
  async archive(id: string) {
    const { data } = await apiClient.post<HelpArticleAdmin>(
      `/admin/help/articles/${encodeURIComponent(id)}/archive`)
    return data
  },
  async revisions(id: string) {
    const { data } = await apiClient.get<{ revisions: HelpRevision[] }>(
      `/admin/help/articles/${encodeURIComponent(id)}/revisions`)
    return data.revisions
  },
  async rollback(id: string, revisionId: number) {
    const { data } = await apiClient.post<HelpArticleAdmin>(
      `/admin/help/articles/${encodeURIComponent(id)}/rollback`,
      { revision_id: revisionId })
    return data
  },
  // превью — ТОЛЬКО серверный санитайзер
  async preview(body_md: string) {
    const { data } = await apiClient.post<{ body_html: string }>(
      '/admin/help/preview', { body_md })
    return data.body_html
  },
  // HC-6 (#337): аналитика контента
  async analytics() {
    const { data } = await apiClient.get<{
      articles: HelpArticleAnalytics[]
      comments: HelpFeedbackComment[]
    }>('/admin/help/analytics')
    return data
  },
  // HC-5 (#336): аналитика поиска
  async searchInsights() {
    const { data } = await apiClient.get<{
      top: HelpSearchStat[]
      zero_results: HelpSearchStat[]
    }>('/admin/help/search/insights')
    return data
  },
  async uploadMedia(file: File) {
    const form = new FormData()
    form.append('file', file)
    const { data } = await apiClient.post<{ name: string; url: string; markdown: string }>(
      '/admin/help/media', form,
      { headers: { 'Content-Type': 'multipart/form-data' } })
    return data
  },
}
