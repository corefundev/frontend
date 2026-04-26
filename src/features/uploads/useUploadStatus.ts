// src/features/uploads/useUploadStatus.ts
// Poll a single upload until it reaches a terminal state.
import { useQuery } from '@tanstack/react-query'
import {
  UPLOADS_TERMINAL,
  uploadsApi,
  type UploadRecord,
  type UploadStatus,
} from './api'

const POLL_MS = 2_000

export function useUploadStatus(uploadId: string | null) {
  return useQuery<UploadRecord>({
    queryKey: ['upload', uploadId],
    queryFn: () => uploadsApi.get(uploadId!),
    enabled: !!uploadId,
    refetchInterval: (q) => {
      const s = q.state.data?.status as UploadStatus | undefined
      if (!s || UPLOADS_TERMINAL.includes(s)) return false
      return POLL_MS
    },
  })
}
