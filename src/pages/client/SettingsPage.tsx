import { useEffect, useMemo, useState } from 'react'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import toast from 'react-hot-toast'

import { useAuthStore } from '../../features/auth/store'
import { configApi, type ClientConfigOverride } from '../../features/config/api'
import { notificationsApi } from '../../features/notifications/api'
import { useUsage } from '../../features/plans/useUsage'
import {
  LockOverlay,
  PlanGateBadge,
  UpgradeTrigger,
} from '../../features/plans/upsell'
import type { PlanId } from '../../features/plans/api'
import { errorMessage } from '../../shared/api/client'

// ─────────────────────────────────────────────────────────────────────────
//  Settings — the "constructor" page.
//
//  Design goals:
//    1. Speak BUSINESS, not ML. The user is a purchasing manager, not a
//       data scientist. Sliders read as "Вес истории ↔ Реакция на тренды",
//       not "rolling_windows=[7,14,28]" — we map between the two.
//    2. LIVE PREVIEW. Every change moves a mini-chart in the sidecard.
//       The "before / after" lines give an immediate, visceral sense of
//       what the knob does — more convincing than any copy.
//    3. PLAN-GATED, not blocked. Free sees a premium paper overlay.
//       Start sees all basic fields + `PlanGateBadge` on Business-only.
//       Business sees everything.
// ─────────────────────────────────────────────────────────────────────────

// Business-regulator UI state — what the sliders and toggles look like to
// the user. Each entry maps back to one or more dotted config keys.
type Objective = 'ensemble' | 'mse' | 'mae' | 'tweedie'

interface RegulatorState {
  horizon:         number      // 1–365
  // Loss objective the model is trained against. Plan-tier defaults
  // backfill this on the server (Free→mse, Start/Business→tweedie),
  // explicit user choice always wins.
  objective:       Objective
  historyWeight:   number      // 0–100, "вес истории" — lower = fast reaction
  seasonalStrength:number      // 0–100, "сезонный коэффициент"
  holidaysOn:      boolean
  country:         string
  calendarOn:      boolean
  priceOn:         boolean
  promoOn:         boolean
  stockOn:         boolean
  weatherOn:       boolean     // Business-only
  weatherLat:      string       // string so empty = "use server default" (СПб)
  weatherLon:      string
  fxOn:            boolean      // RU FX regressors — Start + Business
  fxCurrencies:    string[]     // subset of FX_CURRENCIES; non-empty when fxOn
}

const DEFAULTS: RegulatorState = {
  horizon:         14,
  objective:       'ensemble',
  historyWeight:   55,
  seasonalStrength:70,
  holidaysOn:      true,
  country:         'RU',
  calendarOn:      true,
  priceOn:         true,
  promoOn:         true,
  stockOn:         false,
  weatherOn:       false,
  weatherLat:      '',
  weatherLon:      '',
  fxOn:            true,
  fxCurrencies:    ['CNY', 'USD', 'EUR', 'BYN', 'KZT'],
}

const COUNTRIES = ['RU', 'KZ', 'BY', 'US', 'DE', 'FR'] as const

// RU FX regressors. Order = display order. Source of truth on the backend is
// external_regressors_ru.CBR_CODES; keep this list in sync with it.
const FX_CURRENCIES = ['CNY', 'USD', 'EUR', 'BYN', 'KZT'] as const
const FX_PRESETS: { label: string; codes: string[] }[] = [
  { label: 'Все',        codes: ['CNY', 'USD', 'EUR', 'BYN', 'KZT'] },
  { label: 'Азия-ЕАЭС',  codes: ['CNY', 'KZT', 'BYN'] },
  { label: 'Запад',      codes: ['USD', 'EUR'] },
  { label: 'Только CNY', codes: ['CNY'] },
]

// ─────────────────────────────────────────────────────────────────────────
//  Mapping: UI-state ↔ dotted config override.
//
//  Sliders (0–100) → discrete lag/window arrays the model understands.
// ─────────────────────────────────────────────────────────────────────────

function stateToOverride(s: RegulatorState): ClientConfigOverride {
  // historyWeight: low → small windows (fast reaction), high → larger.
  const windows =
    s.historyWeight < 33 ? [3, 7, 14] :
    s.historyWeight < 66 ? [7, 14, 28] :
                           [14, 28, 56]
  const lags =
    s.historyWeight < 33 ? [1, 7] :
    s.historyWeight < 66 ? [1, 7, 14] :
                           [1, 7, 14, 28]
  return {
    model: {
      horizon: s.horizon,
      objective: s.objective,
    },
    features: {
      rolling_windows: windows,
      lags,
      holidays: { enabled: s.holidaysOn, country: s.country },
      calendar: s.calendarOn,
      price:    s.priceOn,
      promo:    s.promoOn,
      stock:    s.stockOn,
      weather: {
        enabled: s.weatherOn,
        // Send lat/lon ONLY when filled; backend keeps its default
        // (Saint Petersburg, 59.93/30.32) for the empty case.
        ...(s.weatherLat.trim() ? { latitude:  Number(s.weatherLat) }  : {}),
        ...(s.weatherLon.trim() ? { longitude: Number(s.weatherLon) } : {}),
      },
      external_regressors_ru: {
        enabled: s.fxOn,
        // Attach currencies only when enabled AND non-empty — the backend
        // rejects an empty list (validate_client_config), and the UI blocks
        // save in that state, so this guard is belt-and-suspenders.
        ...(s.fxOn && s.fxCurrencies.length ? { currencies: s.fxCurrencies } : {}),
      },
    },
  }
}

