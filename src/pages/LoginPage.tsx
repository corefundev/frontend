import { useEffect, useMemo, useRef, useState } from 'react'
import { useMutation } from '@tanstack/react-query'
import { Link, useNavigate, useSearchParams } from 'react-router-dom'
import toast from 'react-hot-toast'

import { authApi } from '../features/auth/api'
import { useAuthStore } from '../features/auth/store'
import AuthShell from '../components/AuthShell'
import { PasswordInput } from '../components/PasswordInput'
import { SsoBadges, SsoDivider } from '../components/SsoBadges'
import { errorMessage, tryRefreshToken } from '../shared/api/client'
import { adminUrl, appUrl } from '../shared/hostRouting'

// ─────────────────────────────────────────────────────────────────────────
//  LoginPage — AUTH-3 #447: классический вход email + пароль.
//
//  Флоу владельца: подтверждение почты кодом → пользователь входит СВОИМ
//  паролем (?confirmed=1 с /signup/verify показывает бейдж и подставляет
//  email; ?reset=1 — после смены пароля). Бэкенд ставит httpOnly
//  remember-me куку — возврат в кабинет без пароля (silent refresh).
//  Капча — ПО ТРЕБОВАНИЮ сервера (решение владельца: после 2 неудач):
//  виджет скрыт, пока /auth/login/password не ответит 422
//  «captcha_token is required» — тогда показываем и повторяем.
// ─────────────────────────────────────────────────────────────────────────

const TURNSTILE_SITE_KEY = import.meta.env.VITE_TURNSTILE_SITE_KEY as string | undefined

// #585: гард стухшей-копии — МОДУЛЬНЫЙ (один на загрузку страницы).
// useRef живёт в инстансе компонента: двойной маунт /login давал два
// /auth/refresh подряд (поведенческий verify поймал) — с живой кукой это
// лишняя ротация. Полная перезагрузка страницы сбрасывает модуль — кейс
// «зашёл на /login заново» работает.
let staleCheckDone = false

