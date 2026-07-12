// src/features/legal/api.ts
//
// Thin wrapper around /legal/{doc_id} (public GET) and
// /admin/legal/{doc_id} (admin PUT). Used by:
//   • /privacy public page — fetches the privacy doc
//   • /app/admin/legal     — admin editor

import { apiClient } from '../../shared/api/client'

export interface LegalDocument {
  doc_id:     string
  title:      string
  content:    string
  version:    number
  updated_at: string         // ISO timestamp
  // LEG-3 #431: с какой версии требуется пере-согласие (null = не требовалось)
  reconsent_required_since?: number | null
  change_summary?: string | null
}

export const legalApi = {
  get: (docId: string) =>
    apiClient.get<LegalDocument>(`/legal/${docId}`).then((r) => r.data),

  update: (docId: string, payload: {
    title: string; content: string
    requires_reconsent?: boolean; change_summary?: string
  }) =>
    apiClient.put<Omit<LegalDocument, 'content'>>(
      `/admin/legal/${docId}`,
      payload,
    ).then((r) => r.data),
}
