// Cloudflare Turnstile global — injected on demand by
// challenges.cloudflare.com/turnstile/v0/api.js (see the TurnstileWidget
// helpers in LoginPage / SignupPage / SignupVerifyPage). Only the members
// those helpers actually call are typed here.
interface TurnstileApi {
  render(
    container: HTMLElement,
    params: {
      sitekey: string
      callback?: (token: string) => void
      'error-callback'?: () => void
      'expired-callback'?: () => void
    },
  ): string | undefined
  remove(widgetId: string): void
  reset(widgetId?: string): void
}

interface Window {
  turnstile?: TurnstileApi
}
