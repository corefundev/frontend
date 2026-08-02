// #570 PC-3: клиентский API «Календаря акций» (бэкенд PC-1/PC-3).
import { apiClient } from '../../shared/api/client'

export interface PromoReport {
  rows_total: number
  rows_accepted: number
  rows_rejected: number
  rejected_examples: { line: number; reason: string }[]
  sku_rows?: number
  category_rows?: number
}

export interface PromoCalendarView {
  calendar_id: string
  status: 'pending_review' | 'active' | 'replaced' | 'discarded'
  filename: string
  rows_accepted: number
  date_min: string | null
  date_max: string | null
  report: PromoReport
  uploaded_at: string | null
  applied_at: string | null
}

export interface PromoState {
  active: PromoCalendarView | null
  candidate: PromoCalendarView | null
  last_upload: {
    upload_id: string
    status: string
    error_message: string | null
    filename: string
  } | null
  note: string
}

export interface PromoUpcomingEvent {
  date_from: string
  date_to: string
  name: string | null
}

export const promoCalendarApi = {
  state: (clientId: string, datasetId: string) =>
    apiClient
      .get<PromoState>(`/clients/${clientId}/datasets/${datasetId}/promo-calendar`)
      .then((r) => r.data),
  upload: (clientId: string, datasetId: string, file: File) => {
    const form = new FormData()
    form.append('file', file)
    return apiClient
      .post<{ upload_id: string }>(
        `/clients/${clientId}/datasets/${datasetId}/promo-calendar`, form)
      .then((r) => r.data)
  },
  apply: (clientId: string, datasetId: string, calendarId: string) =>
    apiClient
      .post(`/clients/${clientId}/datasets/${datasetId}/promo-calendar/apply`,
            { calendar_id: calendarId })
      .then((r) => r.data),
  remove: (clientId: string, datasetId: string) =>
    apiClient
      .delete<{ removed: boolean }>(
        `/clients/${clientId}/datasets/${datasetId}/promo-calendar`)
      .then((r) => r.data),
  // шаблон отдаётся с Authorization-заголовком — скачиваем blob'ом
  downloadTemplate: async (clientId: string) => {
    const resp = await apiClient.get(
      `/clients/${clientId}/promo-calendar/template`,
      { responseType: 'blob' })
    const url = URL.createObjectURL(resp.data as Blob)
    const a = document.createElement('a')
    a.href = url
    a.download = 'sprosly-promo-calendar-template.csv'
    a.click()
    URL.revokeObjectURL(url)
  },
  upcoming: (clientId: string, sku: string) =>
    apiClient
      .get<{ events: PromoUpcomingEvent[] }>(
        `/clients/${clientId}/promo-calendar/upcoming`,
        { params: { sku } })
      .then((r) => r.data),
}
