import { useEffect, useMemo, useRef, useState } from 'react'
import { useMutation, useQueryClient } from '@tanstack/react-query'
import { Link, useNavigate } from 'react-router-dom'
import toast from 'react-hot-toast'

import { useAuthStore } from '../features/auth/store'
import { useUsage } from '../features/plans/useUsage'
import {
  ACCEPT_ATTRIBUTE,
  MAX_UPLOAD_BYTES,
  safeUploadError,
  uploadsApi,
  validateUploadClientSide,
} from '../features/uploads/api'
import { useUploadStatus } from '../features/uploads/useUploadStatus'
import { errorMessage } from '../shared/api/client'

// ─────────────────────────────────────────────────────────────────────────
//  OnboardingPage — "first value in under five minutes".
//
//  Three-step full-screen wizard (no sidebar, no topbar):
//    1. Welcome    — who we are, what's about to happen
//    2. Upload     — giant dropzone, sample CSV link
//    3. Processing — pipeline animation → first metrics card
//
//  Design: paper-warm, editorial, intentionally slower paced than the
//  main app. The user has just landed. Give them a sense of care.
// ─────────────────────────────────────────────────────────────────────────

type Step = 1 | 2 | 3

export default function OnboardingPage() {
  const clientId = useAuthStore((s) => s.clientId)
  const nav      = useNavigate()
  const { data: usage } = useUsage()

  const [step, setStep] = useState<Step>(1)
  const [uploadId, setUploadId] = useState<string | null>(null)
  const [progress, setProgress] = useState(0)
  const fileInputRef = useRef<HTMLInputElement>(null)
  const qc = useQueryClient()

  const { data: upload } = useUploadStatus(uploadId, { pollThroughScannedClean: true })

  // In the onboarding wizard the user is actively being set up, so we trigger
  // «Подготовить» automatically once the file passes the security check —
  // keeping the guided flow moving to `processed` without an extra step. (The
  // regular Uploads flow is user-initiated; this auto-trigger is onboarding-
  // only.) Invalidating the status query resumes polling past `scanned_clean`.
  const preparedRef = useRef(false)
  useEffect(() => {
    if (upload?.status === 'scanned_clean' && uploadId && clientId && !preparedRef.current) {
      preparedRef.current = true
      uploadsApi
        .prepare(clientId, uploadId)
        .then(() => qc.invalidateQueries({ queryKey: ['upload', uploadId] }))
        .catch(() => { preparedRef.current = false })   // allow a retry on failure
    }
  }, [upload?.status, uploadId, clientId, qc])

  const { mutateAsync: doUpload, isPending: uploading } = useMutation({
    mutationFn: (file: File) =>
      uploadsApi.upload(clientId!, file, setProgress),
    onSuccess: (rec) => {
      setUploadId(rec.upload_id)
      setStep(3)
    },
    onError: (e) => {
      setProgress(0)
      toast.error(errorMessage(e, 'Не удалось загрузить файл'))
    },
  })

  async function handlePickFile(file: File | null) {
    if (!file) return
    const err = validateUploadClientSide(file)
    if (err) {
      toast.error(err)
      if (fileInputRef.current) fileInputRef.current.value = ''
      return
    }
    setProgress(0)
    await doUpload(file)
  }

  if (!clientId) {
    nav('/login')
    return null
  }

  return (
    <div className="min-h-screen bg-surface flex flex-col">
      <TopStrip step={step} />

      <main className="flex-1 flex items-center justify-center p-6 sm:p-10">
        <div className="w-full max-w-3xl">
          {step === 1 && (
            <WelcomeStep
              clientId={clientId}
              modelName={usage?.model_display_name ?? 'Notus'}
              planName={usage?.display_name ?? 'Free'}
              onNext={() => setStep(2)}
            />
          )}
          {step === 2 && (
            <UploadStep
              disabled={uploading}
              progress={progress}
              inputRef={fileInputRef}
              onFile={handlePickFile}
              onBack={() => setStep(1)}
            />
          )}
          {step === 3 && (
            <ProcessingStep
              upload={upload ?? null}
              onDone={() => nav('/app')}
            />
          )}
        </div>
      </main>

      <footer className="border-t border-surface-border py-4 px-6 text-center">
        <Link to="/" className="text-sm text-ink-subtle hover:text-ink">
          Пропустить и перейти в кабинет
        </Link>
      </footer>
    </div>
  )
}

