// 2FA-1 (#587) slice C — страница «Безопасность → Двухэтапная
// аутентификация» по утверждённому прототипу (twofa_design): статус,
// три строки (приложение-тумблер, письмо-тумблер, резервные коды) и
// модалки подключения. Структура — референс Т-Банка, дизайн наш.
import { useEffect, useState } from 'react'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { Link } from 'react-router-dom'
import toast from 'react-hot-toast'
import QRCode from 'qrcode'

import { errorMessage } from '../../../shared/api/client'
import { useAuthStore } from '../../auth/store'
import { clientsApi } from '../../clients/api'
import { twofaApi, type ReauthPayload } from './api'

// ── иконки строк (стиль SecuritySection: stroke 1.8/1.9, кружок 44px) ────
const IconPhone = (
  <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.9" strokeLinecap="round" strokeLinejoin="round"><rect x="7" y="2" width="10" height="20" rx="2"/><path d="M11 18h2"/></svg>
)
const IconMail = (
  <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.9" strokeLinecap="round" strokeLinejoin="round"><rect x="3" y="5" width="18" height="14" rx="2"/><path d="m3 7 9 6 9-6"/></svg>
)
const IconShieldCheck = (
  <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.9" strokeLinecap="round" strokeLinejoin="round"><path d="M12 3l7 3v5c0 4.5-3 8.5-7 10-4-1.5-7-5.5-7-10V6z"/><path d="m9 12 2 2 4-4"/></svg>
)

// Точный порт switch_4 из референса владельца (codepen MvqpPr, нижний
// правый), масштаб 80×40 → 56×28: радиус 2px, шайба 85% высоты с
// отступом 2px, фирменные SVG-иконки пена белой заливкой ПОД шайбой,
// анимация slide+scale (.35s) при переключении. Цвета — сэмпл владельца.
function Toggle({ on, busy, label, onClick }: {
  on: boolean
  busy?: boolean
  label: string
  onClick: () => void
}) {
  return (
    <button
      type="button"
      role="switch"
      aria-checked={on}
      aria-label={label}
      disabled={busy}
      onClick={onClick}
      className={`relative mt-1 h-7 w-14 shrink-0 rounded-sm transition-colors duration-200 disabled:opacity-60 ${
        on ? 'bg-[#68D78E]' : 'bg-[#3C5D7C]'
      }`}
    >
      <svg
        aria-hidden
        viewBox="0 0 426.67 426.67"
        className={`absolute left-[18%] top-1/2 z-[1] w-[13px] -translate-y-1/2 fill-white transition-all duration-300 ${
          on ? 'translate-x-0 scale-100' : 'translate-x-[190%] scale-0'
        }`}
      >
        <path d="M153.504 366.84c-8.657 0-17.323-3.303-23.927-9.912L9.914 237.265c-13.218-13.218-13.218-34.645 0-47.863 13.218-13.218 34.645-13.218 47.863 0l95.727 95.727 215.39-215.387c13.218-13.214 34.65-13.218 47.86 0 13.22 13.218 13.22 34.65 0 47.863L177.435 356.928c-6.61 6.605-15.27 9.91-23.932 9.91z" />
      </svg>
      <svg
        aria-hidden
        viewBox="0 0 212.982 212.982"
        className={`absolute right-[19%] top-1/2 z-[1] w-[11px] -translate-y-1/2 fill-white transition-all duration-300 ${
          on ? '-translate-x-[190%] scale-0' : 'translate-x-0 scale-100'
        }`}
      >
        <path fillRule="evenodd" clipRule="evenodd" d="M131.804 106.49l75.936-75.935c6.99-6.99 6.99-18.323 0-25.312-6.99-6.99-18.322-6.99-25.312 0L106.49 81.18 30.555 5.242c-6.99-6.99-18.322-6.99-25.312 0-6.99 6.99-6.99 18.323 0 25.312L81.18 106.49 5.24 182.427c-6.99 6.99-6.99 18.323 0 25.312 6.99 6.99 18.322 6.99 25.312 0L106.49 131.8l75.938 75.937c6.99 6.99 18.322 6.99 25.312 0 6.99-6.99 6.99-18.323 0-25.313l-75.936-75.936z" />
      </svg>
      <span
        className={`absolute top-[2px] z-[2] h-6 w-6 rounded-sm bg-[#E1EAEC] transition-all duration-300 ${
          on ? 'left-[calc(100%-26px)]' : 'left-[2px]'
        }`}
      />
    </button>
  )
}

