// src/features/plans/useUsage.ts
//
// React Query hook that pulls the authenticated client's plan + usage.
// The topbar badge, the training page, the settings page — all read from
// this single source so the UI state is consistent.
import { useQuery } from '@tanstack/react-query'
import { useAuthStore } from '../auth/store'
import { plansApi, type ClientUsage } from './api'

export function useUsage() {
  const clientId = useAuthStore((s) => s.clientId)
  return useQuery<ClientUsage>({
    queryKey: ['usage', clientId],
    queryFn: () => plansApi.getUsage(clientId!),
    enabled: !!clientId,
    staleTime: 30_000,
    // A training submission invalidates this query — cooldown + counter
    // refresh without the user having to reload.
  })
}
