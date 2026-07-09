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

export function useUploadStatus(
  uploadId: string | null,
  opts?: { pollThroughScannedClean?: boolean },
) {
  // By default `scanned_clean` is a REST state (the file waits for the user to
  // run «Подготовить») so polling stops there. The onboarding wizard auto-runs
  // prep, so it opts to keep polling THROUGH scanned_clean until `processed`.
  const pollThrough = opts?.pollThroughScannedClean ?? false
  return useQuery<UploadRecord>({
    queryKey: ['upload', uploadId],
    queryFn: () => uploadsApi.get(uploadId!),
    enabled: !!uploadId,
    refetchInterval: (q) => {
      const s = q.state.data?.status as UploadStatus | undefined
      if (!s || UPLOADS_TERMINAL.includes(s)) return false
      if (s === 'scanned_clean' && !pollThrough) return false
      return POLL_MS
    },
    // PjaxLoader-silent — see PjaxLoader.tsx predicate.
    meta: { silent: true },
  })
}
