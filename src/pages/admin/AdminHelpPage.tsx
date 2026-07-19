// HC-3 (#335): «База знаний» — управление категориями и статьями,
// стилистика консоли. Категории слева (создание/правка инлайн-формой),
// статьи справа (THEAD-таблица, фильтры, «Новая статья»).
import { useState } from 'react'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { Link } from 'react-router-dom'
import toast from 'react-hot-toast'

import { errorMessage } from '../../shared/api/client'
import {
  helpAdminApi, type HelpCategoryAdmin, type HelpCategoryPayload,
  type HelpStatus,
} from '../../features/help/adminApi'
import AdminSelect from '../../components/AdminSelect'
import AdminQueryError from './AdminQueryError'
import { SkeletonRows, StateRow } from './adminTable'
import { THEAD_CLS } from './adminTableUtils'
import { admPath } from '../../shared/hostRouting'

const EMPTY_CAT: HelpCategoryPayload = {
  slug: '', title: '', description: '', icon: '', sort_order: 0,
}

function StatusChip({ status }: { status: HelpStatus }) {
  if (status === 'draft') return <span className="badge-neutral">черновик</span>
  if (status === 'archived') return <span className="badge-neutral">архив</span>
  return <span className="badge-success">опубликована</span>
}

export default function AdminHelpPage() {
  const qc = useQueryClient()
  const [catForm, setCatForm] = useState<HelpCategoryPayload>(EMPTY_CAT)
  const [editCatId, setEditCatId] = useState<string | null>(null)
  const [filterCat, setFilterCat] = useState('')
  const [filterStatus, setFilterStatus] = useState<HelpStatus | ''>('')

  const { data: cats = [], isError: catsError, refetch: refetchCats } = useQuery({
    queryKey: ['admin-help-categories'],
    queryFn: () => helpAdminApi.categories(),
  })
  const { data: arts, isError: artsError, isLoading: artsLoading } = useQuery({
    queryKey: ['admin-help-articles', filterCat, filterStatus],
    queryFn: () => helpAdminApi.articles({
      ...(filterCat ? { category_id: filterCat } : {}),
      ...(filterStatus ? { status: filterStatus } : {}),
    }),
  })

  const catMut = useMutation({
    mutationFn: () => editCatId
      ? helpAdminApi.updateCategory(editCatId, {
          title: catForm.title, description: catForm.description,
          icon: catForm.icon, sort_order: catForm.sort_order,
        })
      : helpAdminApi.createCategory(catForm),
    onSuccess: () => {
      toast.success(editCatId ? 'Категория обновлена' : 'Категория создана')
      setCatForm(EMPTY_CAT)
      setEditCatId(null)
      qc.invalidateQueries({ queryKey: ['admin-help-categories'] })
    },
    onError: (e) => toast.error(errorMessage(e, 'Не удалось сохранить категорию')),
  })

  const startEdit = (c: HelpCategoryAdmin) => {
    setEditCatId(c.id)
    setCatForm({ slug: c.slug, title: c.title, description: c.description,
                 icon: c.icon, sort_order: c.sort_order })
  }
  const catTitle = (id: string) => cats.find((c) => c.id === id)?.title ?? '—'

  return (
    <div className="space-y-4 max-w-5xl">
      {(catsError || artsError) && (
        <AdminQueryError what="базу знаний" onRetry={() => void refetchCats()} />
      )}
      <div className="grid grid-cols-[1fr_1.8fr] gap-3 items-start">
        {/* ── категории ── */}
        <section className="card-paper overflow-hidden">
          <div className="px-4 py-2.5 border-b border-surface-border font-semibold text-[13px]">
            Категории
          </div>
          <ul className="divide-y divide-surface-border">
            {cats.map((c) => (
              <li key={c.id}
                  className={`px-4 py-2 flex items-center gap-2 cursor-pointer hover:bg-surface-muted/60 ${
                    editCatId === c.id ? 'bg-surface-muted/60' : ''}`}
                  onClick={() => startEdit(c)}>
                <div className="min-w-0">
                  <div className="text-[13px] font-medium truncate">
                    {c.icon && <span className="mr-1">{c.icon}</span>}{c.title}
                  </div>
                  <div className="font-mono text-[11px] text-ink-subtle">/{c.slug}</div>
                </div>
                <span className="ml-auto text-[11px] text-ink-subtle tabular-nums whitespace-nowrap">
                  {c.published_count}/{c.total_count} publ.
                </span>
              </li>
            ))}
            {!cats.length && (
              <li className="px-4 py-4 text-sm text-ink-muted">Категорий пока нет</li>
            )}
          </ul>
          <form className="p-4 border-t border-surface-border space-y-2"
                onSubmit={(e) => { e.preventDefault(); catMut.mutate() }}>
            <div className="text-xs font-semibold text-ink-muted">
              {editCatId ? 'Правка категории' : 'Новая категория'}
            </div>
            <div className="grid grid-cols-2 gap-2">
              <input className="input text-sm" placeholder="Название" value={catForm.title}
                     onChange={(e) => setCatForm({ ...catForm, title: e.target.value })} />
              <input className="input text-sm font-mono" placeholder="slug"
                     value={catForm.slug} disabled={!!editCatId}
                     onChange={(e) => setCatForm({ ...catForm, slug: e.target.value })} />
            </div>
            <div className="grid grid-cols-[1fr_70px_70px] gap-2">
              <input className="input text-sm" placeholder="Описание"
                     value={catForm.description ?? ''}
                     onChange={(e) => setCatForm({ ...catForm, description: e.target.value })} />
              <input className="input text-sm" placeholder="icon" title="эмодзи-иконка"
                     value={catForm.icon ?? ''}
                     onChange={(e) => setCatForm({ ...catForm, icon: e.target.value })} />
              <input className="input text-sm" type="number" title="порядок"
                     value={catForm.sort_order ?? 0}
                     onChange={(e) => setCatForm({ ...catForm, sort_order: Number(e.target.value) })} />
            </div>
            <div className="flex gap-2">
              <button type="submit" className="btn-secondary text-xs"
                      disabled={catMut.isPending || !catForm.title || !catForm.slug}>
                {editCatId ? 'Сохранить' : 'Создать'}
              </button>
              {editCatId && (
                <button type="button" className="btn-ghost text-xs"
                        onClick={() => { setEditCatId(null); setCatForm(EMPTY_CAT) }}>
                  Отмена
                </button>
              )}
            </div>
          </form>
        </section>

        {/* ── статьи ── */}
        <section className="card-paper overflow-hidden">
          <div className="px-4 py-2.5 border-b border-surface-border flex items-center gap-2">
            <span className="font-semibold text-[13px]">Статьи</span>
            <AdminSelect className="w-40 ml-2" ariaLabel="Фильтр по категории" value={filterCat}
                         onChange={setFilterCat}
                         options={[{ value: '', label: 'Все категории' },
                                   ...cats.map((c) => ({ value: c.id, label: c.title }))]} />
            <AdminSelect className="w-36" ariaLabel="Фильтр по статусу" value={filterStatus}
                         onChange={(v) => setFilterStatus(v as HelpStatus | '')}
                         options={[{ value: '', label: 'Все статусы' },
                                   { value: 'draft', label: 'черновики' },
                                   { value: 'published', label: 'опубликованные' },
                                   { value: 'archived', label: 'архив' }]} />
            <Link to={admPath('/admin/help/new')} className="btn-primary text-xs ml-auto">
              Новая статья
            </Link>
          </div>
          <div className="overflow-x-auto max-h-[65vh] overflow-y-auto">
            <table className="w-full text-sm">
              <thead className={THEAD_CLS}>
                <tr>
                  <th className="px-4 py-2 text-left">Статья</th>
                  <th className="px-4 py-2 text-left">Категория</th>
                  <th className="px-4 py-2 text-left">Статус</th>
                  <th className="px-4 py-2 text-right">Просмотры</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-surface-border">
                {artsLoading ? (
                  <SkeletonRows cols={4} />
                ) : artsError ? (
                  <StateRow cols={4} kind="error" what="статьи" />
                ) : !arts?.articles.length ? (
                  <StateRow cols={4} kind="empty" what="статьи" />
                ) : arts.articles.map((a) => (
                  <tr key={a.id} className="hover:bg-surface-muted/60">
                    <td className="px-4 py-2">
                      <Link to={admPath(`/admin/help/${encodeURIComponent(a.id)}`)}
                            className="font-medium hover:underline">{a.title}</Link>
                      <div className="font-mono text-[11px] text-ink-subtle">/{a.slug}</div>
                    </td>
                    <td className="px-4 py-2 text-xs">{catTitle(a.category_id)}</td>
                    <td className="px-4 py-2"><StatusChip status={a.status} /></td>
                    <td className="px-4 py-2 text-right font-mono text-xs tabular-nums">
                      {a.view_count}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </section>
      </div>
      {/* ── HC-6: аналитика контента ── */}
      <ContentAnalyticsSection />
      {/* ── HC-5: аналитика поиска ── */}
      <SearchInsightsSection />
      <div className="text-xs text-ink-muted">
        Публичный центр показывает только опубликованные статьи; категории
        без опубликованных статей на витрине скрываются автоматически.
      </div>
    </div>
  )
}

// HC-6: просмотры/голоса/доля «полезно» (низкорейтинговые сверху) +
// последние комментарии читателей. Ratio null (нет голосов) — «—».
function ContentAnalyticsSection() {
  const { data, isError } = useQuery({
    queryKey: ['admin-help-analytics'],
    queryFn: () => helpAdminApi.analytics(),
  })
  if (isError) return null
  const rows = [...(data?.articles ?? [])].sort((a, b) => {
    if (a.helpful_ratio === null && b.helpful_ratio === null) return b.view_count - a.view_count
    if (a.helpful_ratio === null) return 1
    if (b.helpful_ratio === null) return -1
    return a.helpful_ratio - b.helpful_ratio
  })
  const pct = (r: number | null) => (r === null ? '—' : `${Math.round(r * 100)}%`)
  return (
    <div className="grid grid-cols-[1.4fr_1fr] gap-3 items-start">
      <section className="card-paper overflow-hidden">
        <div className="px-4 py-2.5 border-b border-surface-border flex items-baseline gap-2">
          <span className="font-semibold text-[13px]">Аналитика контента</span>
          <span className="text-[11px] text-ink-subtle">низкорейтинговые — сверху</span>
        </div>
        <div className="overflow-x-auto max-h-80 overflow-y-auto">
          <table className="w-full text-sm">
            <thead className={THEAD_CLS}>
              <tr>
                <th className="px-4 py-2 text-left">Статья</th>
                <th className="px-4 py-2 text-right">Просмотры</th>
                <th className="px-4 py-2 text-right">Голоса</th>
                <th className="px-4 py-2 text-right">Полезно</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-surface-border">
              {!rows.length ? (
                <StateRow cols={4} kind="empty" what="статистику" />
              ) : rows.map((r) => (
                <tr key={r.id} className="hover:bg-surface-muted/60">
                  <td className="px-4 py-2">
                    <Link to={admPath(`/admin/help/${encodeURIComponent(r.id)}`)}
                          className="hover:underline">{r.title}</Link>
                    {r.status !== 'published' && (
                      <span className="badge-neutral ml-2">{r.status === 'draft' ? 'черновик' : 'архив'}</span>
                    )}
                  </td>
                  <td className="px-4 py-2 text-right font-mono text-xs tabular-nums">{r.view_count}</td>
                  <td className="px-4 py-2 text-right font-mono text-xs tabular-nums">{r.total}</td>
                  <td className={`px-4 py-2 text-right font-mono text-xs tabular-nums ${
                    r.helpful_ratio !== null && r.helpful_ratio < 0.5 ? 'text-danger' : ''}`}>
                    {pct(r.helpful_ratio)}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </section>
      <section className="card-paper overflow-hidden">
        <div className="px-4 py-2.5 border-b border-surface-border font-semibold text-[13px]">
          Комментарии читателей
        </div>
        {!data?.comments.length ? (
          <div className="px-4 py-4 text-sm text-ink-muted">Комментариев пока нет</div>
        ) : (
          <ul className="divide-y divide-surface-border max-h-80 overflow-y-auto">
            {data.comments.map((c, i) => (
              <li key={i} className="px-4 py-2.5">
                <div className="text-[13px]">{c.comment}</div>
                <div className="text-[11px] text-ink-subtle mt-0.5">
                  {c.helpful ? '👍 полезно' : '👎 не помогло'} ·{' '}
                  {c.title ?? c.article_id} ·{' '}
                  {new Date(c.created_at).toLocaleDateString('ru-RU')}
                </div>
              </li>
            ))}
          </ul>
        )}
      </section>
    </div>
  )
}

function SearchInsightsSection() {
  const { data, isError } = useQuery({
    queryKey: ['admin-help-search-insights'],
    queryFn: () => helpAdminApi.searchInsights(),
  })
  if (isError) return null
  const fmtDate = (iso: string) => new Date(iso).toLocaleDateString('ru-RU')
  return (
    <div className="grid grid-cols-2 gap-3 items-start">
      <section className="card-paper overflow-hidden">
        <div className="px-4 py-2.5 border-b border-surface-border font-semibold text-[13px]">
          Топ поисковых запросов
        </div>
        {!data?.top.length ? (
          <div className="px-4 py-4 text-sm text-ink-muted">Запросов пока не было</div>
        ) : (
          <ul className="divide-y divide-surface-border">
            {data.top.slice(0, 10).map((s) => (
              <li key={s.query} className="px-4 py-2 flex items-center gap-2 text-[13px]">
                <span className="truncate">{s.query}</span>
                <span className="ml-auto text-[11px] text-ink-subtle tabular-nums whitespace-nowrap">
                  {s.hits}× · ~{s.avg_results ?? 0} рез. · {fmtDate(s.last_at)}
                </span>
              </li>
            ))}
          </ul>
        )}
      </section>
      <section className="card-paper overflow-hidden">
        <div className="px-4 py-2.5 border-b border-surface-border flex items-baseline gap-2">
          <span className="font-semibold text-[13px]">Запросы без результатов</span>
          <span className="text-[11px] text-ink-subtle">сигнал дыр в контенте</span>
        </div>
        {!data?.zero_results.length ? (
          <div className="px-4 py-4 text-sm text-ink-muted">
            Всё находится — пробелов не видно
          </div>
        ) : (
          <ul className="divide-y divide-surface-border">
            {data.zero_results.slice(0, 10).map((s) => (
              <li key={s.query} className="px-4 py-2 flex items-center gap-2 text-[13px]">
                <span className="truncate">{s.query}</span>
                <span className="ml-auto text-[11px] text-ink-subtle tabular-nums whitespace-nowrap">
                  {s.hits}× · {fmtDate(s.last_at)}
                </span>
              </li>
            ))}
          </ul>
        )}
      </section>
    </div>
  )
}