export default function LoginPage() {
  const nav = useNavigate()
  const setAuth = useAuthStore((s) => s.setAuth)
  const [params] = useSearchParams()

  // #579 → #585 (v2): чек стухшей копии — РОВНО ОДИН РАЗ при маунте
  // страницы, и только для сессии, существовавшей ДО входа через форму.
  // v1 подписывался на isAuthed и срабатывал сразу после успешного
  // логина: лишний /auth/refresh ротировал куку параллельно с редиректом
  // в кабинет, ответ ротации терялся при unload'е → в браузере оставалась
  // отозванная кука → reuse-detection гасил сессию → «не могу
  // авторизоваться» (репро владельца). После входа формой навигацию
  // делает ТОЛЬКО onSuccess; этот эффект к ней не прикасается.
  useEffect(() => {
    if (staleCheckDone) return
    staleCheckDone = true
    if (!useAuthStore.getState().isAuthenticated()) return
    void tryRefreshToken().then((token) => {
      if (token) window.location.replace(appUrl('/app'))
      else useAuthStore.getState().logout()
    })
  }, [])

  const confirmed = params.get('confirmed') === '1'
  const afterReset = params.get('reset') === '1'
  const prefillEmail = useMemo(() => (params.get('email') ?? '').toLowerCase(), [params])

  const [email, setEmail] = useState(prefillEmail)
  const [password, setPassword] = useState('')
  const [captcha, setCaptcha] = useState('')
  const [captchaNeeded, setCaptchaNeeded] = useState(false)
  // 2FA-1 #587 slice C: пароль прошёл, аккаунт защищён — сервер вернул
  // challenge вместо сессии; показываем шаг ввода кода
  const [twofa, setTwofa] = useState<{ challenge: string; methods: string[] } | null>(null)

  const finishLogin = (resp: { access_token: string; client_id: string }) => {
    setAuth(resp.access_token, resp.client_id)
    toast.success(`Добро пожаловать, ${resp.client_id}`)
    // APP-1 (#495): кабинет живёт на app-хосте. ?next= пускаем ТОЛЬКО
    // на свой app-origin (open-redirect guard); иначе — корень кабинета.
    const next = new URLSearchParams(window.location.search).get('next')
    const appRoot = appUrl('/app')
    if (appRoot !== '/app') {                       // брендовый хост
      // open-redirect guard: только свои origin'ы — кабинет и (#124)
      // админ-хост; сессию поддомену передаёт refresh-кука, не URL.
      const ok = next != null
        && (next.startsWith(appUrl('/')) || next.startsWith(adminUrl('/')))
      const target = ok ? next : appRoot
      window.location.replace(target)
      return
    }
    nav('/app', { replace: true })
  }

  const login = useMutation({
    mutationFn: () => authApi.loginPassword({
      email: email.trim().toLowerCase(),
      password,
      captcha_token: captcha || undefined,
    }),
    onSuccess: (resp) => {
      if (resp.twofa_required && resp.challenge) {
        setTwofa({ challenge: resp.challenge, methods: resp.twofa_methods ?? [] })
        return
      }
      finishLogin(resp)
    },
    onError: (e) => {
      // Сервер требует капчу после 2 неудач — показать виджет и не
      // сбрасывать пароль (пользователь просто решает капчу и повторяет).
      const detail = errorMessage(e, '')
      const status = (e as { response?: { status?: number } })?.response?.status
      if (status === 422 && detail.includes('captcha_token')) {
        setCaptchaNeeded(true)
        toast.error('Подтвердите, что вы не робот, и повторите вход')
        return
      }
      setPassword('')
      toast.error(errorMessage(e, 'Не удалось войти'))
    },
  })

  if (twofa) {
    return (
      <AuthShell>
        <TwoFAStep
          challenge={twofa.challenge}
          methods={twofa.methods}
          onDone={finishLogin}
          onBack={() => { setTwofa(null); setPassword('') }}
        />
      </AuthShell>
    )
  }

  return (
    <AuthShell>
      <h1 className="text-[28px] font-bold text-ink text-center">Авторизация</h1>

      {confirmed && (
        <div className="mt-5 rounded-md bg-success-bg text-success px-4 py-2.5 text-sm font-medium text-center">
          ✓ Почта подтверждена — войдите с вашим паролем
        </div>
      )}
      {afterReset && (
        <div className="mt-5 rounded-md bg-success-bg text-success px-4 py-2.5 text-sm font-medium text-center">
          ✓ Пароль изменён — войдите с новым паролем
        </div>
      )}

      <div className="mt-9">
        <SsoBadges />
      </div>
      <SsoDivider label="или" />

      <form
          onSubmit={(e) => {
            e.preventDefault()
            if (!email.trim()) return toast.error('Введите email')
            if (!password) return toast.error('Введите пароль')
            if (captchaNeeded && !captcha) return toast.error('Пройдите captcha')
            login.mutate()
          }}
        >
          <label className="label" htmlFor="email">Емейл</label>
          <input
            id="email"
            type="email"
            className="input"
            placeholder="name@example.com"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            autoComplete="email"
            required
          />

          <label className="label mt-5" htmlFor="password">Введите пароль</label>
          <PasswordInput
            id="password"
            placeholder="Пароль"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            autoComplete="current-password"
            required
          />
          <div className="mt-2">
            <Link to="/forgot" className="text-sm text-brand-500">
              Восстановить пароль
            </Link>
          </div>

          {TURNSTILE_SITE_KEY && captchaNeeded && (
            <div className="mt-5">
              <TurnstileWidget siteKey={TURNSTILE_SITE_KEY} onToken={setCaptcha} />
            </div>
          )}

          <button
            type="submit"
            className="btn-primary block mx-auto px-10 mt-8"
            disabled={login.isPending}
          >
            {login.isPending ? 'Вход…' : 'Авторизоваться'}
          </button>
        </form>

      <p className="text-sm text-ink text-center mt-6 font-medium">
        Нет аккаунта?{' '}
        <Link to="/signup" className="text-brand-500 font-normal">
          Зарегистрируйтесь
        </Link>
      </p>
    </AuthShell>
  )
}

// ── 2FA-1 #587: шаг подтверждения входа кодом ───────────────────────────

