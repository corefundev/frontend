// src/features/training/api.ts
// POST /clients/{id}/train  |  GET /jobs/{job_id}
// TrainRequest requires data_path (local or s3:// URI)

import { apiClient } from '../../shared/api/client'

export interface TrainRequest {
  data_path: string   // REQUIRED: local path or "s3://bucket/client/raw/data.parquet"
  // Optional — if provided, backend reads the upload manifest to enforce
  // SKU limits per plan. Added in Phase 4.
  upload_id?: string
  // Optional — when true, retrain from scratch on the dedup-UNION of ALL
  // this client's processed uploads (oldest→newest) plus the current one.
  // A full-history incremental retrain: add fresh weeks/months without
  // re-uploading or losing earlier data. The backend gathers the full
  // history itself (R11-#75, Вариант A). Used by the "Дообучить на всей
  // истории" toggle.
  extend_from_history?: boolean
}

export interface TrainResponse {
  client_id: string
  job_id: string | null   // null if ran synchronously (no Redis)
  status: 'queued' | 'completed'
  message: string
}

// rq job statuses: queued | started | finished | failed | unknown
export type JobStatus = 'queued' | 'started' | 'finished' | 'failed' | 'unknown'

export interface JobProgress {
  step: number
  total: number
  label: string
}

export interface JobStatusResponse {
  job_id: string
  status: JobStatus
  result: Record<string, unknown> | null  // metrics when finished
  error: string | null
  enqueued: string
  started: string
  ended: string
  // Written by src/pipeline/train.py:_progress(...) before each stage.
  // null when the worker hasn't reached step 1 yet.
  progress: JobProgress | null
}

// One row from GET /clients/{id}/training-runs.
// Persistent — survives RQ's 24h result_ttl, so users can see history
// for as long as the row stays in sku_training_runs.
export interface TrainingRun {
  run_id:        string
  client_id:     string
  plan:          string
  data_path:     string
  status:        'queued' | 'running' | 'finished' | 'failed'
  job_id:        string | null
  upload_id:     string | null
  enqueued_at:   string
  started_at:    string | null
  ended_at:      string | null
  elapsed_sec:   number | null
  n_skus:        number | null
  n_features:    number | null
  n_rows:        number | null
  wmape:         number | null
  mase:          number | null
  smape:         number | null
  model_path:    string | null
  mlflow_run_id: string | null
  error:         string | null
}

export interface TrainingRunsResponse {
  runs:  TrainingRun[]
  count: number
}

export const trainingApi = {
  // POST /clients/{id}/train
  startTraining: (clientId: string, payload: TrainRequest) =>
    apiClient.post<TrainResponse>(`/clients/${clientId}/train`, payload).then((r) => r.data),

  // GET /jobs/{job_id}
  getJobStatus: (jobId: string) =>
    apiClient.get<JobStatusResponse>(`/jobs/${jobId}`).then((r) => r.data),

  // GET /clients/{id}/training-runs
  listRuns: (clientId: string, limit = 50) =>
    apiClient
      .get<TrainingRunsResponse>(`/clients/${clientId}/training-runs`, { params: { limit } })
      .then((r) => r.data),
}
