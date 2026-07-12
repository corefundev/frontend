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
import AdminQueryError from './AdminQueryError'
import { SkeletonRows, StateRow } from './adminTable'
import { THEAD_CLS } from './adminTableUtils'

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
            <select className="input w-40 py-1 text-xs ml-2" value={filterCat}
                    onChange={(e) => setFilterCat(e.target.value)}>
              <option value="">Все категории</option>
              {cats.map((c) => <option key={c.id} value={c.id}>{c.title}</option>)}
            </select>
            <select className="input w-36 py-1 text-xs" value={filterStatus}
                    onChange={(e) => setFilterStatus(e.target.value as HelpStatus | '')}>
              <option value="">Все статусы</option>
              <option value="draft">черновики</option>
              <option value="published">опубликованные</option>
              <option value="archived">архив</option>
            </select>
            <Link to="/admin/help/new" className="btn-primary text-xs ml-auto">
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
                      <Link to={`/admin/help/${encodeURIComponent(a.id)}`}
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
      <div className="text-xs text-ink-muted">
        Публичный центр показывает только опубликованные статьи; категории
        без опубликованных статей на витрине скрываются автоматически.
      </div>
    </div>
  )
}
