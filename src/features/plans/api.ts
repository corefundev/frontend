// src/features/plans/api.ts
// Matches backend endpoints defined in Phase 4:
//   GET /plans                            (public)
//   GET /clients/{id}/usage               (auth)
import { apiClient } from '../../shared/api/client'

export type PlanId = 'free' | 'start' | 'business'

export interface PlanSpec {
  id: PlanId
  model_display_name: 'Notus' | 'Aether' | 'Chronos'
  display_name: string
  max_skus: number | null                 // null = unlimited
  max_horizon_days: number | null
  training_cooldown_hours: number | null
  config_allowed_keys: string[] | null    // null = everything; [] = nothing
  price_label: string
  // #542-redesign: лимит датасетов приходит из /plans (plans.py all_specs_as_dicts)
  datasets_limit: number
}

export interface ClientUsage {
  client_id: string
  plan: PlanId
  model_display_name: string
  display_name: string
  max_skus: number | null
  max_horizon_days: number | null
  config_allowed_keys: string[] | null
  training_cooldown_hours: number | null
  cooldown_until: string | null           // ISO
  trained_sku_count: number | null
  // Distinct SKU count from the latest processed upload — what's in
  // the catalog right now, even if the user hasn't trained yet.
  current_sku_count: number | null
}

export const plansApi = {
  list: () =>
    apiClient
      .get<{ plans: PlanSpec[] }>('/plans')
      .then((r) => r.data.plans),

  getUsage: (clientId: string) =>
    apiClient
      .get<ClientUsage>(`/clients/${encodeURIComponent(clientId)}/usage`)
      .then((r) => r.data),
}
