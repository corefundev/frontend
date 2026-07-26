import { Link } from 'react-router-dom'
import { useQuery } from '@tanstack/react-query'

import { QualityCard } from '../../features/training/QualityCard'
import { formatDistanceToNow, parseISO } from 'date-fns'
import { ru } from 'date-fns/locale'

import { useAuthStore } from '../../features/auth/store'
import { useUsage } from '../../features/plans/useUsage'
import { uploadsApi } from '../../features/uploads/api'
import { clientsApi } from '../../features/clients/api'
import { UpgradeTrigger } from '../../features/plans/upsell'
import { cabPath } from '../../shared/hostRouting'

// ─────────────────────────────────────────────────────────────────────────
//  Dashboard — the "front page" of the newspaper.
//
//  Priorities (top to bottom):
//    1. Warm greeting + who am I + what's the state of my catalog (SKU
//       snapshot, plan, model)
//    2. Last activity — most recent upload / training / forecast
//    3. Four "quick action" tiles as editorial dept boxes
//    4. Contextual upsell (only if user is Free + has seen any forecast)
//
//  No dashboards in the BI sense (charts of charts). The goal here is
//  orientation + invitation-to-next-step, not analytics.
// ─────────────────────────────────────────────────────────────────────────

function greeting(): string {
  const h = new Date().getHours()
  if (h < 6)  return 'Доброй ночи'
  if (h < 12) return 'Доброе утро'
  if (h < 18) return 'Добрый день'
  return 'Добрый вечер'
}

export default function DashboardPage() {
  const clientId = useAuthStore((s) => s.clientId)!
  const { data: usage } = useUsage()

  const { data: client } = useQuery({
    queryKey: ['client', clientId],
    queryFn:  () => clientsApi.get(clientId),
  })

  const { data: uploads = [] } = useQuery({
    queryKey: ['uploads', clientId],
    queryFn:  () => uploadsApi.list(clientId, 5),
  })

  const lastProcessed = uploads.find((u) => u.status === 'processed')
  const lastAny       = uploads[0]
  const hasTrained    = !!client?.last_trained_at
  const isFree        = usage?.plan === 'free'

  return (
    <div className="max-w-6xl space-y-12">
      {/* ═══════════════════ GREETING ═══════════════════ */}
      <header>
        <div className="eyebrow">{new Date().toLocaleDateString('ru-RU', { day: 'numeric', month: 'long', year: 'numeric' })}</div>
        <h1 className="display-em text-brand-700 text-4xl sm:text-6xl mt-2 leading-[1.02]">
          {greeting()},{' '}
          <span className="font-mono text-3xl sm:text-5xl text-ink">{clientId}</span>.
        </h1>
        {usage && (
          <p className="mt-4 text-ink-muted text-lg max-w-2xl">
            Тариф <strong className="text-ink">{usage.display_name}</strong>,
            модель <strong className="text-ink">{usage.model_display_name}</strong> — {' '}
            {lastProcessed
              ? <>вы работаете с <span className="num text-brand-700 font-semibold">{lastProcessed.sku_count ?? '—'}</span> позициями.</>
              : 'данных ещё нет — начните с загрузки.'}
          </p>
        )}
      </header>

      {/* ═══════════════════ LAST ACTIVITY ═══════════════════ */}
      {lastAny && (
        <section className="grid gap-6 lg:grid-cols-12">
          <div className="lg:col-span-7">
            <div className="rule-dot mb-6" />
            <div className="eyebrow">Последняя активность</div>
            <div className="mt-3 grid sm:grid-cols-2 gap-5">
              <ActivityCard
                eyebrow="Последняя загрузка"
                titleBig={lastAny.filename}
                meta={fmtDistance(lastAny.created_at)}
                tail={
                  <span className={`badge-${lastAny.status === 'processed' ? 'success' : lastAny.status === 'infected' ? 'danger' : 'info'}`}>
                    {statusLabel(lastAny.status)}
                  </span>
                }
                href={cabPath(cabPath('/app/data'))}
              />
              <ActivityCard
                eyebrow="Последнее обучение"
                titleBig={
                  hasTrained
                    ? fmtDistance(client!.last_trained_at!)
                    : 'ещё не запускалось'
                }
                meta={
                  client?.last_wmape != null
                    ? `WMAPE ${(client.last_wmape * 100).toFixed(1)}%`
                    : 'пока нет метрик'
                }
                tail={
                  <span className={`badge-${client?.status === 'ready' ? 'success' : 'neutral'}`}>
                    {client?.status === 'ready' ? 'готова' : (client?.status ?? '—')}
                  </span>
                }
                href={cabPath(cabPath('/app/training'))}
              />
            </div>

            {clientId && (
              <div className="mt-5">
                <QualityCard clientId={clientId} />
              </div>
            )}
          </div>

          {/* Sidecard — upcoming suggestion based on state */}
          <aside className="lg:col-span-5">
            <NextStepCard
              hasUploads={uploads.length > 0}
              hasTrained={hasTrained}
              hasProcessed={!!lastProcessed}
            />
          </aside>
        </section>
      )}

      {/* ═══════════════════ ZERO STATE — DESTINATION ═══════════════════ */}
      {!lastAny && (
        <section className="card-paper p-8 sm:p-12 text-center relative overflow-hidden">
          <span
            aria-hidden
            className="absolute -top-10 -right-4 display-em text-gold-300/30 text-[18rem] leading-none pointer-events-none"
          >
            00
          </span>
          <div className="relative">
            <div className="chapter-num">— давайте начнём</div>
            <h2 className="display-em text-brand-700 text-3xl sm:text-4xl mt-2 max-w-xl mx-auto leading-tight">
              Первый прогноз за пять минут.
            </h2>
            <p className="text-paper-ink/80 mt-4 max-w-md mx-auto leading-relaxed">
              Создайте датасет и загрузите историю продаж — мы подготовим
              данные и покажем первый прогноз на них.
            </p>
            <div className="mt-6 flex items-center justify-center gap-3">
              <Link to={cabPath(cabPath('/app/data'))} className="btn-gold">
                Загрузить данные →
              </Link>
            </div>
          </div>
        </section>
      )}

      {/* ═══════════════════ QUICK ACTIONS ═══════════════════ */}
      <section>
        <div className="rule-dot mb-6" />
        <div className="eyebrow">Разделы</div>
        <h2 className="display-em text-brand-700 text-2xl sm:text-3xl mt-2 mb-6">
          Куда пойти дальше.
        </h2>

        <div className="grid sm:grid-cols-2 lg:grid-cols-4 gap-5">
          <QuickTile
            number="01"
            title="Загрузки"
            blurb="Новый CSV с продажами"
            href={cabPath(cabPath('/app/data'))}
            icon={<IconUpload />}
          />
          <QuickTile
            number="02"
            title="Прогнозы"
            blurb="Посмотреть, что продастся"
            href={cabPath(cabPath('/app/forecasts'))}
            icon={<IconChart />}
            highlight={hasTrained}
          />
          <QuickTile
            number="03"
            title="Обучение"
            blurb="Перетренировать модель"
            href={cabPath(cabPath('/app/training'))}
            icon={<IconCog />}
          />
          <QuickTile
            number="04"
            title="Настройки"
            blurb="Конструктор под бизнес"
            href={cabPath(cabPath('/app/settings'))}
            icon={<IconSlider />}
            planNote={isFree ? 'доступно на Start' : undefined}
          />
        </div>
      </section>

      {/* ═══════════════════ UPSELL ═══════════════════ */}
      {isFree && hasTrained && (
        <section>
          <UpgradeTrigger variant="first-forecast" />
        </section>
      )}
    </div>
  )
}

