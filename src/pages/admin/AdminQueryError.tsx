// AUD-12 (#364): the operator console must never render a backend failure
// as "empty/healthy". Every admin section's primary query renders THIS on
// isError instead of its empty state — a 503 on the ops dashboard is an
// incident signal, not «Всё спокойно». Enrichment queries (activity
// columns, history sidebars) stay best-effort, mirroring the backend's own
// enrichment discipline.

function IconAlert() {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.75"
         strokeLinecap="round" strokeLinejoin="round" className="h-4 w-4 shrink-0" aria-hidden="true">
      <path d="M10.29 3.86 1.82 18a2 2 0 0 0 1.71 3h16.94a2 2 0 0 0 1.71-3L13.71 3.86a2 2 0 0 0-3.42 0z" />
      <path d="M12 9v4" />
      <path d="M12 17h.01" />
    </svg>
  )
}

export default function AdminQueryError({
  what,
  onRetry,
}: {
  /** What failed to load, in the accusative: «клиентов», «ленту аудита». */
  what: string
  onRetry: () => void
}) {
  return (
    <div
      role="alert"
      className="flex items-center gap-3 rounded-lg bg-danger-bg text-danger px-4 py-3 text-sm"
    >
      <IconAlert />
      <span>Не удалось загрузить {what} — backend недоступен или вернул ошибку.</span>
      <button
        type="button"
        onClick={onRetry}
        className="btn-ghost ml-auto !px-3 !py-1.5 text-danger shrink-0"
      >
        Повторить
      </button>
    </div>
  )
}
