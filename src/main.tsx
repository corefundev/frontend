import React from 'react'
import ReactDOM from 'react-dom/client'
import { BrowserRouter } from 'react-router-dom'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { Toaster } from 'react-hot-toast'

import App from './App'
import './index.css'

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
              color: '#1A1A1A',
              border: '1px solid #E2E5E5',
              boxShadow: '0 4px 12px rgba(0,43,41,0.08)',
            },
            success: { iconTheme: { primary: '#2E7D32', secondary: '#E6F1E8' } },
            error:   { iconTheme: { primary: '#B03A2E', secondary: '#F7E3E0' } },
          }}
        />
      </BrowserRouter>
    </QueryClientProvider>
  </React.StrictMode>
)