// ─────────────────────────────────────────────────────────────────────────
//  Top strip — progress indicator, deliberately subtle
// ─────────────────────────────────────────────────────────────────────────

function TopStrip({ step }: { step: Step }) {
  const steps = ['Знакомство', 'Загрузка данных', 'Первый прогноз']
  return (
    <div className="border-b border-surface-border bg-surface-raised">
      <div className="max-w-3xl mx-auto px-6 h-14 flex items-center gap-4">
        <Link to="/" className="flex items-center gap-2">
          <span className="h-7 w-7 rounded-md bg-brand-500 flex items-center justify-center text-ink-invert text-[10px] font-semibold tracking-wider">
            SKU
          </span>
          <span className="font-display italic text-brand-700">Forecasting</span>
        </Link>

        <div className="flex-1" />

        <ol className="flex items-center gap-4">
          {steps.map((label, i) => {
            const n = (i + 1) as Step
            const done    = n < step
            const current = n === step
            return (
              <li key={label} className="flex items-center gap-2 text-xs">
                <span className={[
                  'h-5 w-5 rounded-full flex items-center justify-center text-[10px] font-semibold',
                  done    ? 'bg-brand-500 text-ink-invert'
                  : current ? 'bg-brand-100 text-brand-700 ring-2 ring-brand-500'
                           : 'bg-surface-muted text-ink-subtle',
                ].join(' ')}>
                  {done ? '✓' : n}
                </span>
                <span className={current ? 'text-ink font-medium' : 'text-ink-subtle'}>
                  {label}
                </span>
              </li>
            )
          })}
        </ol>
      </div>
    </div>
  )
}

// ─────────────────────────────────────────────────────────────────────────
//  Step 1 — Welcome
// ─────────────────────────────────────────────────────────────────────────

function WelcomeStep({
  clientId, modelName, planName, onNext,
}: {
  clientId: string
  modelName: string
  planName: string
  onNext: () => void
}) {
  return (
    <div className="animate-rise">
      <div className="eyebrow">Шаг 01 из 03</div>
      <h1 className="display-em text-brand-700 text-4xl sm:text-6xl mt-2 leading-[1.04]">
        Привет, <span className="font-mono text-3xl sm:text-5xl text-ink">{clientId}</span>.
      </h1>
      <p className="mt-5 text-ink-muted text-lg max-w-xl leading-relaxed">
        За ближайшие пять минут вы получите свой первый прогноз.
        Без настроек, без регистрации данных — просто CSV с историей продаж,
        остальное сделает модель.
      </p>

      <div className="rule-dot my-8" />

      <div className="card-paper p-6 sm:p-8">
        <div className="flex items-start gap-5">
          <div className="seal shrink-0" style={{ width: 64, height: 64 }}>
            {planName}
          </div>
          <div>
            <div className="eyebrow">Ваш тариф и модель</div>
            <div className="display-em text-brand-700 text-2xl mt-1">
              {modelName} · {planName}
            </div>
            <p className="text-sm text-paper-ink/80 mt-2 leading-relaxed">
              Бесплатный тариф — до 30 SKU и 7 дней прогноза вперёд. Этого
              хватит, чтобы оценить точность на вашем ассортименте.
            </p>
          </div>
        </div>
      </div>

      <div className="mt-10 flex items-center gap-4">
        <button type="button" className="btn-primary" onClick={onNext}>
          Начать — загрузить данные →
        </button>
        <span className="text-sm text-ink-muted">~2–4 минуты до готового прогноза</span>
      </div>
    </div>
  )
}

// ─────────────────────────────────────────────────────────────────────────
//  Step 2 — Upload
// ─────────────────────────────────────────────────────────────────────────

