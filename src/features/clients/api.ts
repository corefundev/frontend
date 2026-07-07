// src/features/clients/api.ts
// Matches backend: GET/POST /clients, GET /clients/{id}, reload
import { apiClient } from '../../shared/api/client'

// Mirrors backend ClientRecord dataclass exactly
export interface ClientRecord {
  client_id: string
  config: Record<string, unknown>   // client override config (deltas only)
  storage_path: string
  created_at: string
  last_trained_at: string | null
  last_mlflow_run_id: string | null
  last_wmape: number | null
  last_mase: number | null
  status: 'registered' | 'training' | 'ready' | 'error'
  model_version: number
  horizon: number
  notes: string | null
  // ── Phase 4 fields ──
  plan: 'free' | 'start' | 'business'
  email?: string | null
  email_verified_at?: string | null
  oauth_provider?: string | null
  // ADM-10 (#278): NULL = active; timestamp = suspended since then.
  suspended_at?: string | null
  training_runs_this_month: number
  training_runs_window_start: string | null
  trained_sku_count: number | null
}

// Mirrors RegisterClientRequest — admin only (POST /clients)
export interface RegisterClientRequest {
  client_id: string
  config?: Record<string, unknown>
  horizon?: number   // 1–28, default 14
  notes?: string
  plan?: 'free' | 'start' | 'business'
}

// Partial update — admin only (PUT /clients/{id})
export interface UpdateClientRequest {
  plan?:    'free' | 'start' | 'business'
  horizon?: number
  notes?:   string
}

export const clientsApi = {
  // Admin: GET /clients
  list: () =>
    apiClient.get<ClientRecord[]>('/clients').then((r) => r.data),

  // Client or Admin: GET /clients/{client_id}
  get: (clientId: string) =>
    apiClient.get<ClientRecord>(`/clients/${clientId}`).then((r) => r.data),

  // Admin: POST /clients (creates new client)
  // Response includes a one-time `api_key` — show once, never refetched.
  register: (payload: RegisterClientRequest) =>
    apiClient.post<RegisterClientResponse>('/clients', payload).then((r) => r.data),

  // Admin: PUT /clients/{id} (update plan / horizon / notes)
  update: (clientId: string, payload: UpdateClientRequest) =>
    apiClient
      .put<ClientRecord>(`/clients/${encodeURIComponent(clientId)}`, payload)
      .then((r) => r.data),

  // Admin or self: POST /clients/{client_id}/api-key/rotate
  // Returns a NEW api_key one-time. Old one is invalidated on the server.
  // ADM-10 (#278): operator suspension — immediate effect, audited server-side.
  suspend: (clientId: string) =>
    apiClient
      .post<{ suspended: boolean }>(`/admin/clients/${encodeURIComponent(clientId)}/suspend`)
      .then((r) => r.data),

  unsuspend: (clientId: string) =>
    apiClient
      .post<{ suspended: boolean }>(`/admin/clients/${encodeURIComponent(clientId)}/unsuspend`)
      .then((r) => r.data),

  rotateApiKey: (clientId: string) =>
    apiClient
      .post<RotateApiKeyResponse>(`/clients/${encodeURIComponent(clientId)}/api-key/rotate`)
      .then((r) => r.data),

  // Admin or self: POST /clients/{client_id}/reload (clears model cache)
  reload: (clientId: string) =>
    apiClient.post<{ client_id: string; status: string }>(`/clients/${clientId}/reload`)
      .then((r) => r.data),
}

// Returned by POST /clients. The `api_key` field is the ONLY time the
// caller will ever see this secret — store it immediately.
export interface RegisterClientResponse {
  client_id:    string
  storage_path: string
  plan:         'free' | 'start' | 'business'
  model_name:   string
  api_key:      string        // ⚠ one-time; cannot be retrieved later
  warning:      string
}

// Returned by POST /clients/{id}/api-key/rotate. Same one-time semantics.
export interface RotateApiKeyResponse {
  client_id: string
  api_key:   string            // ⚠ one-time
  warning:   string
}
