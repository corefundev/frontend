// ADM-3 (#256) + правки 2026-07-06: карточка клиента. ВСЕ операторские
// действия живут ЗДЕСЬ; каждое открытие аудируется сервером (H5).
// ADM-v3-9 (#394-5, прототип 1:1): карточка-ХАБ — шапка с ключевыми
// фактами (создан/последний вход/модель/PII) + чипы, колонка действий
// справа (ротация/разлогин/приостановка/стирание), табы Обзор/Качество/
// Данные/Аудит/Настройки. Подтверждения — модальные (AdminConfirmDialog,
// erase-now с вводом client_id), window.confirm/prompt из карточки убраны.
import { useState } from 'react'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { Link, useParams } from 'react-router-dom'
import toast from 'react-hot-toast'

import { apiClient, errorMessage } from '../../shared/api/client'
import { clientsApi, type ClientRecord } from '../../features/clients/api'
import { type PlanId } from '../../features/plans/api'
import { getNotifications } from '../../features/notifications/api'
import AdminConfirmDialog, { type ConfirmSpec } from '../../components/AdminConfirmDialog'
import AdminSelect from '../../components/AdminSelect'
import AdminQueryError from './AdminQueryError'
import QualityTrendSection from './QualityTrendSection'
import { SkeletonRows, StateRow } from './adminTable'
import { THEAD_CLS } from './adminTableUtils'

interface Overview {
  client: ClientRecord & { deleted_at?: string | null; pii_retention_days?: number }
  // LEG-2 #428: факт согласия при регистрации (null = записи нет —
  // клиент старше учёта согласий; undefined = старый бэкенд)
  consent?: { at: string; doc_versions: Record<string, number> } | null
  recent_logins: { at: string; ip: string | null; via: string | null }[]
  training_runs: {
    run_id: string; status: string; ended_at: string | null
    wmape: number | null; mase: number | null
    gate_passed: boolean | null
    model_path: string | null
  }[]
}

interface ClientUpload {
  upload_id: string; filename: string; size_bytes: number; status: string
  scan_result: string | null; error_message: string | null
  row_count: number | null; sku_count: number | null; created_at: string
}

interface ClientAuditEvent {
  id: number; ts: string; event_type: string; event_subtype: string | null
  ip: string | null; success: boolean
}

const PLAN_ORDER: PlanId[] = ['free', 'start', 'business']
const TABS = ['Обзор', 'Качество', 'Данные', 'Аудит', 'Настройки'] as const
type Tab = typeof TABS[number]


function MetaItem({ k, v }: { k: string; v: string }) {
  return (
    <div>
      <div className="text-[10.5px] font-bold uppercase tracking-widest text-ink-subtle">{k}</div>
      <div className="text-[13px] mt-0.5">{v}</div>
    </div>
  )
}