// ─────────────────────────────────────────────────────────────────────────
//  Helpers
// ─────────────────────────────────────────────────────────────────────────

function fmtDistance(iso: string): string {
  try {
    return formatDistanceToNow(parseISO(iso), { addSuffix: true, locale: ru })
  } catch {
    return iso
  }
}

function statusLabel(s: string): string {
  return ({
    uploaded:          'принято',
    scanning:          'сканируется',
    scanned_clean:     'проверен',
    infected:          'вирус',
    processing:        'разбирается',
    processed:         'готово',
    processing_failed: 'ошибка',
  } as Record<string, string>)[s] ?? s
}

// ─────────────────────────────────────────────────────────────────────────
//  ActivityCard — editorial feature box for last upload / last training
// ─────────────────────────────────────────────────────────────────────────

function ActivityCard({
  eyebrow, titleBig, meta, tail, href,
}: {
  eyebrow: string
  titleBig: string
  meta: string
  tail: React.ReactNode
  href: string
}) {
  return (
    <Link
      to={href}
      className="card p-5 block transition-all hover:shadow-panel hover:-translate-y-[1px]"
    >
      <div className="flex items-start justify-between gap-4">
        <div className="min-w-0">
          <div className="eyebrow">{eyebrow}</div>
          <div className="font-mono text-sm truncate mt-1.5" title={titleBig}>
            {titleBig}
          </div>
          <div className="eyebrow mt-1">{meta}</div>
        </div>
        <div className="shrink-0">{tail}</div>
      </div>
    </Link>
  )
}

// ─────────────────────────────────────────────────────────────────────────
//  NextStepCard — decides what to invite the user to do next
// ─────────────────────────────────────────────────────────────────────────

