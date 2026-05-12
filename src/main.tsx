import React from 'react'
import ReactDOM from 'react-dom/client'
import { BrowserRouter } from 'react-router-dom'
import {
  MutationCache,
  QueryCache,
  QueryClient,
  QueryClientProvider,
} from '@tanstack/react-query'
import toast, { Toaster } from 'react-hot-toast'

import App from './App'
import './index.css'
import { errorMessage } from './shared/api/client'

// Global error surface: react-query swallows errors silently otherwise,
// which means a 500 on a background refetch never reaches the user.
// Surface every uncaught query error as a toast so problems are visible
// even on pages whose code-path doesn't have its own onError handler.
//
// Mutation cache catches imperative actions (post/put/delete) — same
// reason. Per-mutation onError still wins; this is the safety net for
// callers that just await and don't bother handling rejection.
//
// 401 is shown by the auth interceptor's redirect, so suppress it here
// to avoid double-toast. 404 on a background poll (e.g. job purged from
// RQ result_ttl) is noise — also skipped.
const isSuppressed = (err: unknown): boolean => {
  const status = (err as { response?: { status?: number } })?.response?.status
  return status === 401 || status === 404
}

const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      retry: (failureCount, error: any) => {
        // Never retry 4xx — those are caller bugs, not flakes.
        const status = error?.response?.status
        if (status && status >= 400 && status < 500) return false
        return failureCount < 2
      },
      refetchOnWindowFocus: false,
      staleTime: 30_000,
    },
  },
  queryCache: new QueryCache({
    onError: (err, query) => {
      if (isSuppressed(err)) return
      // Skip background refetches that already have cached data — the
      // user sees stale data, not an empty page; toasting is overkill.
      if (query.state.data !== undefined) return
      toast.error(errorMessage(err, 'Не удалось загрузить данные'))
    },
  }),
  mutationCache: new MutationCache({
    onError: (err, _vars, _ctx, mutation) => {
      if (isSuppressed(err)) return
      // If the mutation has its own onError, let it speak — don't
      // duplicate the toast.
      if (mutation.options.onError) return
      toast.error(errorMessage(err, 'Действие не выполнилось'))
    },
  }),
})

ReactDOM.createRoot(document.getElementById('root')!).render(
  <React.StrictMode>
    <QueryClientProvider client={queryClient}>
      <BrowserRouter>
        <App />
        <Toaster
          position="top-right"
          toastOptions={{
            className: '!font-sans !text-sm',
            style: {
              background: '#FFFFFF',
              color: '#020817',
              border: '1px solid #E2E8F0',
              boxShadow: '0 4px 6px rgba(0,0,0,0.10), 0 2px 4px rgba(0,0,0,0.06)',
            },
            success: { iconTheme: { primary: '#2E7D32', secondary: '#E6F1E8' } },
            error:   { iconTheme: { primary: '#DC2626', secondary: '#FEF2F2' } },
          }}
        />
      </BrowserRouter>
    </QueryClientProvider>
  </React.StrictMode>
)
