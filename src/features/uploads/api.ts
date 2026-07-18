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
  // DS-2 (#467): целевой датасет (null = загрузка вне датасета)
  dataset_id: string | null
  created_at: string
  updated_at: string
}

export interface UploadAcceptedResponse extends UploadRecord {
  scan_job_id: string | null
}

export interface PrepareAcceptedResponse {
  upload_id: string
  status: string
  job_id: string | null
}

// ── Client-side pre-validation (server does it too) ──────────────────────
export const MAX_UPLOAD_BYTES  = 50 * 1024 * 1024
export const ACCEPTED_EXT      = ['.csv', '.xlsx', '.xlsm'] as const
export const ACCEPT_ATTRIBUTE  =
  '.csv,.xlsx,.xlsm,text/csv,application/vnd.openxmlformats-officedocument.spreadsheetml.sheet'

// Never surface raw parser/sandbox internals (Python tracebacks, file paths,
// CLI usage) to the client — reconnaissance risk + confusing. Show a clean,
// actionable message instead. The backend also sanitizes error_message at the
// source; this is defence-in-depth for older rows and any edge.
const _LEAKY_ERROR = /traceback|\/sandbox|\/opt|\/usr|\.py\b|errno|usage:|secure_parser|sandbox|permission denied/i
export function safeUploadError(msg: string | null | undefined): string {
  const GENERIC =
    'Не удалось подготовить файл. Проверьте, что это корректный CSV или Excel ' +
    'с колонками даты, товара и продаж, и загрузите заново.'
  const s = (msg ?? '').trim()
  if (!s || s.length > 240 || _LEAKY_ERROR.test(s)) return GENERIC
  return s
}

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
    onProgress?: (pct: number) => void,
    datasetId?: string
  ) => {
    const fd = new FormData()
    fd.append('file', file)
    // DS-2 (#467): нацелить загрузку на датасет — после «Подготовить»
    // worker сам доложит файл в него.
    if (datasetId) fd.append('dataset_id', datasetId)
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

  // User-initiated cancel. Backend best-effort-cleans up S3 in all 3
  // zones and removes the registry row. Idempotent (204 on missing too).
  cancel: (uploadId: string) =>
    apiClient
      .delete(`/uploads/${encodeURIComponent(uploadId)}`)
      .then(() => undefined),

  // DP-5 (frontend #32): «Подготовить» trigger — starts sniff + system auto-mapping +
  // parse. Valid only from `scanned_clean` (409 otherwise).
  prepare: (clientId: string, uploadId: string) =>
    apiClient
      .post<PrepareAcceptedResponse>(
        `/clients/${encodeURIComponent(clientId)}/uploads/${encodeURIComponent(uploadId)}/prepare`,
      )
      .then((r) => r.data),

}