function UploadStep({
  disabled, progress, inputRef, onFile, onBack,
}: {
  disabled: boolean
  progress: number
  inputRef: React.RefObject<HTMLInputElement>
  onFile: (f: File | null) => void
  onBack: () => void
}) {
  const [dragging, setDragging] = useState(false)

  return (
    <div className="animate-rise">
      <div className="eyebrow">Шаг 02 из 03</div>
      <h1 className="display-em text-brand-700 text-4xl sm:text-5xl mt-2 leading-[1.04]">
        Загрузите историю продаж.
      </h1>
      <p className="mt-4 text-ink-muted max-w-xl">
        CSV или XLSX с колонками <code className="font-mono text-brand-700">date</code>,{' '}
        <code className="font-mono text-brand-700">sku</code>,{' '}
        <code className="font-mono text-brand-700">sales</code> и минимум 30 строк истории.
      </p>

      <div
        className={[
          'mt-8 rounded-2xl border-2 border-dashed py-16 px-6 flex flex-col items-center',
          'transition-colors bg-surface-raised',
          dragging ? 'border-brand-500 bg-brand-50' : 'border-surface-border',
          disabled ? 'opacity-60 pointer-events-none' : '',
        ].join(' ')}
        onDragOver={(e) => { e.preventDefault(); setDragging(true) }}
        onDragLeave={() => setDragging(false)}
        onDrop={(e) => {
          e.preventDefault()
          setDragging(false)
          onFile(e.dataTransfer.files?.[0] ?? null)
        }}
      >
        <input
          ref={inputRef}
          type="file"
          accept={ACCEPT_ATTRIBUTE}
          className="hidden"
          onChange={(e) => onFile(e.target.files?.[0] ?? null)}
          disabled={disabled}
        />

        <div className="h-16 w-16 rounded-full bg-brand-50 flex items-center justify-center text-brand-700 mb-5">
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5"
               strokeLinecap="round" strokeLinejoin="round" className="h-8 w-8">
            <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4" />
            <path d="M17 8l-5-5-5 5" />
            <path d="M12 3v12" />
          </svg>
        </div>

        <div className="display-em text-brand-700 text-2xl">
          Перетащите файл сюда
        </div>
        <p className="text-sm text-ink-muted mt-1">
          или{' '}
          <button
            type="button"
            className="text-brand-500 underline underline-offset-2 hover:text-brand-600"
            onClick={() => inputRef.current?.click()}
            disabled={disabled}
          >
            выберите с диска
          </button>
        </p>
        <p className="eyebrow mt-4">
          CSV / XLSX · до {(MAX_UPLOAD_BYTES / 1024 / 1024).toFixed(0)} МБ
        </p>

        {progress > 0 && progress < 100 && (
          <div className="mt-6 w-full max-w-md">
            <div className="h-[3px] rounded-full bg-surface-muted overflow-hidden">
              <div
                className="h-full bg-brand-500 transition-all"
                style={{ width: `${progress}%` }}
              />
            </div>
            <p className="eyebrow mt-2 text-center">Загрузка {progress}%</p>
          </div>
        )}
      </div>

      <div className="mt-6 flex items-center justify-between text-sm">
        <button type="button" className="btn-ghost" onClick={onBack}>
          ← Назад
        </button>
        <span className="text-ink-subtle">
          Пример формата:{' '}
          <code className="font-mono text-ink">date,sku,sales</code>
        </span>
      </div>
    </div>
  )
}

// ─────────────────────────────────────────────────────────────────────────
//  Step 3 — Processing + first results
// ─────────────────────────────────────────────────────────────────────────

