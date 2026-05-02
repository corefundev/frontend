// src/features/anomalies/api.ts
// GET /clients/{id}/anomalies — list of (sku, date, value) the
// SalesAnomalyDetector flagged during the latest training run.
// Capped to last 90 days of dataset history on the backend.

import { apiClient } from '../../shared/api/client'

export interface AnomalyRow {
  sku:           string
  anomaly_date:  string   // ISO YYYY-MM-DD
  value:         number
  run_id:        string | null
  detected_at:   string   // ISO timestamp with tz
}

export interface AnomaliesResponse {
  client_id: string
  count:     number
  anomalies: AnomalyRow[]
}

export const anomaliesApi = {
  list: (clientId: string, sku?: string) =>
    apiClient
      .get<AnomaliesResponse>(`/clients/${clientId}/anomalies`, {
        params: sku ? { sku } : undefined,
      })
      .then((r) => r.data),
}
