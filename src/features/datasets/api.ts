// src/features/datasets/api.ts
// DS-2 (#467) — раздел «Данные»: датасеты как центр данных клиента.
// Matches backend src/api/routers/datasets.py.
import { apiClient } from '../../shared/api/client'
import type { UploadStatus } from '../uploads/api'

// Карточка модели датасета (null = модель ещё не обучена).
export interface DatasetModel {
  trained_at: string | null
  dataset_version: number | null
  wmape: number | null
  wmape_order_7: number | null
  wmape_order_14: number | null
  baseline_wmape: number | null
  improvement_vs_naive: number | null
  // MA-2 #520: распределение по товарам (медиана/худшие 10%) + охват оценки
  wmape_median: number | null
  wmape_p90: number | null
  eval_coverage: number | null
  up_to_date: boolean | null
}

export interface DatasetView {
  dataset_id: string
  name: string
  current_version: number
  created_at: string
  updated_at: string
  files: number
  row_count: number
  sku_count: number
  date_min: string | null
  date_max: string | null
  fingerprint: string | null
  model: DatasetModel | null
}

export interface DatasetFileRow {
  upload_id: string
  added_at: string
  filename: string | null
  status: UploadStatus | 'deleted'
  row_count: number | null
  merge_added: number | null
  merge_replaced: number | null
  date_min: string | null
  date_max: string | null
}

export interface DatasetVersionRow {
  version: number
  status: 'ready' | 'failed'
  fingerprint: string | null
  row_count: number | null
  sku_count: number | null
  date_min: string | null
  date_max: string | null
  merge_report: Record<string, unknown> | null
  created_at: string
}

export interface DatasetPendingUpload {
  upload_id: string
  filename: string
  status: UploadStatus
  row_count: number | null
  date_min: string | null
  date_max: string | null
  created_at: string
}

export interface DatasetDetail extends DatasetView {
  files_detail: DatasetFileRow[]
  versions: DatasetVersionRow[]
  pending_uploads: DatasetPendingUpload[]
}

export interface DatasetTrainAccepted {
  dataset_id: string
  dataset_version: number
  run_id: string | null
  job_id: string | null
  status: 'queued'
}

// «Точность для заказа» на экранах — процент из WMAPE суммы окна.
export function orderAccuracyPct(wmapeOrder: number | null | undefined): number | null {
  if (wmapeOrder == null || !isFinite(wmapeOrder)) return null
  return Math.max(0, Math.round((1 - wmapeOrder) * 100))
}

export const datasetsApi = {
  list: (clientId: string) =>
    apiClient
      .get<{ datasets: DatasetView[] }>(
        `/clients/${encodeURIComponent(clientId)}/datasets`,
      )
      .then((r) => r.data.datasets),

  get: (clientId: string, datasetId: string) =>
    apiClient
      .get<DatasetDetail>(
        `/clients/${encodeURIComponent(clientId)}/datasets/${encodeURIComponent(datasetId)}`,
      )
      .then((r) => r.data),

  create: (clientId: string, name: string) =>
    apiClient
      .post<DatasetView>(
        `/clients/${encodeURIComponent(clientId)}/datasets`,
        { name },
      )
      .then((r) => r.data),

  train: (clientId: string, datasetId: string) =>
    apiClient
      .post<DatasetTrainAccepted>(
        `/clients/${encodeURIComponent(clientId)}/datasets/${encodeURIComponent(datasetId)}/train`,
      )
      .then((r) => r.data),
}
