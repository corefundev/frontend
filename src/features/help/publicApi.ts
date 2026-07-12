// HC-4 (#410): публичное API базы знаний — всё доступно без логина.
import { apiClient } from '../../shared/api/client'

export interface HelpCategoryPublic {
  slug: string
  title: string
  description: string
  icon: string
  articles_count?: number
}

export interface HelpTeaser {
  slug: string
  title: string
  excerpt: string
}

export interface HelpCrumb {
  slug: string
  title: string
}

export interface HelpCategoryView extends HelpCategoryPublic {
  breadcrumbs: HelpCrumb[]
  articles: HelpTeaser[]
}

export interface HelpArticlePublic {
  slug: string
  title: string
  excerpt: string
  body_html: string
  seo_title: string
  seo_description: string
  published_at: string | null
  updated_at: string
  breadcrumbs: HelpCrumb[]
  related: HelpTeaser[]
}

// сниппет несёт сентинелы [[…]] вместо HTML — рендерим текстом (<mark>
// ставит фронт), сервер разметку не собирает
export interface HelpSearchHit extends HelpTeaser {
  snippet: string
}

export const helpPublicApi = {
  async categories() {
    const { data } = await apiClient.get<{ categories: HelpCategoryPublic[]; count: number }>(
      '/help/categories')
    return data.categories
  },
  async category(slug: string) {
    const { data } = await apiClient.get<HelpCategoryView>(
      `/help/categories/${encodeURIComponent(slug)}`)
    return data
  },
  async article(slug: string) {
    const { data } = await apiClient.get<HelpArticlePublic>(
      `/help/articles/${encodeURIComponent(slug)}`)
    return data
  },
  async search(q: string) {
    const { data } = await apiClient.get<{ query: string; count: number; results: HelpSearchHit[] }>(
      '/help/search', { params: { q } })
    return data
  },
  async feedback(slug: string, helpful: boolean, comment?: string) {
    const { data } = await apiClient.post<{ recorded: boolean }>(
      `/help/articles/${encodeURIComponent(slug)}/feedback`,
      { helpful, ...(comment?.trim() ? { comment: comment.trim() } : {}) })
    return data.recorded
  },
}