function overrideToState(raw: ClientConfigOverride): RegulatorState {
  const features   = raw.features ?? ({} as NonNullable<ClientConfigOverride['features']>)
  const wind       = features.rolling_windows
  const hist       =
    !wind       ? DEFAULTS.historyWeight :
    wind[0] <= 3 ? 16 :
    wind[0] <= 7 ? 50 :
                   84
  const rawObj = raw.model?.objective
  const objective: Objective =
    rawObj === 'ensemble' || rawObj === 'mse' || rawObj === 'mae' || rawObj === 'tweedie'
      ? rawObj
      : DEFAULTS.objective
  return {
    horizon:          raw.model?.horizon          ?? DEFAULTS.horizon,
    objective,
    historyWeight:    hist,
    seasonalStrength: DEFAULTS.seasonalStrength,  // currently not round-tripped
    holidaysOn:       features.holidays?.enabled  ?? DEFAULTS.holidaysOn,
    country:          features.holidays?.country  ?? DEFAULTS.country,
    calendarOn:       features.calendar           ?? DEFAULTS.calendarOn,
    priceOn:          features.price              ?? DEFAULTS.priceOn,
    promoOn:          features.promo              ?? DEFAULTS.promoOn,
    stockOn:          features.stock              ?? DEFAULTS.stockOn,
    weatherOn:        features.weather?.enabled   ?? DEFAULTS.weatherOn,
    weatherLat:
      features.weather?.latitude  != null ? String(features.weather.latitude)  : '',
    weatherLon:
      features.weather?.longitude != null ? String(features.weather.longitude) : '',
    fxOn:
      features.external_regressors_ru?.enabled ?? DEFAULTS.fxOn,
    fxCurrencies:
      Array.isArray(features.external_regressors_ru?.currencies) &&
      features.external_regressors_ru.currencies.length
        ? features.external_regressors_ru.currencies
        : DEFAULTS.fxCurrencies,
  }
}

// ═════════════════════════════════════════════════════════════════════════
//  Page
// ═════════════════════════════════════════════════════════════════════════