function MethodRow({ icon, tone, title, desc, meta, metaTone, action }: {
  icon: React.ReactNode
  tone: 'blue' | 'green'
  title: string
  desc: string
  meta?: string
  metaTone?: 'ok' | 'dim'
  action: React.ReactNode
}) {
  return (
    <div className="flex items-start gap-4 rounded-lg border border-surface-border p-4 sm:p-5">
      <div className={`flex h-11 w-11 shrink-0 items-center justify-center rounded-full ${
        tone === 'green' ? 'bg-success-bg text-success' : 'bg-brand-50 text-brand-600'
      }`}>
        {icon}
      </div>
      <div className="min-w-0 flex-1">
        <div className="text-[15px] font-semibold text-ink">{title}</div>
        <p className="mt-0.5 max-w-xl text-sm text-ink-muted">{desc}</p>
        {meta && (
          <div className={`mt-1.5 text-[12.5px] font-medium ${
            metaTone === 'ok' ? 'text-success' : 'text-ink-faint'
          }`}>
            {meta}
          </div>
        )}
      </div>
      {action}
    </div>
  )
}

// ── модальная обёртка ────────────────────────────────────────────────────
function Modal({ label, onClose, children, footer }: {
  label: string
  onClose: () => void
  children: React.ReactNode
  footer: React.ReactNode
}) {
  return (
    <div
      className="fixed inset-0 z-50 flex items-start justify-center bg-slate-900/45 p-4 pt-[12vh] backdrop-blur-[2px]"
      role="dialog" aria-modal="true" aria-label={label}
      onMouseDown={(e) => { if (e.target === e.currentTarget) onClose() }}
    >
      <div className="w-full max-w-md overflow-hidden card-paper">
        <div className="px-6 py-5">{children}</div>
        <div className="flex justify-end gap-2.5 border-t border-surface-border bg-surface-muted/50 px-5 py-3.5">
          {footer}
        </div>
      </div>
    </div>
  )
}

// ── подключение приложения: QR → код подтверждения ──────────────────────
function EnrollModal({ clientId, onClose, onDone }: {
  clientId: string
  onClose: () => void
  onDone: () => void
}) {
  const [code, setCode] = useState('')
  const [qr, setQr] = useState<string | null>(null)

  const { data: enroll, error: enrollError } = useQuery({
    queryKey: ['twofa-enroll', clientId],
    queryFn: () => twofaApi.enroll(clientId),
    staleTime: Infinity,
    gcTime: 0,          // закрыли модалку → повторное открытие даст новый секрет
    retry: false,
  })

  useEffect(() => {
    if (!enroll) return
    let alive = true
    QRCode.toDataURL(enroll.otpauth_uri, { margin: 1, width: 220 })
      .then((url) => { if (alive) setQr(url) })
      .catch(() => { if (alive) setQr(null) })   // секрет вводится вручную
    return () => { alive = false }
  }, [enroll])

  const confirm = useMutation({
    mutationFn: () => twofaApi.confirmTotp(clientId, code.trim()),
    onSuccess: () => { toast.success('Приложение подключено'); onDone() },
    onError: (e) => toast.error(errorMessage(e, 'Код не подошёл — проверьте время на телефоне')),
  })

  const secretGrouped = enroll ? enroll.secret.replace(/(.{4})/g, '$1 ').trim() : ''

  return (
    <Modal
      label="Приложение для генерации кодов"
      onClose={onClose}
      footer={
        <>
          <button className="btn-secondary" onClick={onClose}>Отмена</button>
          <button
            className="btn-primary"
            disabled={code.trim().length !== 6 || confirm.isPending}
            onClick={() => confirm.mutate()}
          >
            {confirm.isPending ? 'Проверяю…' : 'Подключить'}
          </button>
        </>
      }
    >
      <div className="text-[17px] font-bold text-ink">Приложение для генерации кодов</div>
      <p className="mt-1 text-sm text-ink-muted">Подключение занимает минуту:</p>
      <ol className="mt-3 space-y-2.5">
        {['Откройте приложение-аутентификатор',
          'Отсканируйте QR-код (или введите ключ вручную)',
          'Введите 6-значный код из приложения'].map((step, i) => (
          <li key={step} className="flex items-center gap-2.5 text-sm text-ink">
            <span className="flex h-[22px] w-[22px] shrink-0 items-center justify-center rounded-full bg-brand-50 text-xs font-bold text-brand-600">
              {i + 1}
            </span>
            {step}
          </li>
        ))}
      </ol>

      {enrollError ? (
        <p className="mt-5 text-center text-sm text-danger">
          {errorMessage(enrollError, 'Не удалось начать подключение — попробуйте позже')}
        </p>
      ) : (
        <>
          <div className="mt-4 flex justify-center">
            {qr ? (
              <img src={qr} alt="QR-код для приложения-аутентификатора"
                   className="rounded-lg border border-surface-border" width={220} height={220} />
            ) : (
              <div className="flex h-[220px] w-[220px] items-center justify-center rounded-lg border border-surface-border text-sm text-ink-faint">
                {enroll ? 'Введите ключ вручную' : 'Готовлю QR-код…'}
              </div>
            )}
          </div>
          {enroll && (
            <div className="mt-3 flex items-center justify-center gap-2">
              <code className="rounded-md border border-surface-border bg-surface px-2.5 py-1.5 font-mono text-xs font-semibold tracking-widest text-ink">
                {secretGrouped}
              </code>
              <button
                type="button"
                className="text-xs font-semibold text-brand-600 hover:underline"
                onClick={() => { navigator.clipboard?.writeText(enroll.secret); toast.success('Ключ скопирован') }}
              >
                копировать
              </button>
            </div>
          )}
          <input
            className="input mt-4 text-center text-lg font-semibold tracking-[0.4em]"
            inputMode="numeric"
            autoComplete="one-time-code"
            placeholder="000000"
            maxLength={6}
            value={code}
            onChange={(e) => setCode(e.target.value.replace(/\D/g, ''))}
            onKeyDown={(e) => {
              if (e.key === 'Enter' && code.trim().length === 6) confirm.mutate()
            }}
            aria-label="Код из приложения"
          />
        </>
      )}
    </Modal>
  )
}