export default function AdminClientCardPage() {
  const { clientId = '' } = useParams()
  const qc = useQueryClient()
  const [tab, setTab] = useState<Tab>('Обзор')
  const [confirm, setConfirm] = useState<ConfirmSpec | null>(null)

  const { data, isLoading, isError, refetch } = useQuery({
    queryKey: ['admin-client-overview', clientId],
    queryFn: async () => {
      const { data } = await apiClient.get<Overview>(
        `/admin/clients/${encodeURIComponent(clientId)}/overview`)
      return data
    },
    enabled: !!clientId,
  })
  const { data: inbox } = useQuery({
    queryKey: ['notifications', clientId, 'admin-card'],
    queryFn: () => getNotifications(clientId, 5),
    enabled: !!clientId,
  })
  // ADM-v3-7 #392: config-override (read-only; admin bypass)
  const { data: cfg, isError: cfgError } = useQuery({
    queryKey: ['admin-client-config', clientId],
    queryFn: async () => {
      const { data } = await apiClient.get<{
        override: Record<string, unknown>
        diff: Record<string, { system: unknown; client: unknown }>
      }>(`/clients/${encodeURIComponent(clientId)}/config`)
      return data
    },
    enabled: !!clientId,
    meta: { silent: true },
  })
  // #394-5: вкладки Данные/Аудит — ленивая загрузка при открытии
  const { data: uploads, isLoading: uploadsLoading, isError: uploadsError } = useQuery({
    queryKey: ['admin-client-uploads', clientId],
    queryFn: async () => {
      const { data } = await apiClient.get<ClientUpload[]>(
        `/clients/${encodeURIComponent(clientId)}/uploads`, { params: { limit: 50 } })
      return data
    },
    enabled: !!clientId && tab === 'Данные',
    meta: { silent: true },
  })
  const { data: auditEvents, isLoading: auditLoading, isError: auditError } = useQuery({
    queryKey: ['admin-client-audit', clientId],
    queryFn: async () => {
      const { data } = await apiClient.get<{ events: ClientAuditEvent[] }>(
        `/clients/${encodeURIComponent(clientId)}/audit`, { params: { limit: 100 } })
      return data.events
    },
    enabled: !!clientId && tab === 'Аудит',
    meta: { silent: true },
  })

  const invalidate = () => {
    qc.invalidateQueries({ queryKey: ['admin-client-overview', clientId] })
    qc.invalidateQueries({ queryKey: ['admin-clients'] })
  }
  const planMut = useMutation({
    mutationFn: (plan: PlanId) => clientsApi.update(clientId, { plan }),
    onSuccess: () => { toast.success('Тариф обновлён'); invalidate() },
    onError: (e) => toast.error(errorMessage(e, 'Не удалось обновить тариф')),
  })
  const suspendMut = useMutation({
    mutationFn: (on: boolean) =>
      on ? clientsApi.suspend(clientId) : clientsApi.unsuspend(clientId),
    onSuccess: (_r, on) => {
      toast.success(on ? 'Клиент заблокирован' : 'Клиент разблокирован')
      invalidate()
    },
    onError: (e) => toast.error(errorMessage(e, 'Не удалось изменить статус')),
  })
  const rotateMut = useMutation({
    mutationFn: () => clientsApi.rotateApiKey(clientId),
    onSuccess: (r) => {
      // one-time display — сервер хранит только hash; показываем в модалке
      // с копированием (прототип: никаких window.prompt)
      setConfirm({
        title: 'Новый API-ключ (показывается один раз)',
        body: r.api_key,
        actionLabel: 'Скопировать и закрыть',
        onConfirm: () => {
          void navigator.clipboard?.writeText(r.api_key)
          toast.success('Ключ скопирован в буфер')
        },
      })
    },
    onError: (e) => toast.error(errorMessage(e, 'Не удалось ротировать ключ')),
  })
  const revokeMut = useMutation({
    mutationFn: () => clientsApi.revokeSessions(clientId),
    onSuccess: () => { toast.success('Все сессии клиента завершены'); invalidate() },
    onError: (e) => toast.error(errorMessage(e, 'Не удалось завершить сессии')),
  })
  const eraseMut = useMutation({
    mutationFn: () => clientsApi.eraseNow(clientId),
    onSuccess: (r) => {
      toast.success(r.already_purged ? 'Данные уже были стёрты'
        : `Данные стёрты (объектов: ${r.objects_deleted ?? 0})`)
      invalidate()
    },
    onError: (e) => toast.error(errorMessage(e, 'Стирание не выполнено')),
  })

  const c = data?.client

  if (isError) {
    return (
      <div className="max-w-5xl space-y-4">
        <Link to="/admin/clients" className="text-sm text-ink-muted hover:text-ink">← Клиенты</Link>
        <AdminQueryError what="карточку клиента" onRetry={() => void refetch()} />
      </div>
    )
  }
  if (isLoading || !c) {
    return (
      <div className="max-w-5xl card-paper p-6 animate-pulse space-y-3" aria-label="Загрузка карточки">
        <div className="h-6 w-52 rounded bg-surface-muted" />
        <div className="h-3 w-80 rounded bg-surface-muted" />
        <div className="h-3 w-64 rounded bg-surface-muted" />
      </div>
    )
  }

  const lastLogin = data.recent_logins[0]
  const champion = data.training_runs.find(
    (r) => r.status === 'finished' && r.model_path != null)
  const modelAgeDays = champion?.ended_at
    ? Math.round((Date.now() - new Date(champion.ended_at).getTime()) / 86400000)
    : null
  const piiState = c.status === 'purged' ? 'данные стёрты'
    : c.deleted_at ? 'аккаунт закрыт' : 'аккаунт открыт'

  return (
    <div className="space-y-4 max-w-5xl">
      <Link to="/admin/clients" className="text-sm text-ink-muted hover:text-ink">← Клиенты</Link>

      <div className="card-paper overflow-hidden">
        {/* ── Шапка-hub (прототип): факты слева, действия справа ── */}
        <div className="p-5 flex gap-5 items-start flex-wrap">
          <div className="min-w-0">
            <div className="flex items-center gap-2.5 flex-wrap">
              <span className="font-mono text-[22px] font-semibold tracking-tight">{c.client_id}</span>
              <span className="badge-info">{c.plan}</span>
              {c.suspended_at
                ? <span className="badge-danger">заблокирован</span>
                : <span className="badge-success">активен</span>}
            </div>
            <div className="flex gap-6 mt-3 flex-wrap">
              <MetaItem k="Создан" v={new Date(c.created_at).toLocaleDateString('ru-RU')} />
              <MetaItem k="Последний вход" v={lastLogin
                ? `${new Date(lastLogin.at).toLocaleDateString('ru-RU')}${lastLogin.via ? ` · ${lastLogin.via}` : ''}`
                : '—'} />
              <MetaItem k="Модель" v={champion
                ? `чемпион · ${modelAgeDays} дн` : 'нет промоутнутой'} />
              <MetaItem k="PII" v={piiState} />
            </div>
          </div>
          <div className="ml-auto flex flex-col gap-1.5 min-w-[190px]">
            <button type="button" className="btn-secondary text-xs"
                    disabled={rotateMut.isPending}
                    onClick={() => setConfirm({
                      title: 'Ротация API-ключа',
                      body: 'Старый ключ перестанет работать немедленно. Новый будет показан один раз.',
                      actionLabel: 'Ротировать',
                      onConfirm: () => rotateMut.mutate(),
                    })}>
              Ротация api-ключа
            </button>
            <button type="button" className="btn-secondary text-xs"
                    disabled={revokeMut.isPending}
                    onClick={() => setConfirm({
                      title: 'Завершить все сессии',
                      body: 'Текущие токены клиента перестанут работать немедленно; аккаунт не меняется.',
                      actionLabel: 'Завершить',
                      onConfirm: () => revokeMut.mutate(),
                    })}>
              Разлогинить все сессии
            </button>
            <button type="button" className="btn-secondary text-xs"
                    disabled={suspendMut.isPending}
                    onClick={() => {
                      const on = !c.suspended_at
                      setConfirm({
                        title: on ? 'Заблокировать клиента' : 'Разблокировать клиента',
                        body: on
                          ? `Доступ «${c.client_id}» к API прекратится немедленно; данные сохранятся.`
                          : `Вернуть «${c.client_id}» доступ к API?`,
                        actionLabel: on ? 'Заблокировать' : 'Разблокировать',
                        danger: on,
                        onConfirm: () => suspendMut.mutate(on),
                      })
                    }}>
              {c.suspended_at ? 'Разблокировать' : 'Приостановить'}
            </button>
            <button type="button"
                    className="btn text-xs ring-1 ring-danger text-danger hover:bg-danger-bg rounded-md px-3 py-1.5 font-semibold disabled:opacity-50"
                    disabled={eraseMut.isPending || c.status === 'purged' || !c.deleted_at}
                    title={c.status === 'purged' ? 'Данные уже стёрты'
                      : !c.deleted_at ? 'Доступно только после закрытия аккаунта клиентом' : undefined}
                    onClick={() => setConfirm({
                      title: 'Стереть данные немедленно',
                      body: 'Стирание ПДн, не дожидаясь срока хранения. Действие необратимо; идёт тем же fail-closed путём, что ежедневный крон.',
                      actionLabel: 'Стереть навсегда',
                      danger: true,
                      confirmText: c.client_id,
                      onConfirm: () => eraseMut.mutate(),
                    })}>
              Стереть данные…
            </button>
          </div>
        </div>

        {/* ── Табы (прототип) ── */}
        <div className="flex gap-0.5 px-3 border-b border-surface-border" role="tablist">
          {TABS.map((t) => (
            <button key={t} type="button" role="tab" aria-selected={tab === t}
                    className={`px-3 py-2 text-[13px] font-semibold -mb-px border-b-2 transition-colors ${
                      tab === t ? '' : 'text-ink-subtle hover:text-ink-muted border-transparent'}`}
                    style={tab === t
                      ? { color: 'var(--admin-brand-ink)', borderBottomColor: 'var(--admin-brand)' }
                      : undefined}
                    onClick={() => setTab(t)}>
              {t}
            </button>
          ))}
        </div>

        {/* ── Обзор ── */}
        {tab === 'Обзор' && (
          <div className="p-5 space-y-5">
            <div className="grid grid-cols-2 gap-x-8 gap-y-2 text-sm">
              <div className="flex justify-between gap-4"><span className="text-ink-muted">Email</span><span>{c.email ?? '—'}</span></div>
              <div className="flex justify-between gap-4"><span className="text-ink-muted">Статус обучения</span><span>{c.status}</span></div>
              <div className="flex justify-between gap-4"><span className="text-ink-muted">Горизонт</span><span>{c.horizon} дн.</span></div>
              <div className="flex justify-between gap-4"><span className="text-ink-muted">SKU (обучено)</span><span>{c.trained_sku_count ?? '—'}</span></div>
            </div>
            <div className="flex items-center gap-3">
              <span className="text-sm text-ink-muted">Тариф:</span>
              <AdminSelect className="w-44" ariaLabel="Тариф клиента" value={c.plan}
                           onChange={(v) => {
                             const p = v as PlanId
                             if (p === c.plan || planMut.isPending) return
                             setConfirm({
                               title: 'Смена тарифа',
                               body: `Сменить тариф «${c.client_id}» на ${p}?`,
                               actionLabel: 'Сменить',
                               onConfirm: () => planMut.mutate(p),
                             })
                           }}
                           options={PLAN_ORDER.map((p) => ({ value: p, label: p }))} />
            </div>

            {/* Отдельные блоки-секции (стиль «Базы знаний»): 152-ФЗ на
                всю ширину, ниже — Активность и Уведомления бок о бок */}
            <section className="rounded-lg border border-surface-border overflow-hidden">
              <div className="px-4 py-2.5 border-b border-surface-border font-semibold text-[13px]">
                Персональные данные (152-ФЗ)
              </div>
              <div className="px-4 py-3">
                {c.status === 'purged' ? (
                  <div className="flex items-center gap-3 text-sm">
                    <span className="badge-neutral">данные стёрты</span>
                    <span className="text-ink-muted">аккаунт анонимизирован</span>
                  </div>
                ) : c.deleted_at ? (
                  <div className="flex items-center gap-3 text-sm">
                    <span className="badge-warn">аккаунт закрыт</span>
                    <span className="text-ink-muted">
                      закрыт {new Date(c.deleted_at).toLocaleDateString('ru-RU')}
                      {typeof c.pii_retention_days === 'number' && (() => {
                        const left = Math.ceil(
                          (new Date(c.deleted_at!).getTime() + c.pii_retention_days * 86400000
                            - Date.now()) / 86400000)
                        return ` · авто-стирание через ${Math.max(0, left)} дн. · кнопка «Стереть данные…» — в шапке`
                      })()}
                    </span>
                  </div>
                ) : (
                  <div className="text-sm text-ink-muted">
                    Аккаунт открыт. Немедленное стирание доступно только после закрытия аккаунта клиентом.
                  </div>
                )}
                {data.consent !== undefined && (
                  <div className="text-sm mt-2 pt-2 border-t border-surface-border flex items-center gap-2 flex-wrap">
                    <span className="text-ink-muted">Согласие на обработку:</span>
                    {data.consent ? (
                      <>
                        <span className="badge-success">принято</span>
                        <span className="text-ink-muted">
                          {new Date(data.consent.at).toLocaleString('ru-RU')}
                          {Object.keys(data.consent.doc_versions).length > 0 &&
                            ' · версии: ' + Object.entries(data.consent.doc_versions)
                              .map(([d, v]) => `${d} v${v}`).join(', ')}
                        </span>
                      </>
                    ) : (
                      <span className="text-ink-subtle">
                        записи нет (регистрация до введения учёта согласий)
                      </span>
                    )}
                  </div>
                )}
              </div>
            </section>

            <div className="grid grid-cols-2 gap-4 items-start">
              <section className="rounded-lg border border-surface-border overflow-hidden">
                <div className="px-4 py-2.5 border-b border-surface-border font-semibold text-[13px]">
                  Активность (входы)
                </div>
                <div className="px-4 py-2">
                  {!data.recent_logins.length ? (
                    <div className="text-sm text-ink-muted py-1.5">Входов не зафиксировано</div>
                  ) : (
                    <ul className="divide-y divide-surface-border text-sm">
                      {data.recent_logins.map((l, i) => (
                        <li key={i} className="py-1.5 flex justify-between">
                          <span className="text-xs text-ink-muted">{new Date(l.at).toLocaleString('ru-RU')}</span>
                          <span className="font-mono text-xs">{l.ip ?? '—'}{l.via ? ` · ${l.via}` : ''}</span>
                        </li>
                      ))}
                    </ul>
                  )}
                </div>
              </section>
              <section className="rounded-lg border border-surface-border overflow-hidden">
                <div className="px-4 py-2.5 border-b border-surface-border font-semibold text-[13px]">
                  Уведомления (последние)
                </div>
                <div className="px-4 py-2">
                  {!inbox?.notifications?.length ? (
                    <div className="text-sm text-ink-muted py-1.5">Пусто</div>
                  ) : (
                    <ul className="divide-y divide-surface-border text-sm">
                      {inbox.notifications.map((n) => (
                        <li key={n.id} className="py-1.5">
                          <span className="text-xs text-ink-muted mr-2">
                            {new Date(n.created_at).toLocaleDateString('ru-RU')}
                          </span>
                          {n.title}
                        </li>
                      ))}
                    </ul>
                  )}
                </div>
              </section>
            </div>
          </div>
        )}

        {/* ── Качество (прототип 1:1: только quality-grid) ── */}
        {tab === 'Качество' && (
          <div className="p-4">
            <QualityTrendSection runs={data.training_runs} bare />
          </div>
        )}

        {/* ── Данные ── */}
        {tab === 'Данные' && (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead className={THEAD_CLS}>
                <tr>
                  <th className="px-4 py-2 text-left">Время</th>
                  <th className="px-4 py-2 text-left">Файл</th>
                  <th className="px-4 py-2 text-left">Статус</th>
                  <th className="px-4 py-2 text-left">Строк / SKU</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-surface-border">
                {uploadsLoading ? (
                  <SkeletonRows cols={4} />
                ) : uploadsError ? (
                  <StateRow cols={4} kind="error" what="загрузки клиента" />
                ) : !uploads?.length ? (
                  <StateRow cols={4} kind="empty" what="загрузки" />
                ) : uploads.map((u) => (
                  <tr key={u.upload_id} className={u.scan_result ? 'bg-red-50/50' : ''}>
                    <td className="px-4 py-2 text-xs text-ink-muted whitespace-nowrap">
                      {new Date(u.created_at).toLocaleString('ru-RU')}
                    </td>
                    <td className="px-4 py-2 text-xs">{u.filename}</td>
                    <td className="px-4 py-2">
                      <span className="badge-neutral">{u.status}</span>
                      {u.scan_result && <span className="badge-danger ml-1">⚠ {u.scan_result}</span>}
                    </td>
                    <td className="px-4 py-2 font-mono text-xs">
                      {u.row_count ?? '—'} / {u.sku_count ?? '—'}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}

        {/* ── Аудит ── */}
        {tab === 'Аудит' && (
          <div className="overflow-x-auto max-h-[55vh] overflow-y-auto">
            <table className="w-full text-sm">
              <thead className={THEAD_CLS}>
                <tr>
                  <th className="px-4 py-2 text-left">Время</th>
                  <th className="px-4 py-2 text-left">Событие</th>
                  <th className="px-4 py-2 text-left">IP</th>
                  <th className="px-4 py-2 text-left">Статус</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-surface-border">
                {auditLoading ? (
                  <SkeletonRows cols={4} />
                ) : auditError ? (
                  <StateRow cols={4} kind="error" what="аудит клиента" />
                ) : !auditEvents?.length ? (
                  <StateRow cols={4} kind="empty" what="события" />
                ) : auditEvents.map((e) => (
                  <tr key={e.id}>
                    <td className="px-4 py-2 text-xs text-ink-muted whitespace-nowrap">
                      {new Date(e.ts).toLocaleString('ru-RU')}
                    </td>
                    <td className="px-4 py-2 font-mono text-xs">
                      {e.event_type}{e.event_subtype ? `/${e.event_subtype}` : ''}
                    </td>
                    <td className="px-4 py-2 font-mono text-xs">{e.ip ?? '—'}</td>
                    <td className="px-4 py-2">
                      {e.success
                        ? <span className="badge-success">ok</span>
                        : <span className="badge-danger">fail</span>}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}

        {/* ── Настройки (ADM-v3-7 #392, read-only) ── */}
        {tab === 'Настройки' && (
          <div>
            <div className="px-5 py-3 text-xs text-ink-muted">
              read-only · правка настроек — право клиента
            </div>
            {cfgError ? (
              <div className="px-5 pb-4 text-sm"><span className="badge-danger">настройки недоступны</span></div>
            ) : !cfg ? (
              <div className="px-5 pb-4 text-sm text-ink-muted">Загрузка…</div>
            ) : !Object.keys(cfg.diff).length ? (
              <div className="px-5 pb-4 text-sm text-ink-muted">
                Клиент ничего не переопределял — действуют настройки системы и тарифа.
              </div>
            ) : (
              <table className="w-full text-sm">
                <thead className={THEAD_CLS}>
                  <tr>
                    <th className="px-5 py-2 text-left">Ключ</th>
                    <th className="px-3 py-2 text-left">Система / тариф</th>
                    <th className="px-3 py-2 text-left">Клиент</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-surface-border">
                  {Object.entries(cfg.diff).map(([key, v]) => (
                    <tr key={key} className="bg-amber-50/40">
                      <td className="px-5 py-2 font-mono text-xs">{key}</td>
                      <td className="px-3 py-2 font-mono text-xs text-ink-muted">
                        {JSON.stringify(v.system)}
                      </td>
                      <td className="px-3 py-2 font-mono text-xs font-semibold">
                        {JSON.stringify(v.client)}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            )}
          </div>
        )}
      </div>

      <AdminConfirmDialog spec={confirm} onClose={() => setConfirm(null)} />
    </div>
  )
}