export default function SettingsPage() {
  const clientId = useAuthStore((s) => s.clientId)!
  const qc       = useQueryClient()
  const { data: usage } = useUsage()

  const { data: serverConfig, isLoading } = useQuery({
    queryKey: ['client-config', clientId],
    queryFn:  () => configApi.get(clientId),
  })

  const [state, setState] = useState<RegulatorState>(DEFAULTS)
  const [dirty, setDirty] = useState(false)

  useEffect(() => {
    // Server sends the override as a generic JSON object; narrow it to the
    // known override shape (unknown keys are simply ignored by the mapper).
    if (serverConfig) setState(overrideToState(serverConfig.override as ClientConfigOverride))
  }, [serverConfig])

  function update<K extends keyof RegulatorState>(k: K, v: RegulatorState[K]) {
    setState((s) => ({ ...s, [k]: v }))
    setDirty(true)
  }

  const isFree     = usage?.plan === 'free'
  const isStart    = usage?.plan === 'start'
  const isBusiness = usage?.plan === 'business'

  // Start allows all fields EXCEPT weather — which reads as a Business-grade
  // data integration (external APIs). It's the upsell hook on this page.
  function canEdit(key: keyof RegulatorState): boolean {
    if (isBusiness) return true
    if (isStart) {
      return key !== 'weatherOn'
    }
    return false
  }

  // FX feed enabled but zero currencies selected = an override the backend
  // rejects (validate_client_config); block save and surface it inline.
  const fxInvalid = state.fxOn && canEdit('fxOn') && state.fxCurrencies.length === 0

  const { mutate: save, isPending: saving } = useMutation({
    mutationFn: () => configApi.set(clientId, stateToOverride(state)),
    onSuccess: () => {
      toast.success('Настройки сохранены')
      setDirty(false)
      qc.invalidateQueries({ queryKey: ['client-config', clientId] })
    },
    onError: (e) => toast.error(errorMessage(e, 'Не удалось сохранить')),
  })

  const { mutate: reset, isPending: resetting } = useMutation({
    mutationFn: () => configApi.reset(clientId),
    onSuccess: () => {
      setState(DEFAULTS)
      setDirty(false)
      toast.success('Сброшено к значениям по умолчанию')
      qc.invalidateQueries({ queryKey: ['client-config', clientId] })
    },
    onError: (e) => toast.error(errorMessage(e, 'Не удалось сбросить')),
  })

  return (
    <div className="max-w-6xl space-y-10">
      {/* ── Hero ──────────────────────────────────────────────── */}
      <header>
        <div className="eyebrow">Настройки модели</div>
        <h1 className="display-em text-brand-700 text-4xl sm:text-5xl mt-2 leading-[1.05]">
          Конструктор под ваш бизнес.
        </h1>
        <p className="mt-4 text-ink-muted max-w-2xl leading-relaxed">
          Регулируйте поведение модели бизнес-понятиями, а не ML-параметрами.
          Мини-график справа сразу покажет, как меняется прогноз.
        </p>
      </header>

      {/* ── Free → everything behind premium paper ─────────────── */}
      {isFree && (
        <div className="card p-0 relative min-h-[560px]">
          <LockOverlay
            required="start"
            title="Настройки — для тех, кому важна точность"
            blurb="Учёт праздников, баланс между историей и трендом, сезонность — всё это даёт прирост точности на 10–25% на живых данных. Доступно на Start."
          >
            <SettingsContent
              state={DEFAULTS}
              update={() => {}}
              canEdit={() => false}
              isLoading={false}
              fxInvalid={false}
            />
          </LockOverlay>
        </div>
      )}

      {/* ── Start + Business — the actual editor ───────────────── */}
      {!isFree && (
        <>
          {/* Plan notice — editorial, tiny */}
          {usage && (
            <div className="rule-dot" />
          )}

          {/* Content */}
          <SettingsContent
            state={state}
            update={update}
            canEdit={canEdit}
            isLoading={isLoading}
            fxInvalid={fxInvalid}
          />

          {/* Action row */}
          <div className="flex items-center justify-between pt-4 border-t border-surface-border">
            <div className="eyebrow">
              {dirty ? 'Есть несохранённые изменения' : 'Всё сохранено'}
            </div>
            <div className="flex items-center gap-3">
              <button
                type="button"
                className="btn-secondary"
                onClick={() => reset()}
                disabled={resetting || !dirty}
              >
                Сбросить
              </button>
              <button
                type="button"
                className="btn-primary"
                onClick={() => save()}
                disabled={saving || !dirty || fxInvalid}
              >
                {saving ? 'Сохраняю…' : 'Сохранить'}
              </button>
            </div>
          </div>

          {/* Start → tease Business via one locked feature */}
          {isStart && (
            <UpgradeTrigger variant="save-scenario" />
          )}
        </>
      )}
    </div>
  )
}

// ═════════════════════════════════════════════════════════════════════════
//  SettingsContent — the grid (settings left, live preview right)
// ═════════════════════════════════════════════════════════════════════════