// ── re-auth: подтверждение опасного действия кодом или паролем ──────────
function ReauthModal({ title, desc, confirmLabel, busy, onClose, onConfirm }: {
  title: string
  desc: string
  confirmLabel: string
  busy: boolean
  onClose: () => void
  onConfirm: (reauth: ReauthPayload) => void
}) {
  const [mode, setMode] = useState<'code' | 'password'>('code')
  const [value, setValue] = useState('')

  const submit = () => {
    if (!value.trim()) return
    onConfirm(mode === 'code' ? { code: value.trim() } : { password: value })
  }

  return (
    <Modal
      label={title}
      onClose={onClose}
      footer={
        <>
          <button className="btn-secondary" onClick={onClose}>Отмена</button>
          <button className="btn-primary" disabled={!value.trim() || busy} onClick={submit}>
            {busy ? 'Проверяю…' : confirmLabel}
          </button>
        </>
      }
    >
      <div className="text-[17px] font-bold text-ink">{title}</div>
      <p className="mt-1 text-sm text-ink-muted">{desc}</p>
      <div className="mt-4">
        <label className="label" htmlFor="reauth-value">
          {mode === 'code' ? 'Код из приложения или резервный код' : 'Пароль от аккаунта'}
        </label>
        <input
          id="reauth-value"
          className="input"
          type={mode === 'password' ? 'password' : 'text'}
          autoComplete={mode === 'password' ? 'current-password' : 'one-time-code'}
          value={value}
          onChange={(e) => setValue(e.target.value)}
          onKeyDown={(e) => { if (e.key === 'Enter') submit() }}
        />
        <button
          type="button"
          className="mt-2 text-sm font-medium text-brand-600 hover:underline"
          onClick={() => { setMode((m) => (m === 'code' ? 'password' : 'code')); setValue('') }}
        >
          {mode === 'code' ? 'Подтвердить паролем' : 'Подтвердить кодом'}
        </button>
      </div>
    </Modal>
  )
}

