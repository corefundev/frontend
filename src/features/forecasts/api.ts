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

// CONTRACT-batch (backend #186): the batch endpoint is PARTIAL-SUCCESS.
// Each slot (in request order) is either the normal single-predict payload
// or an error envelope for that item alone — one bad SKU no longer fails
// the whole batch. Narrow with `'error' in item` before reading fields.
export interface BatchItemError {
  error: {
    status: number
    detail: string
  }
}

export interface BatchPredictResponse {
  client_id: string
  results: (PredictResponse | BatchItemError)[]
  count: number
  succeeded: number
  failed: number
}

// One per-SKU forecast track returned by GET /clients/{id}/forecasts.
// `values[i]` is the predicted sales for the date at the same index in
// the response's [first_date..last_date] range. `null` means "no point
// for this date" — never seen in current backend, included for safety.
// `p10` / `p90` are the 80% confidence band (added in backend v0.8.26).
// They may be null per-point when the model lacks quantile sub-models
// (e.g. fallback) or when the row was produced before the migration.
export interface ForecastSku {
  sku:    string
  values: (number | null)[]
  p10?:   (number | null)[]
  p90?:   (number | null)[]
}

// GET /clients/{id}/forecasts — produced automatically after every
// successful training run; the user doesn't trigger this manually.
export interface ForecastsResponse {
  client_id:    string
  generated_at: string | null
  first_date:   string | null
  last_date:    string | null
  horizon_days: number
  count:        number
  skus:         ForecastSku[]
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

  // GET /clients/{id}/forecasts — read-only viewer endpoint
  listForecasts: (clientId: string) =>
    apiClient
      .get<ForecastsResponse>(`/clients/${clientId}/forecasts`)
      .then((r) => r.data),
}