function ProcessingStep({
  upload, onDone,
}: {
  upload: any | null
  onDone: () => void
}) {
  const steps = ['uploaded', 'scanning', 'scanned_clean', 'processing', 'processed']
  const idx = upload ? steps.indexOf(upload.status) : 0
  const done = upload?.status === 'processed'
  const failed = upload?.status === 'infected' || upload?.status === 'processing_failed'

  // Time-estimate — rough copy that reassures the user during slow steps.
  const stepCopy = useMemo(() => {
    const s = upload?.status ?? 'uploaded'
    return ({
      uploaded:          'Файл принят, ставим в очередь…',
      scanning:          'Проверяем ваши данные на безопасность…',
      scanned_clean:     'Файл проверен. Готовим к разбору…',
      infected:          'Файл не прошёл проверку безопасности и не будет обработан.',
      processing:        'Проверяем колонки и значения…',
      processed:         'Готово. Данные в модели.',
      processing_failed: 'Не удалось разобрать файл. Проверьте формат CSV.',
    } as Record<string, string>)[s] ?? ''
  }, [upload?.status])

  return (
    <div className="animate-rise">
      <div className="eyebrow">Шаг 03 из 03</div>
      <h1 className="display-em text-brand-700 text-4xl sm:text-5xl mt-2 leading-[1.04]">
        {done    ? 'Готово.'
         : failed ? 'Что-то пошло не так.'
                  : 'Обрабатываем файл.'}
      </h1>
      <p className="mt-4 text-ink-muted max-w-xl">{stepCopy}</p>

      {/* Pipeline dots */}
      {!failed && (
        <ol className="mt-8 flex items-center gap-3 text-xs">
          {[
            { label: 'Приём' },
            { label: 'Проверка' },
            { label: 'Проверено' },
            { label: 'Разбор' },
            { label: 'Готов' },
          ].map((s, i) => {
            const finished = idx > i || done
            const current  = idx === i && !done
            return (
              <li key={s.label} className="flex-1 flex items-center gap-2">
                <span className={[
                  'h-7 w-7 rounded-full flex items-center justify-center text-[11px] font-semibold',
                  finished ? 'bg-brand-500 text-ink-invert'
                  : current ? 'bg-brand-100 text-brand-700 ring-2 ring-brand-500 animate-pulse'
                            : 'bg-surface-muted text-ink-subtle',
                ].join(' ')}>
                  {finished ? '✓' : i + 1}
                </span>
                <span className={current ? 'text-ink font-medium' : 'text-ink-muted'}>
                  {s.label}
                </span>
                {i < 4 && <div className="flex-1 h-px bg-surface-border" />}
              </li>
            )
          })}
        </ol>
      )}

      {/* Success results card */}
      {done && upload && (
        <div className="mt-10 card-paper p-6 sm:p-8 animate-fade-in relative overflow-hidden">
          <span
            aria-hidden
            className="absolute -top-10 -right-4 display-em text-gold-300/40 text-[10rem] leading-none pointer-events-none"
          >
            01
          </span>
          <div className="relative">
            <div className="chapter-num">— первая победа</div>
            <h2 className="display-em text-brand-700 text-3xl mt-1 leading-tight">
              Ваш первый прогноз готов к построению.
            </h2>

            <div className="mt-6 grid grid-cols-2 gap-5 max-w-md">
              <div>
                <div className="eyebrow">Строк истории</div>
                <div className="num font-display text-brand-700 text-3xl mt-1">
                  {upload.row_count ?? '—'}
                </div>
              </div>
              <div>
                <div className="eyebrow">Уникальных SKU</div>
                <div className="num font-display text-brand-700 text-3xl mt-1">
                  {upload.sku_count ?? '—'}
                </div>
              </div>
            </div>

            <div className="mt-8 flex items-center gap-3">
              <button type="button" className="btn-gold" onClick={onDone}>
                Войти в кабинет →
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Failure */}
      {failed && upload && (
        <div className="mt-8 rounded-lg bg-danger-bg text-danger px-4 py-3 text-sm">
          <div className="font-medium mb-1">
            {upload.status === 'infected' ? 'Файл не прошёл проверку безопасности' : 'Ошибка разбора'}
          </div>
          {upload.error_message && (
            <div className="text-xs">{safeUploadError(upload.error_message)}</div>
          )}
          <div className="mt-3">
            <Link to="/" className="btn-ghost text-danger">
              Перейти в кабинет и попробовать ещё раз
            </Link>
          </div>
        </div>
      )}
    </div>
  )
}