// ── показ свежих резервных кодов (plaintext — один раз) ─────────────────
function BackupCodesModal({ codes, onClose }: { codes: string[]; onClose: () => void }) {
  const download = () => {
    const blob = new Blob(
      [`Sprosly — резервные коды 2FA\nКаждый код работает один раз.\n\n${codes.join('\n')}\n`],
      { type: 'text/plain;charset=utf-8' },
    )
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url
    a.download = 'sprosly-backup-codes.txt'
    a.click()
    URL.revokeObjectURL(url)
  }

  return (
    <Modal
      label="Резервные коды"
      onClose={onClose}
      footer={
        <>
          <button className="btn-secondary" onClick={download}>Скачать .txt</button>
          <button
            className="btn-primary"
            onClick={() => { navigator.clipboard?.writeText(codes.join('\n')); toast.success('Коды скопированы') }}
          >
            Скопировать все
          </button>
        </>
      }
    >
      <div className="text-[17px] font-bold text-ink">Резервные коды</div>
      <p className="mt-1 text-sm text-ink-muted">
        Сохраните эти коды в надёжном месте — после закрытия окна показать их
        снова нельзя. Каждый работает один раз.
      </p>
      <div className="mt-4 grid grid-cols-2 gap-2">
        {codes.map((c) => (
          <code key={c} className="rounded-md border border-surface-border bg-surface px-3 py-2 text-center font-mono text-[13px] font-semibold tracking-wider text-ink">
            {c}
          </code>
        ))}
      </div>
      <div className="mt-3 flex items-start gap-2 rounded-lg bg-warn-bg px-3 py-2.5 text-[12.5px] font-medium text-warn">
        <span aria-hidden>⚠</span>
        Эта генерация отменила все прежние резервные коды.
      </div>
    </Modal>
  )
}

// ── страница ────────────────────────────────────────────────────────────
type Dialog =
  | { kind: 'enroll' }
  | { kind: 'disable-totp' }
  | { kind: 'email-off' }
  | { kind: 'backup-regen' }
  | { kind: 'backup-show'; codes: string[] }
  | null