function TwoFAStep({ challenge, methods, onDone, onBack }: {
  challenge: string
  methods: string[]
  onDone: (resp: { access_token: string; client_id: string }) => void
  onBack: () => void
}) {
  const [code, setCode] = useState('')
  const emailAvailable = methods.includes('email')

  const verify = useMutation({
    mutationFn: () => authApi.twofaVerify({ challenge, code: code.trim() }),
    onSuccess: onDone,
    onError: (e) => {
      setCode('')
      const status = (e as { response?: { status?: number } })?.response?.status
      // challenge живёт 5 минут — по истечении возвращаем на ввод пароля
      if (status === 401) {
        toast.error('Время подтверждения истекло — войдите ещё раз')
        onBack()
        return
      }
      toast.error(errorMessage(e, 'Код не подошёл'))
    },
  })

  const sendEmail = useMutation({
    mutationFn: () => authApi.twofaEmailCode({ challenge }),
    onSuccess: () => toast.success('Код отправлен на почту'),
    onError: (e) => toast.error(errorMessage(e, 'Не удалось отправить письмо')),
  })

  return (
    <>
      <h1 className="text-[28px] font-bold text-ink text-center">Подтвердите вход</h1>
      <p className="mt-4 text-sm text-ink-muted text-center">
        Аккаунт защищён двухэтапной аутентификацией. Введите код из
        приложения{emailAvailable ? ', письма' : ''} или резервный код.
      </p>
      <form
        className="mt-7"
        onSubmit={(e) => {
          e.preventDefault()
          if (!code.trim()) return toast.error('Введите код')
          verify.mutate()
        }}
      >
        <label className="label" htmlFor="twofa-code">Код подтверждения</label>
        <input
          id="twofa-code"
          className="input text-center text-lg font-semibold tracking-[0.3em]"
          autoComplete="one-time-code"
          autoFocus
          maxLength={16}
          placeholder="000000"
          value={code}
          onChange={(e) => setCode(e.target.value)}
        />
        {emailAvailable && (
          <button
            type="button"
            className="mt-3 text-sm font-medium text-brand-500 hover:underline"
            disabled={sendEmail.isPending}
            onClick={() => sendEmail.mutate()}
          >
            {sendEmail.isPending ? 'Отправляю…' : 'Отправить код на почту'}
          </button>
        )}
        <button
          type="submit"
          className="btn-primary block mx-auto px-10 mt-7"
          disabled={verify.isPending || !code.trim()}
        >
          {verify.isPending ? 'Проверяю…' : 'Подтвердить'}
        </button>
      </form>
      <button
        type="button"
        className="mt-6 block mx-auto text-sm text-ink-muted hover:text-ink"
        onClick={onBack}
      >
        ← Вернуться ко входу
      </button>
    </>
  )
}

// ── Turnstile widget (локальная копия; см. коммент в SignupPage) ────────

function TurnstileWidget({
  siteKey, onToken,
}: {
  siteKey: string
  onToken: (t: string) => void
}) {
  // useEffect-based mount, NOT a callback ref. A callback ref's identity
  // changes on every parent re-render, which makes turnstile.render()
  // fire on every keystroke (severe lag + the widget keeps resetting).
  const elRef = useRef<HTMLDivElement | null>(null)
  const cbRef = useRef(onToken)
  cbRef.current = onToken

  useEffect(() => {
    const el = elRef.current
    if (!el) return

    if (!document.querySelector('script[data-turnstile]')) {
      const s = document.createElement('script')
      s.src = 'https://challenges.cloudflare.com/turnstile/v0/api.js'
      s.async = true; s.defer = true
      s.dataset.turnstile = '1'
      document.head.appendChild(s)
    }

    let widgetId: string | undefined
    let cancelled = false

    const tryRender = () => {
      if (cancelled) return
      const turnstile = window.turnstile
      if (!turnstile) { setTimeout(tryRender, 100); return }
      el.innerHTML = ''
      widgetId = turnstile.render(el, {
        sitekey: siteKey,
        theme: 'light',
        callback: (t: string) => cbRef.current(t),
        'error-callback': () => cbRef.current(''),
        'expired-callback': () => cbRef.current(''),
      })
    }
    tryRender()

    return () => {
      cancelled = true
      const turnstile = window.turnstile
      if (turnstile && widgetId) {
        try { turnstile.remove(widgetId) } catch { /* widget already gone */ }
      }
    }
  }, [siteKey])

  return <div ref={elRef} className="flex justify-center" />
}
