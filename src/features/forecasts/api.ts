// src/features/forecasts/api.ts
// POST /clients/{id}/predict  |  POST /clients/{id}/predict/batch
// Backend requires history: list[dict] with min 30 rows

import { apiClient } from '../../shared/api/client'

// One row of sales history — backend expects: date, sales, plus optional price/promo/stock
export interface HistoryRow {
  date: string          // ISO date string "2024-01-15"
  sales: number         // required target column
  price?: number
  promo?: number        // 0 or 1
  stock?: number
}

// Mirrors PredictRequest from backend.
// Either `history` (>=30 rows) or `upload_id` must be provided —
// when upload_id is set, the backend reads history from the processed
// parquet for that upload and ignores `history`.
export interface PredictRequest {
  sku: string
  history?: HistoryRow[]
  upload_id?: string
  horizon?: number
}

// One row in the upload's SKU catalogue, returned by
// GET /clients/{id}/uploads/{upload_id}/skus.
export interface UploadSku {
  sku:        string
  row_count:  number
  first_date: string
  last_date:  string
}

export interface UploadSkusResponse {
  upload_id: string
  count:     number
  skus:      UploadSku[]
}

// Mirrors PredictResponse from backend
export interface PredictResponse {
  sku: string
  client_id: string
  forecast: number[]       // list of predicted values, length = horizon
  forecast_dates: string[] // ISO date strings, same length as forecast
  horizon: number
  model_source: 'primary' | 'fallback' | 'zero'
  // Display name of the model that produced the forecast (e.g.
  // "LightGBM v3" or "SeasonalNaive fallback"). Set by backend.
  model_name?: string
  // Set when the requested horizon was clamped down to the plan's limit;
  // backend returns the original ask + the cap so the UI can warn.
  horizon_limited_by_plan?: boolean
  horizon_requested?: number
  horizon_max?: number
}

// Batch: up to 100 requests
export interface BatchPredictRequest {
  requests: PredictRequest[]
}

export interface BatchPredictResponse {
  client_id: string
  results: PredictResponse[]
  count: number
}

export const forecastsApi = {
  predict: (clientId: string, payload: PredictRequest) =>
    apiClient.post<PredictResponse>(`/clients/${clientId}/predict`, payload).then((r) => r.data),

  batchPredict: (clientId: string, payload: BatchPredictRequest) =>
    apiClient.post<BatchPredictResponse>(`/clients/${clientId}/predict/batch`, payload)
      .then((r) => r.data),

  // GET /clients/{id}/uploads/{upload_id}/skus — populates the SKU
  // dropdown after the user picks a processed upload.
  listUploadSkus: (clientId: string, uploadId: string) =>
    apiClient
      .get<UploadSkusResponse>(`/clients/${clientId}/uploads/${uploadId}/skus`)
      .then((r) => r.data),
}
