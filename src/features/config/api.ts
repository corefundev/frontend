// src/features/config/api.ts
// Matches backend config endpoints exactly
// GET/PUT/PATCH/DELETE /clients/{id}/config  |  GET /system/config

import { apiClient } from '../../shared/api/client'

export interface ClientConfigResponse {
  client_id: string
  override: Record<string, unknown>
  effective: Record<string, unknown>
  diff: Record<string, { system: unknown; client: unknown }>
}

// Keys client can override — mirrors _ALLOWED_RANGES in config_manager.py
export interface ClientConfigOverride {
  model?: {
    type?: 'lgbm' | 'mimo'
    horizon?: number
    quantiles?: number[]
    n_estimators?: number
    learning_rate?: number
    num_leaves?: number
    min_child_samples?: number
    feature_fraction?: number
    bagging_fraction?: number
  }
  features?: {
    weather?: { enabled?: boolean; latitude?: number; longitude?: number }
    holidays?: { enabled?: boolean; country?: string }
    lags?: number[]
    rolling_windows?: number[]
    calendar?: boolean
    price?: boolean
    promo?: boolean
    stock?: boolean
    // RU FX regressors (ЦБ РФ daily rates). Paid-tier override
    // (plans._START_CONFIG_KEYS); currencies ⊆ {CNY,USD,EUR,BYN,KZT}.
    external_regressors_ru?: { enabled?: boolean; currencies?: string[] }
  }
  anomaly_detection?: { enabled?: boolean; contamination?: number; iqr_factor?: number }
  hpo?: { enabled?: boolean; n_trials?: number; timeout_sec?: number }
  cold_start?: { min_history_days?: number; n_neighbors?: number }
  validation?: { n_splits?: number }
}

export const configApi = {
  get: (clientId: string) =>
    apiClient.get<ClientConfigResponse>(`/clients/${clientId}/config`).then((r) => r.data),

  set: (clientId: string, config: ClientConfigOverride) =>
    apiClient.put<ClientConfigResponse>(`/clients/${clientId}/config`, { config }).then((r) => r.data),

  // Single dot-notation key update e.g. key="model.horizon" value=28
  patch: (clientId: string, key: string, value: unknown) =>
    apiClient.patch<ClientConfigResponse>(`/clients/${clientId}/config`, { key, value }).then((r) => r.data),

  reset: (clientId: string) =>
    apiClient.delete<{ client_id: string; status: string }>(`/clients/${clientId}/config`).then((r) => r.data),

  getSystem: () =>
    apiClient.get<{ system_config: Record<string, unknown> }>('/system/config').then((r) => r.data),
}