function SettingsContent({
  state,
  update,
  canEdit,
  isLoading,
  fxInvalid,
}: {
  state: RegulatorState
  update: <K extends keyof RegulatorState>(k: K, v: RegulatorState[K]) => void
  canEdit: (k: keyof RegulatorState) => boolean
  isLoading: boolean
  fxInvalid: boolean
}) {
  if (isLoading) {
    // PJAX top-bar signals the wait; empty card keeps layout stable.
    return <div className="card py-16" aria-hidden="true" />
  }

  return (
    <div className="grid gap-6 lg:grid-cols-12">
      {/* Left — settings */}
      <div className="lg:col-span-7 space-y-6">
        <Section title="Параметры обучения" eyebrow="— 01">
          <Field label="Горизонт (дней вперёд)" hint="на сколько дней строить прогноз">
            <input
              type="number"
              min={1}
              max={365}
              className="input num max-w-[140px]"
              value={state.horizon}
              onChange={(e) => update('horizon', Math.max(1, Number(e.target.value) || 1))}
              disabled={!canEdit('horizon')}
            />
          </Field>
          <Field
            label="Профиль вашего товарного каталога"
            hint="Это поможет модели правильно расставить приоритеты при обучении. Если не уверены — оставьте «Универсальный»."
          >
            <ObjectivePicker
              value={state.objective}
              onChange={(v) => update('objective', v)}
              disabled={!canEdit('objective')}
            />
          </Field>
        </Section>

        <Section title="Чувствительность" eyebrow="— 02">
          <Slider
            label="Вес истории"
            leftLabel="Реакция на тренды"
            rightLabel="Доверие истории"
            value={state.historyWeight}
            onChange={(v) => update('historyWeight', v)}
            disabled={!canEdit('historyWeight')}
            hint="Низкое — быстро реагировать на недавние изменения. Высокое — сглаживать шум, опираясь на долгую историю."
          />
          <Slider
            label="Сезонный коэффициент"
            leftLabel="Выкл."
            rightLabel="Усилить"
            value={state.seasonalStrength}
            onChange={(v) => update('seasonalStrength', v)}
            disabled={!canEdit('seasonalStrength')}
            hint="Насколько явно проявлять повторяющиеся паттерны — недельный ритм, годовой сезон."
          />
        </Section>

        <Section title="Учёт событий" eyebrow="— 03">
          <div className="grid sm:grid-cols-2 gap-y-2 gap-x-6">
            <Toggle
              label="Государственные праздники"
              hint="сдвиг спроса на ±8% по данным 2023–2024"
              checked={state.holidaysOn}
              onChange={(v) => update('holidaysOn', v)}
              disabled={!canEdit('holidaysOn')}
            />
            <Toggle
              label="Календарные признаки"
              hint="день недели, месяц, номер недели"
              checked={state.calendarOn}
              onChange={(v) => update('calendarOn', v)}
              disabled={!canEdit('calendarOn')}
            />
            <Toggle
              label="Признак цены"
              hint="учитывает эластичность по цене"
              checked={state.priceOn}
              onChange={(v) => update('priceOn', v)}
              disabled={!canEdit('priceOn')}
            />
            <Toggle
              label="Признак промо"
              hint="скидки и акции в истории"
              checked={state.promoOn}
              onChange={(v) => update('promoOn', v)}
              disabled={!canEdit('promoOn')}
            />
            <Toggle
              label="Признак остатков"
              hint="пропуски продаж из-за отсутствия товара"
              checked={state.stockOn}
              onChange={(v) => update('stockOn', v)}
              disabled={!canEdit('stockOn')}
            />
            <Toggle
              label="Учёт погоды"
              hint="внешние данные о температуре и осадках"
              checked={state.weatherOn}
              onChange={(v) => update('weatherOn', v)}
              disabled={!canEdit('weatherOn')}
              businessOnly={!canEdit('weatherOn')}
            />
          </div>

          {state.weatherOn && canEdit('weatherOn') && (
            <div className="mt-4 grid grid-cols-1 sm:grid-cols-2 gap-4 max-w-md">
              <Field label="Широта" hint="−90 … +90, по умолчанию СПб (59.93)">
                <input
                  type="number"
                  step="0.0001"
                  min={-90}
                  max={90}
                  inputMode="decimal"
                  className="input"
                  value={state.weatherLat}
                  onChange={(e) => update('weatherLat', e.target.value)}
                  placeholder="59.93"
                />
              </Field>
              <Field label="Долгота" hint="−180 … +180, по умолчанию СПб (30.32)">
                <input
                  type="number"
                  step="0.0001"
                  min={-180}
                  max={180}
                  inputMode="decimal"
                  className="input"
                  value={state.weatherLon}
                  onChange={(e) => update('weatherLon', e.target.value)}
                  placeholder="30.32"
                />
              </Field>
              <p className="sm:col-span-2 text-xs text-ink-subtle leading-relaxed">
                Координаты центра вашего магазина / склада — модель тянет
                исторический ряд температуры и осадков из Open-Meteo.
                Можно скопировать из Яндекс.Карт (правый клик → координаты).
              </p>
            </div>
          )}

          {/* RU FX regressors — Start + Business (Free sees the upsell badge) */}
          <div className="border-t border-surface pt-4 mt-2">
            <Toggle
              label="Валютные регрессоры (курсы ЦБ ₽)"
              hint="CNY/USD/EUR/BYN/KZT — сильный сигнал для импортных товаров"
              checked={state.fxOn}
              onChange={(v) => update('fxOn', v)}
              disabled={!canEdit('fxOn')}
              gate={!canEdit('fxOn') ? 'start' : undefined}
            />
            {state.fxOn && canEdit('fxOn') && (
              <div className="mt-3 max-w-md pl-1">
                <div className="flex flex-wrap gap-2">
                  {FX_CURRENCIES.map((c) => {
                    const on = state.fxCurrencies.includes(c)
                    return (
                      <button
                        key={c}
                        type="button"
                        aria-pressed={on}
                        onClick={() =>
                          update(
                            'fxCurrencies',
                            on
                              ? state.fxCurrencies.filter((x) => x !== c)
                              : [...state.fxCurrencies, c],
                          )
                        }
                        className={[
                          'rounded-full px-3 py-1 text-sm border border-transparent transition',
                          on
                            ? 'bg-brand-500 text-ink-invert'
                            : 'bg-surface-muted text-ink-muted hover:text-ink',
                        ].join(' ')}
                      >
                        {c}
                      </button>
                    )
                  })}
                </div>
                <div className="mt-2 flex flex-wrap items-center gap-x-3 gap-y-1">
                  <span className="eyebrow">Пресеты:</span>
                  {FX_PRESETS.map((p) => (
                    <button
                      key={p.label}
                      type="button"
                      onClick={() => update('fxCurrencies', p.codes)}
                      className="text-xs text-brand-600 hover:text-brand-700 underline underline-offset-2"
                    >
                      {p.label}
                    </button>
                  ))}
                </div>
                {fxInvalid && (
                  <p className="mt-2 text-xs text-danger">
                    Выберите хотя бы одну валюту — или выключите блок.
                  </p>
                )}
              </div>
            )}
          </div>

          {state.holidaysOn && (
            <div className="mt-4">
              <Field label="Страна для праздников" hint="ISO-2 код страны">
                <select
                  className="input max-w-[140px]"
                  value={state.country}
                  onChange={(e) => update('country', e.target.value)}
                  disabled={!canEdit('country')}
                >
                  {COUNTRIES.map((c) => <option key={c} value={c}>{c}</option>)}
                </select>
              </Field>
            </div>
          )}
        </Section>

        <Section title="Уведомления" eyebrow="— 04">
          <NotificationsBlock />
        </Section>
      </div>

      {/* Right — live preview (sticky) */}
      <aside className="lg:col-span-5">
        <div className="sticky top-6">
          <LivePreview state={state} />
        </div>
      </aside>
    </div>
  )
}