function NextStepCard({
  hasUploads, hasTrained, hasProcessed,
}: {
  hasUploads: boolean
  hasTrained: boolean
  hasProcessed: boolean
}) {
  let chapter  = '— следующий шаг'
  let title    = 'Загрузить данные'
  let blurb    = 'CSV с историей продаж — точка отсчёта для всего.'
  let cta      = 'К загрузке'
  let href     = cabPath('/app/data')

  if (hasUploads && !hasProcessed) {
    chapter = '— подождите чуть-чуть'
    title   = 'Файл обрабатывается'
    blurb   = 'Проверка и разбор занимают до минуты. Следите в разделе Загрузки.'
    cta     = 'К загрузкам'
    href    = cabPath('/app/data')
  } else if (hasProcessed && !hasTrained) {
    chapter = '— обучите модель'
    title   = 'Данные готовы'
    blurb   = 'Теперь запустите обучение — получите прогноз через несколько минут.'
    cta     = 'Запустить обучение'
    href    = '/training'
  } else if (hasTrained) {
    chapter = '— прогноз в работе'
    title   = 'Смотрите, что предсказано'
    blurb   = 'Откройте прогнозы и разберитесь, почему модель считает именно так.'
    cta     = 'Открыть прогнозы'
    href    = '/forecasts'
  }

  return (
    <div className="card-paper p-6 sm:p-7 h-full relative overflow-hidden">
      <span aria-hidden className="absolute -top-8 -right-4 display-em text-gold-300/40 text-[8rem] leading-none pointer-events-none">
        →
      </span>
      <div className="relative">
        <div className="chapter-num">{chapter}</div>
        <div className="display-em text-brand-700 text-2xl mt-1.5">{title}</div>
        <p className="text-paper-ink/75 mt-3 text-sm leading-relaxed max-w-sm">{blurb}</p>
        <Link to={href} className="btn-gold mt-5 inline-flex">{cta} →</Link>
      </div>
    </div>
  )
}

// ─────────────────────────────────────────────────────────────────────────
//  QuickTile — dept box in the sections grid
// ─────────────────────────────────────────────────────────────────────────

function QuickTile({
  number, title, blurb, href, icon, highlight, planNote,
}: {
  number: string
  title: string
  blurb: string
  href: string
  icon: React.ReactNode
  highlight?: boolean
  planNote?: string
}) {
  return (
    <Link
      to={href}
      className={[
        'card p-5 flex flex-col gap-4 group transition-all',
        'hover:shadow-panel hover:-translate-y-[1px]',
        highlight ? 'ring-2 ring-gold-500' : '',
      ].join(' ')}
    >
      <div className="flex items-baseline justify-between">
        <div className="chapter-num">{number}</div>
        <div className="h-8 w-8 rounded-full bg-brand-50 flex items-center justify-center text-brand-700">
          {icon}
        </div>
      </div>
      <div>
        <div className="display-em text-brand-700 text-xl leading-tight">{title}</div>
        <div className="text-sm text-ink-muted mt-1">{blurb}</div>
      </div>
      {planNote && (
        <div className="mt-auto eyebrow text-gold-600">{planNote}</div>
      )}
    </Link>
  )
}

// ── Inline icons for tiles ──────────────────────────────────────────────

function IconUpload() {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.75"
         strokeLinecap="round" strokeLinejoin="round" className="h-4 w-4">
      <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4" />
      <path d="M17 8l-5-5-5 5" />
      <path d="M12 3v12" />
    </svg>
  )
}
function IconChart() {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.75"
         strokeLinecap="round" strokeLinejoin="round" className="h-4 w-4">
      <path d="M3 3v18h18" />
      <path d="M7 14l4-4 4 4 6-6" />
    </svg>
  )
}
function IconCog() {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.75"
         strokeLinecap="round" strokeLinejoin="round" className="h-4 w-4">
      <circle cx="12" cy="12" r="3" />
      <path d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 1 1-2.83 2.83l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 1 1-4 0v-.09a1.65 1.65 0 0 0-1-1.51 1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 1 1-2.83-2.83l.06-.06a1.65 1.65 0 0 0 .33-1.82 1.65 1.65 0 0 0-1.51-1H3a2 2 0 1 1 0-4h.09A1.65 1.65 0 0 0 4.6 9a1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 1 1 2.83-2.83l.06.06a1.65 1.65 0 0 0 1.82.33H9a1.65 1.65 0 0 0 1-1.51V3a2 2 0 1 1 4 0v.09a1.65 1.65 0 0 0 1 1.51 1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 1 1 2.83 2.83l-.06.06a1.65 1.65 0 0 0-.33 1.82V9a1.65 1.65 0 0 0 1.51 1H21a2 2 0 1 1 0 4h-.09a1.65 1.65 0 0 0-1.51 1z" />
    </svg>
  )
}
function IconSlider() {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.75"
         strokeLinecap="round" strokeLinejoin="round" className="h-4 w-4">
      <line x1="4" y1="21" x2="4" y2="14" />
      <line x1="4" y1="10" x2="4" y2="3" />
      <line x1="12" y1="21" x2="12" y2="12" />
      <line x1="12" y1="8" x2="12" y2="3" />
      <line x1="20" y1="21" x2="20" y2="16" />
      <line x1="20" y1="12" x2="20" y2="3" />
      <line x1="1" y1="14" x2="7" y2="14" />
      <line x1="9" y1="8" x2="15" y2="8" />
      <line x1="17" y1="16" x2="23" y2="16" />
    </svg>
  )
}
