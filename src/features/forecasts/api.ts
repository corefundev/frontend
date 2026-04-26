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

// Mirrors PredictRequest from backend
export interface PredictRequest {
  sku: string
  history: HistoryRow[]  // min 30 rows required by backend
  horizon?: number       // 1–28, optional (uses client config default if omitted)
}

// Mirrors PredictResponse from backend
export interface PredictResponse {
  sku: string
  client_id: string
  forecast: number[]       // list of predicted values, length = horizon
  forecast_dates: string[] // ISO date strings, same length as forecast
  horizon: number
  model_source: 'primary' | 'fallback' | 'zero'
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
}
