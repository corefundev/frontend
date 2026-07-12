// NEWS-6 (#346): «Новости» — список постов в стилистике консоли:
// фильтры одной строкой, THEAD-таблица (sticky), статусные чипы,
// «Новый пост» ведёт в редактор. Управление контентом — только отсюда.
import { useState } from 'react'
import { useQuery } from '@tanstack/react-query'
import { Link } from 'react-router-dom'

import {
  CATEGORY_LABELS, newsAdminApi,
  type NewsCategory, type NewsStatus,
} from '../../features/news/adminApi'
import AdminQueryError from './AdminQueryError'
import { SkeletonRows, StateRow } from './adminTable'
import { THEAD_CLS } from './adminTableUtils'

function StatusChip({ status, live }: { status: NewsStatus; live: boolean }) {
  if (status === 'draft') return <span className="badge-neutral">черновик</span>
  if (status === 'archived') return <span className="badge-neutral">архив</span>
  return live
    ? <span className="badge-success">опубликован</span>
    : <span className="badge-warn">отложен</span>
}

export default function AdminNewsPage() {
  const [status, setStatus] = useState<NewsStatus | ''>('')
  const [category, setCategory] = useState<NewsCategory | ''>('')
  const [pinnedOnly, setPinnedOnly] = useState(false)

  const { data, isError, isLoading, refetch } = useQuery({
    queryKey: ['admin-news', status, category, pinnedOnly],
    queryFn: () => newsAdminApi.list({
      ...(status ? { status } : {}),
      ...(category ? { category } : {}),
      ...(pinnedOnly ? { pinned: true } : {}),
    }),
  })

  return (
    <div className="space-y-4 max-w-5xl">
      {isError && <AdminQueryError what="список новостей" onRetry={() => void refetch()} />}
      <div className="flex items-center gap-2">
        <select className="input w-40 shrink-0" value={status}
                onChange={(e) => setStatus(e.target.value as NewsStatus | '')}>
          <option value="">Все статусы</option>
          <option value="draft">черновики</option>
          <option value="published">опубликованные</option>
          <option value="archived">архив</option>
        </select>
        <select className="input w-44 shrink-0" value={category}
                onChange={(e) => setCategory(e.target.value as NewsCategory | '')}>
          <option value="">Все категории</option>
          {Object.entries(CATEGORY_LABELS).map(([v, l]) => (
            <option key={v} value={v}>{l}</option>
          ))}
        </select>
        <label className="flex items-center gap-1.5 text-[12.5px] text-ink-muted select-none">
          <input type="checkbox" checked={pinnedOnly}
                 onChange={(e) => setPinnedOnly(e.target.checked)} />
          только закреплённые
        </label>
        <Link to="/admin/news/new" className="btn-primary text-xs ml-auto">
          Новый пост
        </Link>
      </div>

      <section className="card-paper overflow-hidden">
        <div className="overflow-x-auto max-h-[70vh] overflow-y-auto">
          <table className="w-full text-sm">
            <thead className={THEAD_CLS}>
              <tr>
                <th className="px-4 py-2 text-left">Заголовок</th>
                <th className="px-4 py-2 text-left">Категория</th>
                <th className="px-4 py-2 text-left">Статус</th>
                <th className="px-4 py-2 text-left">Важность</th>
                <th className="px-4 py-2 text-right">Обновлён</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-surface-border">
              {isLoading ? (
                <SkeletonRows cols={5} />
              ) : isError ? (
                <StateRow cols={5} kind="error" what="новости" />
              ) : !data?.posts.length ? (
                <StateRow cols={5} kind="empty" what="посты" />
              ) : data.posts.map((p) => (
                <tr key={p.id} className="hover:bg-surface-muted/60">
                  <td className="px-4 py-2">
                    <Link to={`/admin/news/${encodeURIComponent(p.id)}`}
                          className="font-medium hover:underline">
                      {p.pinned && <span title="закреплён" className="mr-1">📌</span>}
                      {p.title}
                    </Link>
                    <div className="font-mono text-[11px] text-ink-subtle">/{p.slug}</div>
                  </td>
                  <td className="px-4 py-2">
                    <span className="badge-info">{CATEGORY_LABELS[p.category]}</span>
                  </td>
                  <td className="px-4 py-2"><StatusChip status={p.status} live={p.live} /></td>
                  <td className="px-4 py-2">
                    {p.importance === 'important'
                      ? <span className="badge-warn">important</span>
                      : <span className="text-ink-subtle text-xs">обычная</span>}
                  </td>
                  <td className="px-4 py-2 text-right text-xs text-ink-subtle whitespace-nowrap">
                    {new Date(p.updated_at).toLocaleDateString('ru-RU')}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </section>
      <div className="text-xs text-ink-muted">
        Пост публичен (виден даже без логина), когда опубликован и наступил
        publish_at; important-посты при публикации однократно попадают в
        колокольчик клиентов.
      </div>
    </div>
  )
}
