// src/features/uploads/api.ts
// Matches Phase-2 backend endpoints in src/api/uploads.py.
//
//   POST   /clients/{client_id}/uploads        multipart file upload
//   GET    /clients/{client_id}/uploads        list recent uploads
//   GET    /uploads/{upload_id}                single upload status
import { apiClient, uploadClient } from '../../shared/api/client'

export type UploadStatus =
  | 'uploaded'
  | 'scanning'
  | 'scanned_clean'
  | 'infected'
  | 'processing'
  | 'processed'
  | 'processing_failed'

export interface UploadRecord {
  upload_id: string
  client_id: string
  filename: string
  size_bytes: number
  sha256: string
  status: UploadStatus
  scan_result: string | null
  error_message: string | null
  processed_key: string | null
  row_count: number | null
  sku_count: number | null     // distinct SKU count from sandbox manifest
  created_at: string
  updated_at: string
}

export interface UploadAcceptedResponse extends UploadRecord {
  scan_job_id: string | null
}

export const UPLOADS_TERMINAL: UploadStatus[] = [
  'infected',
  'processed',
  'processing_failed',
]

// ── Client-side pre-validation (server does it too) ──────────────────────
export const MAX_UPLOAD_BYTES  = 50 * 1024 * 1024
export const ACCEPTED_EXT      = ['.csv', '.xlsx', '.xlsm'] as const
export const ACCEPT_ATTRIBUTE  =
  '.csv,.xlsx,.xlsm,text/csv,application/vnd.openxmlformats-officedocument.spreadsheetml.sheet'

export function validateUploadClientSide(file: File): string | null {
  if (file.size === 0) return 'Файл пустой'
  if (file.size > MAX_UPLOAD_BYTES) {
    return `Файл превышает ${(MAX_UPLOAD_BYTES / 1024 / 1024).toFixed(0)} МБ`
  }
  const name = file.name.toLowerCase()
  if (!ACCEPTED_EXT.some((ext) => name.endsWith(ext))) {
    return `Разрешены только ${ACCEPTED_EXT.join(', ')}`
  }
  return null
}

export const uploadsApi = {
  upload: (
    clientId: string,
    file: File,
    onProgress?: (pct: number) => void
  ) => {
    const fd = new FormData()
    fd.append('file', file)
    return uploadClient
      .post<UploadAcceptedResponse>(
        `/clients/${encodeURIComponent(clientId)}/uploads`,
        fd,
        {
          onUploadProgress: (evt) => {
            if (evt.total && onProgress) {
              onProgress(Math.round((evt.loaded / evt.total) * 100))
            }
          },
        }
      )
      .then((r) => r.data)
  },

  list: (clientId: string, limit = 50) =>
    apiClient
      .get<UploadRecord[]>(
        `/clients/${encodeURIComponent(clientId)}/uploads`,
        { params: { limit } }
      )
      .then((r) => r.data),

  get: (uploadId: string) =>
    apiClient
      .get<UploadRecord>(`/uploads/${encodeURIComponent(uploadId)}`)
      .then((r) => r.data),
}
