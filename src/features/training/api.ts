// src/features/training/api.ts
// POST /clients/{id}/train  |  GET /jobs/{job_id}
// TrainRequest requires data_path (local or s3:// URI)

import { apiClient } from '../../shared/api/client'

export interface TrainRequest {
  data_path: string   // REQUIRED: local path or "s3://bucket/client/raw/data.parquet"
  // Optional — if provided, backend reads the upload manifest to enforce
  // SKU limits per plan. Added in Phase 4.
  upload_id?: string
}

export interface TrainResponse {
  client_id: string
  job_id: string | null   // null if ran synchronously (no Redis)
  status: 'queued' | 'completed'
  message: string
}

// rq job statuses: queued | started | finished | failed | unknown
export type JobStatus = 'queued' | 'started' | 'finished' | 'failed' | 'unknown'

export interface JobStatusResponse {
  job_id: string
  status: JobStatus
  result: Record<string, unknown> | null  // metrics when finished
  error: string | null
  enqueued: string
  started: string
  ended: string
}

export const trainingApi = {
  // POST /clients/{id}/train
  startTraining: (clientId: string, payload: TrainRequest) =>
    apiClient.post<TrainResponse>(`/clients/${clientId}/train`, payload).then((r) => r.data),

  // GET /jobs/{job_id}
  getJobStatus: (jobId: string) =>
    apiClient.get<JobStatusResponse>(`/jobs/${jobId}`).then((r) => r.data),
}