export default function TwoFAPage() {
  const clientId = useAuthStore((s) => s.clientId)!
  const qc = useQueryClient()
  const [dialog, setDialog] = useState<Dialog>(null)

  const { data: status, isLoading, error } = useQuery({
    queryKey: ['twofa-status', clientId],
    queryFn: () => twofaApi.status(clientId),
  })
  const { data: rec } = useQuery({
    queryKey: ['client', clientId],
    queryFn: () => clientsApi.get(clientId),
  })

  const refresh = () => qc.invalidateQueries({ queryKey: ['twofa-status', clientId] })

  const disableTotp = useMutation({
    mutationFn: (reauth: ReauthPayload) => twofaApi.disableTotp(clientId, reauth),
    onSuccess: () => { toast.success('Приложение отключено'); setDialog(null); refresh() },
    onError: (e) => toast.error(errorMessage(e, 'Подтверждение не прошло')),
  })
  const emailOn = useMutation({
    mutationFn: () => twofaApi.emailToggle(clientId, { enabled: true }),
    onSuccess: () => { toast.success('Способ «письмо на почту» включён'); refresh() },
    onError: (e) => toast.error(errorMessage(e, 'Не удалось включить')),
  })
  const emailOff = useMutation({
    mutationFn: (reauth: ReauthPayload) => twofaApi.emailToggle(clientId, { enabled: false, ...reauth }),
    onSuccess: () => { toast.success('Способ «письмо на почту» отключён'); setDialog(null); refresh() },
    onError: (e) => toast.error(errorMessage(e, 'Подтверждение не прошло')),
  })
  const regenCodes = useMutation({
    mutationFn: (reauth: ReauthPayload) => twofaApi.backupCodes(clientId, reauth),
    onSuccess: (d) => { setDialog({ kind: 'backup-show', codes: d.codes }); refresh() },
    onError: (e) => toast.error(errorMessage(e, 'Подтверждение не прошло')),
  })

  if (isLoading) {
    return <p className="text-sm text-ink-muted">Загружаю настройки…</p>
  }
  if (error || !status) {
    return (
      <p className="text-sm text-danger">
        {errorMessage(error, 'Двухэтапная аутентификация временно недоступна — попробуйте позже')}
      </p>
    )
  }

  return (
    <div>
      <nav className="text-[13px] text-ink-faint" aria-label="Хлебные крошки">
        <Link to="/app/account/security" className="font-medium text-ink-muted hover:text-brand-600">
          Безопасность
        </Link>
        <span className="mx-1.5">/</span>
        Двухэтапная аутентификация
      </nav>
      <h2 className="mt-1 text-[21px] font-semibold tracking-tight text-ink">
        Двухэтапная аутентификация
      </h2>
      <div className={`mt-2 flex items-center gap-2 text-sm font-semibold ${
        status.protected ? 'text-success' : 'text-warn'
      }`}>
        <span className="h-2 w-2 rounded-full bg-current" aria-hidden />
        {status.protected
          ? 'Ваш аккаунт защищён'
          : 'Дополнительная защита отключена — включите хотя бы один способ'}
      </div>

      <div className="mt-6 flex max-w-3xl flex-col gap-3.5">
        <MethodRow
          icon={IconPhone}
          tone="blue"
          title="Приложение для генерации кодов"
          desc="Скачайте любое приложение-аутентификатор (например, Google Authenticator или Яндекс Ключ) и получайте коды без доступа к интернету и сотовой сети."
          meta={status.totp_enabled ? 'Подключено' : 'Не подключено'}
          metaTone={status.totp_enabled ? 'ok' : 'dim'}
          action={
            <Toggle
              on={status.totp_enabled}
              busy={disableTotp.isPending}
              label="Приложение для генерации кодов"
              onClick={() => setDialog({ kind: status.totp_enabled ? 'disable-totp' : 'enroll' })}
            />
          }
        />
        <MethodRow
          icon={IconMail}
          tone="blue"
          title="Письмо на почту"
          desc={`Одноразовый код придёт на почту ${rec?.email ?? 'аккаунта'}.`}
          meta={status.email_enabled ? 'Включено' : 'Резервный способ, если приложение недоступно'}
          metaTone={status.email_enabled ? 'ok' : 'dim'}
          action={
            <Toggle
              on={status.email_enabled}
              busy={emailOn.isPending || emailOff.isPending}
              label="Письмо на почту"
              onClick={() => {
                if (status.email_enabled) setDialog({ kind: 'email-off' })
                else emailOn.mutate()
              }}
            />
          }
        />
        <MethodRow
          icon={IconShieldCheck}
          tone="green"
          title="Резервные коды"
          desc="Создайте и сохраните коды на случай, если у вас не будет доступа к телефону и почте. Каждый код можно использовать только один раз."
          meta={status.backup_left > 0 ? `Осталось ${status.backup_left} из 10 кодов` : undefined}
          metaTone="dim"
          action={
            <button
              className="btn-secondary mt-0.5 shrink-0"
              disabled={!status.protected}
              title={status.protected ? undefined : 'Сначала включите хотя бы один способ 2FA'}
              onClick={() => setDialog({ kind: 'backup-regen' })}
            >
              {status.backup_left > 0 ? 'Создать заново' : 'Создать'}
            </button>
          }
        />
      </div>

      {dialog?.kind === 'enroll' && (
        <EnrollModal
          clientId={clientId}
          onClose={() => setDialog(null)}
          onDone={() => { setDialog(null); refresh() }}
        />
      )}
      {dialog?.kind === 'disable-totp' && (
        <ReauthModal
          title="Отключить приложение?"
          desc="Вход перестанет требовать код из приложения. Подтвердите действие."
          confirmLabel="Отключить"
          busy={disableTotp.isPending}
          onClose={() => setDialog(null)}
          onConfirm={(r) => disableTotp.mutate(r)}
        />
      )}
      {dialog?.kind === 'email-off' && (
        <ReauthModal
          title="Отключить письмо на почту?"
          desc="Одноразовые коды больше не будут приходить на почту. Подтвердите действие."
          confirmLabel="Отключить"
          busy={emailOff.isPending}
          onClose={() => setDialog(null)}
          onConfirm={(r) => emailOff.mutate(r)}
        />
      )}
      {dialog?.kind === 'backup-regen' && (
        <ReauthModal
          title="Резервные коды"
          desc={status.backup_left > 0
            ? 'Новая генерация отменит все прежние коды. Подтвердите действие.'
            : 'Для выпуска кодов подтвердите, что это вы.'}
          confirmLabel="Создать"
          busy={regenCodes.isPending}
          onClose={() => setDialog(null)}
          onConfirm={(r) => regenCodes.mutate(r)}
        />
      )}
      {dialog?.kind === 'backup-show' && (
        <BackupCodesModal codes={dialog.codes} onClose={() => setDialog(null)} />
      )}
    </div>
  )
}
