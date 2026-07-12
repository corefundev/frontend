// NEWS-6 (#346): редактор поста — стилистика консоли. Markdown-превью
// приходит ТОЛЬКО с сервера (общий санитайзер, debounce 600мс) — клиент
// Markdown не рендерит. Публикация/архив — через AdminConfirmDialog.
// История ревизий — список с простым построчным diff к предыдущей.
import { useEffect, useMemo, useRef, useState } from 'react'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { Link, useNavigate, useParams } from 'react-router-dom'
import toast from 'react-hot-toast'

import { errorMessage } from '../../shared/api/client'
import {
  CATEGORY_LABELS, newsAdminApi,
  type NewsCategory, type NewsDraftPayload, type NewsRevision,
} from '../../features/news/adminApi'
import AdminConfirmDialog, { type ConfirmSpec } from '../../components/AdminConfirmDialog'
import AdminSelect from '../../components/AdminSelect'
import AdminQueryError from './AdminQueryError'

// простой построчный diff (без библиотек): строки только-слева = удалены,
// только-справа = добавлены; O(n·m) на маленьких ревизиях приемлем
function lineDiff(prev: string, next: string): { kind: '+' | '-' | ' '; text: string }[] {
  const a = prev.split('\n')
  const b = next.split('\n')
  const setA = new Set(a)
  const setB = new Set(b)
  const out: { kind: '+' | '-' | ' '; text: string }[] = []
  for (const line of a) if (!setB.has(line)) out.push({ kind: '-', text: line })
  for (const line of b) out.push(setA.has(line) ? { kind: ' ', text: line } : { kind: '+', text: line })
  return out
}