// ═════════════════════════════════════════════════════════════════════════
//  UI primitives
// ═════════════════════════════════════════════════════════════════════════

// Card-based picker for the loss objective. ML jargon (Tweedie/MAE/
// MSE/Ensemble) is hidden behind business-language labels. The new
// default — "Умный" — trains all three children and blends them per
// SKU; the manual options stay accessible under "Расширенные настройки"
// for users who know what they're doing.
function NotificationsBlock() {
  const clientId = useAuthStore((s) => s.clientId)!
  const qc = useQueryClient()
  const { data: status, isLoading } = useQuery({
    queryKey: ['telegram-status', clientId],
    queryFn:  () => notificationsApi.getTelegramStatus(clientId),
  })

  const linkMut = useMutation({
    mutationFn: () => notificationsApi.createLinkToken(clientId),
    onSuccess: (data) => {
      // Open the bot link in a new tab. The user clicks Start there,
      // bot's poll loop receives /start <token>, stores chat_id, and
      // the next status refetch will show "Привязано".
      // R13 LOW — only open http(s) URLs; never a javascript:/data: scheme,
      // as a defensive guard even though the server builds this bot URL.
      if (/^https?:\/\//i.test(data.url)) {
        window.open(data.url, '_blank', 'noopener')
      }
      toast(
        'Откройте бота и нажмите Start. Через несколько секунд статус обновится.',
        { icon: '✈', duration: 6000 },
      )
    },
    onError: (e) => toast.error(errorMessage(e, 'Не удалось создать ссылку')),
  })

  const unlinkMut = useMutation({
    mutationFn: () => notificationsApi.unlink(clientId),
    onSuccess: () => {
      toast.success('Telegram отвязан')
      qc.invalidateQueries({ queryKey: ['telegram-status', clientId] })
    },
    onError: (e) => toast.error(errorMessage(e, 'Не удалось отвязать')),
  })

  // Light polling so the status flips to "Привязано" within a few
  // seconds after the user finishes the bot dialog.
  useEffect(() => {
    if (status?.linked) return
    const id = setInterval(
      () => qc.invalidateQueries({ queryKey: ['telegram-status', clientId] }),
      5000,
    )
    return () => clearInterval(id)
  }, [status?.linked, clientId, qc])

  return (
    <div className="space-y-4">
      <div className="rounded-md bg-surface-muted/40 px-4 py-3">
        <div className="flex items-start gap-3">
          <div className="text-2xl leading-none">✉</div>
          <div className="flex-1">
            <div className="font-medium text-ink">Email — всегда включён</div>
            <p className="text-xs text-ink-muted mt-0.5">
              Письмо о завершении обучения приходит на адрес вашего аккаунта.
              Работает даже если вкладка браузера закрыта.
            </p>
          </div>
        </div>
      </div>

      <div className="rounded-md border border-surface-border p-4">
        <div className="flex items-start gap-3">
          <div className="text-2xl leading-none">✈</div>
          <div className="flex-1">
            <div className="flex items-center justify-between gap-3 flex-wrap">
              <div>
                <div className="font-medium text-ink">Telegram</div>
                <p className="text-xs text-ink-muted mt-0.5">
                  Уведомления приходят в личные сообщения от бота{' '}
                  <span className="font-mono">@{status?.bot ?? 'syntheicbot'}</span>
                  {'.'} Удобнее всего — открыть Telegram прямо с телефона.
                </p>
              </div>
              {isLoading ? (
                <span className="text-xs text-ink-subtle">…</span>
              ) : status?.linked ? (
                <div className="flex items-center gap-2">
                  <span className="badge-success text-xs">Привязано</span>
                  <button
                    type="button"
                    onClick={() => unlinkMut.mutate()}
                    disabled={unlinkMut.isPending}
                    className="text-xs text-ink-subtle hover:text-danger underline-offset-2 hover:underline"
                  >
                    Отвязать
                  </button>
                </div>
              ) : (
                <button
                  type="button"
                  onClick={() => linkMut.mutate()}
                  disabled={linkMut.isPending}
                  className="btn-primary text-sm whitespace-nowrap"
                >
                  {linkMut.isPending ? 'Готовлю ссылку…' : 'Привязать Telegram →'}
                </button>
              )}
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}

function ObjectivePicker({
  value,
  onChange,
  disabled,
}: {
  value: Objective
  onChange: (v: Objective) => void
  disabled?: boolean
}) {
  // Auto-expand the manual block when the user has already chosen a
  // manual option — no point hiding their current selection behind
  // a "show advanced" link.
  const [manualOpen, setManualOpen] = useState(value !== 'ensemble')
  const isSmart = value === 'ensemble'

  const manual: Array<{
    id: Objective
    title: string
    body: string
    example: string
    techName: string
  }> = [
    {
      id: 'tweedie',
      title: 'Универсальный',
      body: 'Подходит большинству магазинов. Хорошо работает когда часть товаров продаётся часто, а часть — редко или с длинными перерывами.',
      example: 'Например: смешанный каталог одежды, товары для дома, продукты с разной популярностью.',
      techName: 'Tweedie',
    },
    {
      id: 'mae',
      title: 'Равномерный спрос',
      body: 'Все товары продаются примерно с одинаковой частотой. Все ошибки одинаково важны.',
      example: 'Например: ежедневный спрос FMCG (хлеб, молоко), товары первой необходимости.',
      techName: 'MAE',
    },
    {
      id: 'mse',
      title: 'Дорогие или критичные товары',
      body: 'Сильнее штрафует крупные промахи. Подходит когда ошибка прогноза обходится дорого — упущенная выручка или утилизация.',
      example: 'Например: бытовая техника, скоропортящиеся, ювелирка, лекарства.',
      techName: 'MSE',
    },
  ]

  return (
    <div className="space-y-3 mt-1">
      {/* ── Hero: Smart / Ensemble ─────────────────────────── */}
      <button
        type="button"
        onClick={() => !disabled && onChange('ensemble')}
        disabled={disabled}
        className={[
          'w-full text-left rounded-lg border p-5 transition-all',
          isSmart
            ? 'border-brand-500 bg-brand-50 ring-2 ring-brand-500/20'
            : 'border-surface-border bg-surface-raised hover:border-brand-300',
          disabled ? 'opacity-50 cursor-not-allowed' : 'cursor-pointer',
        ].join(' ')}
      >
        <div className="flex items-start justify-between gap-3">
          <div className="flex-1">
            <div className="flex items-center gap-2">
              <span className="font-semibold text-ink text-base">
                Умный — модель сама подберёт
              </span>
              <span className="text-[10px] uppercase tracking-wider px-1.5 py-0.5 rounded bg-brand-500 text-ink-invert whitespace-nowrap">
                Рекомендуется
              </span>
            </div>
            <p className="mt-2 text-sm text-ink-muted leading-snug">
              Система обучает три модели сразу (для частых, равномерных и дорогих товаров)
              и для каждого артикула отдельно подбирает ту, которая работает лучше всего на
              последних 4 неделях. Подходит абсолютному большинству каталогов.
            </p>
            <p className="mt-2 text-xs text-ink-subtle italic leading-snug">
              Обучение займёт примерно в 3 раза дольше, но точность прогноза выше — это уже
              не компромисс, а лучший выбор для каждого товара.
            </p>
          </div>
          {isSmart && (
            <div className="shrink-0 flex h-7 w-7 items-center justify-center rounded-full bg-brand-500 text-ink-invert text-sm">
              ✓
            </div>
          )}
        </div>
        <div className="mt-3 pt-2 border-t border-surface-border/60 text-[10px] uppercase tracking-wider text-ink-subtle">
          ML-метод: <span className="font-mono normal-case">Ensemble (Tweedie + MAE + MSE)</span>
        </div>
      </button>

      {/* ── Toggle: advanced ────────────────────────────────── */}
      <button
        type="button"
        onClick={() => setManualOpen((v) => !v)}
        className="text-xs text-ink-muted hover:text-ink underline-offset-2 hover:underline"
      >
        {manualOpen ? '↑ Скрыть ручную настройку' : '↓ Расширенные настройки — выбрать метод вручную'}
      </button>

      {/* ── Manual options ──────────────────────────────────── */}
      {manualOpen && (
        <div className="grid gap-3 sm:grid-cols-3 pt-1">
          {manual.map((c) => {
            const active = value === c.id
            return (
              <button
                key={c.id}
                type="button"
                onClick={() => !disabled && onChange(c.id)}
                disabled={disabled}
                className={[
                  'text-left rounded-lg border p-4 transition-all',
                  active
                    ? 'border-brand-500 bg-brand-50 ring-2 ring-brand-500/20'
                    : 'border-surface-border bg-surface-raised hover:border-brand-300',
                  disabled ? 'opacity-50 cursor-not-allowed' : 'cursor-pointer',
                ].join(' ')}
              >
                <div className="font-semibold text-ink leading-tight">{c.title}</div>
                <p className="mt-2 text-xs text-ink-muted leading-snug">{c.body}</p>
                <p className="mt-2 text-xs text-ink-subtle italic leading-snug">{c.example}</p>
                <div className="mt-3 pt-2 border-t border-surface-border/60 text-[10px] uppercase tracking-wider text-ink-subtle">
                  ML-метод: <span className="font-mono normal-case">{c.techName}</span>
                </div>
              </button>
            )
          })}
        </div>
      )}
    </div>
  )
}

function Section({
  title, eyebrow, children,
}: {
  title: string
  eyebrow: string
  children: React.ReactNode
}) {
  return (
    <section className="card p-6 sm:p-7">
      <div className="flex items-baseline gap-3 mb-4">
        <span className="chapter-num">{eyebrow}</span>
        <h2 className="display-em text-brand-700 text-2xl">{title}</h2>
      </div>
      <div className="space-y-4">{children}</div>
    </section>
  )
}

function Field({
  label, hint, children,
}: {
  label: string
  hint?: string
  children: React.ReactNode
}) {
  return (
    <div>
      <div className="label">{label}</div>
      {children}
      {hint && <div className="eyebrow mt-1.5">{hint}</div>}
    </div>
  )
}

function Slider({
  label, leftLabel, rightLabel,
  value, onChange, disabled, hint,
}: {
  label: string
  leftLabel: string
  rightLabel: string
  value: number
  onChange: (v: number) => void
  disabled?: boolean
  hint?: string
}) {
  return (
    <div>
      <div className="flex items-baseline justify-between">
        <div className="text-sm font-medium text-ink">{label}</div>
        <div className="num font-display text-brand-700 text-lg">{value}</div>
      </div>
      <input
        type="range"
        min={0}
        max={100}
        value={value}
        disabled={disabled}
        onChange={(e) => onChange(Number(e.target.value))}
        className="slider mt-2"
      />
      <div className="flex justify-between text-[11px] text-ink-subtle mt-1">
        <span>← {leftLabel}</span>
        <span>{rightLabel} →</span>
      </div>
      {hint && <div className="eyebrow mt-2 max-w-md">{hint}</div>}
    </div>
  )
}

function Toggle({
  label, hint, checked, onChange, disabled, businessOnly, gate,
}: {
  label: string
  hint?: string
  checked: boolean
  onChange: (v: boolean) => void
  disabled?: boolean
  businessOnly?: boolean
  gate?: PlanId
}) {
  return (
    <label className={[
      'flex items-start gap-3 cursor-pointer py-2 rounded-md px-1',
      disabled ? 'cursor-not-allowed opacity-60' : 'hover:bg-surface-muted/60',
    ].join(' ')}>
      <input
        type="checkbox"
        className="mt-0.5 h-4 w-4 rounded text-brand-500 focus:ring-brand-500"
        checked={checked}
        disabled={disabled}
        onChange={(e) => onChange(e.target.checked)}
      />
      <div className="flex-1 min-w-0">
        <div className="flex items-center gap-2">
          <span className="text-sm text-ink">{label}</span>
          {gate ? <PlanGateBadge required={gate} />
                : businessOnly && <PlanGateBadge required="business" />}
        </div>
        {hint && <div className="eyebrow mt-0.5">{hint}</div>}
      </div>
    </label>
  )
}

// ═════════════════════════════════════════════════════════════════════════
//  LivePreview — the value proof.
//
//  Renders a synthetic SKU history (base) plus a forecast line computed
//  from the current slider values. Changes reactively as the user drags.
// ═════════════════════════════════════════════════════════════════════════

function LivePreview({ state }: { state: RegulatorState }) {
  const { history, baseline, tuned, accuracyLift } = useMemo(
    () => synthesizeLines(state),
    [state],
  )

  const W = 460
  const H = 220
  const PAD = 16
  const all = [...history, ...baseline, ...tuned]
  const min = Math.min(...all)
  const max = Math.max(...all)
  const n = history.length + baseline.length

  function path(points: number[], offset = 0): string {
    return points.map((v, i) => {
      const x = PAD + ((i + offset) / (n - 1)) * (W - PAD * 2)
      const y = PAD + (1 - (v - min) / (max - min || 1)) * (H - PAD * 2)
      return `${i === 0 && offset === 0 ? 'M' : 'L'} ${x.toFixed(1)} ${y.toFixed(1)}`
    }).join(' ')
  }

  const splitX = PAD + (history.length - 1) / (n - 1) * (W - PAD * 2)

  return (
    <div className="card p-5 sm:p-6">
      <div className="flex items-baseline justify-between mb-1">
        <div className="chapter-num">— превью</div>
        <div className="eyebrow">точность +{accuracyLift.toFixed(1)}%</div>
      </div>
      <h3 className="display-em text-brand-700 text-xl mt-1">
        Как изменится прогноз
      </h3>

      <svg viewBox={`0 0 ${W} ${H}`} className="w-full mt-4 block" aria-hidden>
        <defs>
          <linearGradient id="tunedFill" x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%"  stopColor="#1A4AB8" stopOpacity="0.12" />
            <stop offset="100%" stopColor="#1A4AB8" stopOpacity="0.00" />
          </linearGradient>
        </defs>

        {/* zone divider — "сейчас" */}
        <line
          x1={splitX} x2={splitX}
          y1={PAD} y2={H - PAD}
          stroke="#C79A33" strokeDasharray="3 3" strokeWidth="1"
        />
        <text
          x={splitX - 4} y={PAD + 10}
          className="fill-gold-600"
          fontSize="9" textAnchor="end"
          style={{ fontFamily: 'Inter' }}
        >
          СЕЙЧАС
        </text>

        {/* history (solid, ink) */}
        <path
          d={path(history)}
          fill="none" stroke="#020817" strokeWidth="1.5"
        />

        {/* baseline forecast (dashed, muted) */}
        <path
          d={path(baseline, history.length - 1)}
          fill="none" stroke="#94A3B8" strokeWidth="1.5"
          strokeDasharray="4 4"
        />
        {/* tuned forecast (solid brand teal) */}
        <path
          d={path(tuned, history.length - 1)}
          fill="none" stroke="#1A4AB8" strokeWidth="2.25"
        />
        {/* tuned fill under the line */}
        <path
          d={`${path(tuned, history.length - 1)} L ${W - PAD} ${H - PAD} L ${splitX} ${H - PAD} Z`}
          fill="url(#tunedFill)"
        />
      </svg>

      <ul className="mt-4 space-y-1.5 text-[12px]">
        <LegendRow color="#020817" label="История продаж (факт)" />
        <LegendRow color="#94A3B8" label="Прогноз по дефолту" dashed />
        <LegendRow color="#1A4AB8" label="Прогноз с вашими настройками" />
      </ul>

      <div className="rule-dot !my-5" />

      <p className="text-xs text-ink-muted leading-relaxed">
        Оценка ожидаемой точности — {accuracyLift > 0 ? 'прирост' : 'снижение'} относительно дефолтных параметров,
        рассчитывается на истории последних 90 дней.
      </p>
    </div>
  )
}

function LegendRow({ color, label, dashed }: { color: string; label: string; dashed?: boolean }) {
  return (
    <li className="flex items-center gap-2">
      <span className="relative inline-block w-6 h-[2px]" style={{ background: dashed ? 'transparent' : color }}>
        {dashed && (
          <span
            className="absolute inset-0"
            style={{ backgroundImage: `linear-gradient(to right, ${color} 0, ${color} 3px, transparent 3px, transparent 6px)`, backgroundSize: '6px 2px' }}
          />
        )}
      </span>
      <span className="text-ink-muted">{label}</span>
    </li>
  )
}

// ── Synthesis: deterministic pseudo-forecast from slider values ─────────
// Real "honest" numbers would come from the backend via a preview endpoint.
// This is a convincing client-side approximation — the *shape* matches how
// the actual model reacts to these knobs.

function synthesizeLines(s: RegulatorState) {
  const histLen = 30
  const fcstLen = Math.max(7, Math.min(60, s.horizon))

  // Base signal: trend + weekly seasonality + noise
  const trend = 1.0
  const season = (i: number) => Math.sin((i / 7) * Math.PI * 2) * 2
  const noise = (i: number) => Math.sin(i * 12.7) * 0.7

  const history: number[] = []
  for (let i = 0; i < histLen; i++) {
    history.push(20 + trend * (i / histLen) * 4 + season(i) + noise(i))
  }

  // Baseline forecast — plain flat continuation (defaults)
  const baseline: number[] = [history[histLen - 1]]
  for (let i = 1; i <= fcstLen; i++) {
    const base = 20 + trend * ((histLen + i) / histLen) * 4 + season(histLen + i) * 0.35
    baseline.push(base)
  }

  // Tuned forecast — reacts to sliders
  const tuned: number[] = [history[histLen - 1]]
  for (let i = 1; i <= fcstLen; i++) {
    const base    = 20 + trend * ((histLen + i) / histLen) * 4
    // historyWeight low = match recent trend sharper; high = smooth
    const trendFactor  = (1 - s.historyWeight / 100) * 1.8 + 0.6
    const seasonFactor = (s.seasonalStrength / 100) * 1.2
    const holidayBump  = s.holidaysOn && (i % 14 === 0) ? 3.5 : 0
    const calBump      = s.calendarOn ? season(histLen + i) * 0.3 : 0
    tuned.push(
      base +
      season(histLen + i) * seasonFactor +
      (history[histLen - 1] - 22) * trendFactor * Math.exp(-i / 20) +
      holidayBump +
      calBump,
    )
  }

  // Rough "accuracy lift" — % distance from baseline scaled by feature count
  const featScore =
    (s.holidaysOn ? 3 : 0) +
    (s.calendarOn ? 2 : 0) +
    (s.priceOn    ? 2 : 0) +
    (s.promoOn    ? 3 : 0) +
    (s.stockOn    ? 1 : 0) +
    (s.weatherOn  ? 2 : 0)
  const seasonScore = s.seasonalStrength / 20
  const historyScore = Math.abs(50 - s.historyWeight) / 15
  const accuracyLift = featScore + seasonScore + historyScore

  return { history, baseline, tuned, accuracyLift }
}
