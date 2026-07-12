// src/features/auth/api.ts
// Two parallel auth flows:
//   1. Classic — client_id + api_key → /auth/token → JWT
//   2. Email-OTP (claude.ai-style):
//        a) /auth/signup    → email + desired_client_id + captcha
//        b) /auth/signup/verify → email + 6-digit code → JWT + api_key (one-time)
//        c) /auth/login        → email + captcha
//        d) /auth/login/verify → email + 6-digit code → JWT
import { apiClient } from '../../shared/api/client'

// ── Classic flow ─────────────────────────────────────────────────────────

export interface TokenRequest {
  client_id: string
  secret: string        // API_KEY (per-client) or ADMIN_API_KEY
}
export interface TokenResponse {
  access_token: string
  token_type: string    // "bearer"
}

// ── Email-OTP flow ───────────────────────────────────────────────────────

export interface SignupRequest {
  email: string
  desired_client_id: string
  captcha_token?: string
  // LEG-2 #428: сервер требует явного принятия условий и пишет факт
  // согласия (с версиями документов) в аудит
  accepted_terms: boolean
}
export interface LoginEmailRequest {
  email: string
  captcha_token?: string
}
export interface VerifyOtpRequest {
  email: string
  code: string         // 6 digits
}
export interface OtpAcceptedResponse {
  status: 'otp_sent'
  email: string
  expires_in_minutes: number
}
export interface SignupVerifyResponse {
  client_id: string
  plan: 'free' | 'start' | 'business'
  model_name: string
  api_key: string                 // ⚠ shown once
  access_token: string
  token_type: 'bearer'
  warning: string
}
export interface LoginVerifyResponse {
  client_id: string
  access_token: string
  token_type: 'bearer'
}

export interface OAuthProvider {
  id:           'google' | 'yandex'
  display_name: string         // 'Google' | 'Яндекс'
  start_url:    string         // '/auth/oauth/google/start'
}

export const authApi = {
  // Classic
  login: (payload: TokenRequest) =>
    apiClient.post<TokenResponse>('/auth/token', payload).then((r) => r.data),

  // Email-OTP signup
  signup: (payload: SignupRequest) =>
    apiClient.post<OtpAcceptedResponse>('/auth/signup', payload).then((r) => r.data),
  signupVerify: (payload: VerifyOtpRequest) =>
    apiClient.post<SignupVerifyResponse>('/auth/signup/verify', payload).then((r) => r.data),

  // Email-OTP login
  loginEmail: (payload: LoginEmailRequest) =>
    apiClient.post<OtpAcceptedResponse>('/auth/login', payload).then((r) => r.data),
  loginEmailVerify: (payload: VerifyOtpRequest) =>
    apiClient.post<LoginVerifyResponse>('/auth/login/verify', payload).then((r) => r.data),

  // OAuth providers list — frontend uses this to decide which buttons
  // to render. If the backend has both disabled, no buttons appear.
  oauthProviders: () =>
    apiClient
      .get<{ providers: OAuthProvider[] }>('/auth/oauth/providers')
      .then((r) => r.data.providers),
}
