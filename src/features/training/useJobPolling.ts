// src/features/training/useJobPolling.ts
import { useQuery } from '@tanstack/react-query'
import { trainingApi, type JobStatus } from './api'

const TERMINAL: JobStatus[] = ['finished', 'failed', 'unknown']
const POLL_MS = 3000

export function useJobPolling(jobId: string | null) {
  return useQuery({
    queryKey: ['job', jobId],
    queryFn: () => trainingApi.getJobStatus(jobId!),
    enabled: !!jobId,
    refetchInterval: (query) => {
      const status = query.state.data?.status
      if (!status || TERMINAL.includes(status)) return false
      return POLL_MS
    },
    // PjaxLoader filters out silent polls — keeps the top-bar from
    // flashing every 3 sec during an active training. Initial fetch
    // (dataUpdatedAt === 0) is still visible.
    meta: { silent: true },
  })
}