function toLocalInput(iso: string | null): string {
  if (!iso) return ''
  const d = new Date(iso)
  const pad = (n: number) => String(n).padStart(2, '0')
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`
}

export default function AdminNewsEditorPage() {
  const { postId } = useParams()
  const isNew = !postId || postId === 'new'
  const nav = useNavigate()
  const qc = useQueryClient()
  const [confirm, setConfirm] = useState<ConfirmSpec | null>(null)

  const { data: post, isError, refetch } = useQuery({
    queryKey: ['admin-news-post', postId],
    queryFn: () => newsAdminApi.get(postId as string),
    enabled: !isNew,
  })
  const { data: revisions } = useQuery({
    queryKey: ['admin-news-revisions', postId],
    queryFn: () => newsAdminApi.revisions(postId as string),
    enabled: !isNew,
  })

  const [form, setForm] = useState<NewsDraftPayload>({
    slug: '', title: '', summary: '', body_md: '',
    category: 'release', importance: 'normal', pinned: false,
    publish_at: null, expire_at: null,
  })
  useEffect(() => {
    if (post) {
      setForm({
        slug: post.slug, title: post.title, summary: post.summary,
        body_md: post.body_md, category: post.category,
        importance: post.importance, pinned: post.pinned,
        publish_at: post.publish_at, expire_at: post.expire_at,
      })
      setPreview(post.body_html)
    }
  }, [post])

  // серверное превью с debounce — единственный рендерер Markdown
  const [preview, setPreview] = useState('')
  const previewTimer = useRef<number | null>(null)
  const requestPreview = (body: string) => {
    if (previewTimer.current) window.clearTimeout(previewTimer.current)
    previewTimer.current = window.setTimeout(() => {
      if (body.trim()) {
        newsAdminApi.preview(body)
          .then(setPreview)
          .catch(() => setPreview('<p class="text-danger">превью недоступно</p>'))
      } else setPreview('')
    }, 600)
  }

  const set = <K extends keyof NewsDraftPayload>(k: K, v: NewsDraftPayload[K]) => {
    setForm((f) => ({ ...f, [k]: v }))
    if (k === 'body_md') requestPreview(v as string)
  }

  const invalidate = () => {
    qc.invalidateQueries({ queryKey: ['admin-news'] })
    if (!isNew) {
      qc.invalidateQueries({ queryKey: ['admin-news-post', postId] })
      qc.invalidateQueries({ queryKey: ['admin-news-revisions', postId] })
    }
  }
  const saveMut = useMutation({
    mutationFn: async () => {
      const payload = {
        ...form,
        publish_at: form.publish_at || null,
        expire_at: form.expire_at || null,
      }
      return isNew
        ? newsAdminApi.create(payload)
        : newsAdminApi.update(postId as string, payload)
    },
    onSuccess: (p) => {
      toast.success(isNew ? 'Черновик создан' : 'Сохранено')
      invalidate()
      if (isNew) nav(`/admin/news/${encodeURIComponent(p.id)}`, { replace: true })
    },
    onError: (e) => toast.error(errorMessage(e, 'Не удалось сохранить')),
  })
  const publishMut = useMutation({
    mutationFn: () => newsAdminApi.publish(postId as string),
    onSuccess: (p) => {
      toast.success(p.live ? 'Опубликовано' : 'Запланировано (publish_at в будущем)')
      invalidate()
    },
    onError: (e) => toast.error(errorMessage(e, 'Публикация не удалась')),
  })
  const archiveMut = useMutation({
    mutationFn: () => newsAdminApi.archive(postId as string),
    onSuccess: () => { toast.success('Пост в архиве'); invalidate() },
    onError: (e) => toast.error(errorMessage(e, 'Не удалось архивировать')),
  })

  const revDiffs = useMemo(() => {
    const revs = revisions?.revisions ?? []
    return revs.map((r: NewsRevision, i: number) => ({
      rev: r,
      diff: i + 1 < revs.length ? lineDiff(revs[i + 1].body_md, r.body_md) : null,
    }))
  }, [revisions])

  if (!isNew && isError) {
    return (
      <div className="max-w-5xl space-y-4">
        <Link to="/admin/news" className="text-sm text-ink-muted hover:text-ink">← Новости</Link>
        <AdminQueryError what="пост" onRetry={() => void refetch()} />
      </div>
    )
  }

  return (
    <div className="space-y-4 max-w-5xl">
      <div className="flex items-center gap-3">
        <Link to="/admin/news" className="text-sm text-ink-muted hover:text-ink">← Новости</Link>
        {post && (
          <span className={post.status === 'published'
            ? (post.live ? 'badge-success' : 'badge-warn')
            : 'badge-neutral'}>
            {post.status === 'published' ? (post.live ? 'опубликован' : 'отложен')
              : post.status === 'archived' ? 'архив' : 'черновик'}
          </span>
        )}
        <div className="ml-auto flex items-center gap-2">
          <button type="button" className="btn-secondary text-xs"
                  disabled={saveMut.isPending || !form.title || !form.slug || !form.body_md}
                  onClick={() => saveMut.mutate()}>
            {isNew ? 'Создать черновик' : 'Сохранить'}
          </button>
          {!isNew && post?.status !== 'archived' && (
            <>
              {post?.status !== 'published' && (
                <button type="button" className="btn-primary text-xs"
                        disabled={publishMut.isPending}
                        onClick={() => setConfirm({
                          title: 'Опубликовать пост',
                          body: form.publish_at
                            ? `Пост станет публичным в назначенное время (publish_at). Виден будет даже без логина.`
                            : 'Пост немедленно станет публичным (виден даже без логина). Important-пост однократно попадёт в колокольчик клиентов.',
                          actionLabel: 'Опубликовать',
                          onConfirm: () => publishMut.mutate(),
                        })}>
                  Опубликовать
                </button>
              )}
              <button type="button" className="btn-secondary text-xs"
                      disabled={archiveMut.isPending}
                      onClick={() => setConfirm({
                        title: 'Архивировать пост',
                        body: 'Пост исчезнет из публичной ленты. Действие обратимо только правкой статуса в БД — в панели восстановления нет (v1).',
                        actionLabel: 'В архив',
                        danger: true,
                        onConfirm: () => archiveMut.mutate(),
                      })}>
                Архивировать
              </button>
            </>
          )}
        </div>
      </div>

      <div className="grid grid-cols-[1fr_1fr] gap-3 items-start">
        {/* ── форма ── */}
        <section className="card-paper p-4 space-y-3">
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="label text-xs">Заголовок</label>
              <input className="input" value={form.title}
                     onChange={(e) => set('title', e.target.value)} />
            </div>
            <div>
              <label className="label text-xs">Slug (a-z, 0-9, дефис)</label>
              <input className="input font-mono" value={form.slug}
                     disabled={!isNew}
                     onChange={(e) => set('slug', e.target.value)} />
            </div>
          </div>
          <div>
            <label className="label text-xs">Короткое описание (лента)</label>
            <input className="input" value={form.summary ?? ''}
                   onChange={(e) => set('summary', e.target.value)} />
          </div>
          <div className="grid grid-cols-4 gap-3 items-end">
            <div>
              <label className="label text-xs">Категория</label>
              <AdminSelect ariaLabel="Категория" value={form.category}
                           onChange={(v) => set('category', v as NewsCategory)}
                           options={Object.entries(CATEGORY_LABELS).map(([v, l]) => ({
                             value: v, label: l }))} />
            </div>
            <label className="flex items-center gap-1.5 text-[12.5px] text-ink-muted pb-2 select-none">
              <input type="checkbox" checked={form.importance === 'important'}
                     onChange={(e) => set('importance', e.target.checked ? 'important' : 'normal')} />
              important (в колокольчик)
            </label>
            <label className="flex items-center gap-1.5 text-[12.5px] text-ink-muted pb-2 select-none">
              <input type="checkbox" checked={!!form.pinned}
                     onChange={(e) => set('pinned', e.target.checked)} />
              закрепить
            </label>
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="label text-xs">Публикация с (пусто = сразу)</label>
              <input type="datetime-local" className="input"
                     value={toLocalInput(form.publish_at ?? null)}
                     onChange={(e) => set('publish_at',
                       e.target.value ? new Date(e.target.value).toISOString() : null)} />
            </div>
            <div>
              <label className="label text-xs">Скрыть после (опционально)</label>
              <input type="datetime-local" className="input"
                     value={toLocalInput(form.expire_at ?? null)}
                     onChange={(e) => set('expire_at',
                       e.target.value ? new Date(e.target.value).toISOString() : null)} />
            </div>
          </div>
          <div>
            <label className="label text-xs">Текст (Markdown)</label>
            <textarea className="input font-mono text-xs min-h-[320px]"
                      value={form.body_md}
                      onChange={(e) => set('body_md', e.target.value)} />
          </div>
        </section>

        {/* ── превью (серверный санитайзер) ── */}
        <section className="card-paper p-4">
          <div className="text-xs text-ink-subtle mb-2">
            Превью — как увидит клиент (санировано сервером)
          </div>
          {preview ? (
            <div className="cms-body text-sm text-ink"
                 dangerouslySetInnerHTML={{ __html: preview }} />
          ) : (
            <div className="text-sm text-ink-muted">Начните печатать…</div>
          )}
        </section>
      </div>

      {/* ── ревизии ── */}
      {!isNew && (
        <section className="card-paper overflow-hidden">
          <div className="px-4 py-2.5 border-b border-surface-border font-semibold text-[13px]">
            История ревизий
          </div>
          {!revDiffs.length ? (
            <div className="px-4 py-4 text-sm text-ink-muted">Ревизий нет</div>
          ) : (
            <ul className="divide-y divide-surface-border">
              {revDiffs.map(({ rev, diff }) => (
                <li key={rev.id} className="px-4 py-2.5">
                  <details>
                    <summary className="cursor-pointer text-[13px] flex items-center gap-3">
                      <span className="font-medium">{rev.title}</span>
                      <span className="text-[11.5px] text-ink-subtle ml-auto">
                        {rev.editor_admin_id} · {new Date(rev.created_at).toLocaleString('ru-RU')}
                      </span>
                    </summary>
                    {diff ? (
                      <pre className="mt-2 text-[11px] font-mono overflow-x-auto max-h-64 overflow-y-auto rounded-md bg-surface-muted p-3">
                        {diff.map((l, i) => (
                          <div key={i} className={
                            l.kind === '+' ? 'text-success'
                              : l.kind === '-' ? 'text-danger line-through/50' : 'text-ink-subtle'}>
                            {l.kind} {l.text}
                          </div>
                        ))}
                      </pre>
                    ) : (
                      <pre className="mt-2 text-[11px] font-mono overflow-x-auto max-h-64 overflow-y-auto rounded-md bg-surface-muted p-3 text-ink-subtle">
                        {rev.body_md}
                      </pre>
                    )}
                  </details>
                </li>
              ))}
            </ul>
          )}
        </section>
      )}

      <AdminConfirmDialog spec={confirm} onClose={() => setConfirm(null)} />
    </div>
  )
}
