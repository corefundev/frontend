// src/components/OAuthButtons.tsx
//
// Renders one button per enabled OAuth provider, fetched at mount time
// from `GET /auth/oauth/providers`. The endpoint returns nothing if
// both providers are disabled — in that case this component renders
// null and the surrounding form looks the same as before OAuth shipped.
//
// Each button is a top-level `<a>` (NOT a fetch call) — clicking it
// navigates the browser to the backend's /auth/oauth/{provider}/start
// endpoint, which 302's to Google/Yandex.

import { useQuery } from '@tanstack/react-query'

import { authApi, type OAuthProvider } from '../features/auth/api'
import { BASE_URL } from '../shared/api/client'

export function OAuthButtons() {
  const { data: providers = [], isLoading } = useQuery({
    queryKey: ['oauth-providers'],
    queryFn:  () => authApi.oauthProviders(),
    staleTime: 5 * 60_000,         // re-fetch on next page load only
    retry: 1,
  })

  if (isLoading) return null
  if (!providers.length) return null

  return (
    <div className="space-y-2">
      <div className="flex items-center gap-3 text-xs text-ink-subtle">
        <div className="flex-1 h-px bg-surface-border" />
        <span>или продолжить с</span>
        <div className="flex-1 h-px bg-surface-border" />
      </div>
      <div className="grid grid-cols-1 gap-2">
        {providers.map((p) => (
          <ProviderButton key={p.id} provider={p} />
        ))}
      </div>
    </div>
  )
}

function ProviderButton({ provider }: { provider: OAuthProvider }) {
  // Anchor → full page navigation. We must hit the BACKEND host, not
  // the frontend host, because that's where the redirect handler lives.
  const href = `${BASE_URL}${provider.start_url}`
  return (
    <a
      href={href}
      className={[
        'btn-secondary w-full justify-center',
        'border border-surface-border',
        'hover:bg-surface-muted',
      ].join(' ')}
    >
      <ProviderLogo provider={provider.id} />
      <span>Продолжить с {provider.display_name}</span>
    </a>
  )
}

function ProviderLogo({ provider }: { provider: OAuthProvider['id'] }) {
  if (provider === 'google') {
    return (
      // Google's official "G" mark — multi-color, public asset.
      <svg viewBox="0 0 18 18" className="h-4 w-4 shrink-0" aria-hidden>
        <path fill="#4285F4" d="M17.64 9.2c0-.64-.06-1.25-.16-1.84H9v3.48h4.84a4.14 4.14 0 0 1-1.8 2.71v2.26h2.91c1.7-1.57 2.69-3.88 2.69-6.61z"/>
        <path fill="#34A853" d="M9 18c2.43 0 4.47-.81 5.96-2.18l-2.91-2.26c-.81.54-1.84.86-3.05.86-2.34 0-4.32-1.58-5.03-3.71H.96v2.34A8.997 8.997 0 0 0 9 18z"/>
        <path fill="#FBBC05" d="M3.97 10.71a5.41 5.41 0 0 1 0-3.42V4.95H.96a9.005 9.005 0 0 0 0 8.1l3.01-2.34z"/>
        <path fill="#EA4335" d="M9 3.58c1.32 0 2.5.45 3.44 1.35l2.58-2.58A8.99 8.99 0 0 0 9 0 8.997 8.997 0 0 0 .96 4.95l3.01 2.34C4.68 5.16 6.66 3.58 9 3.58z"/>
      </svg>
    )
  }
  if (provider === 'yandex') {
    // Yandex's red square with stylised "Я". Public mark.
    return (
      <svg viewBox="0 0 24 24" className="h-4 w-4 shrink-0" aria-hidden>
        <rect width="24" height="24" rx="4" fill="#FC3F1D"/>
        <path
          fill="#fff"
          d="M14.61 18.94h2.16V5.06h-3.14c-3.16 0-4.82 1.62-4.82 4.01 0 1.91.91 3.04 2.53 4.19l-2.81 5.68h2.34l3.14-6.27-1.09-.73c-1.32-.89-1.96-1.58-1.96-3.06 0-1.3.92-2.18 2.69-2.18h.96v12.24z"
        />
      </svg>
    )
  }
  return null
}
