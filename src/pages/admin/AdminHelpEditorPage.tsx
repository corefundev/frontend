// HC-3 (#335): редактор статьи базы знаний — стилистика консоли.
// Markdown-превью приходит ТОЛЬКО с сервера (общий санитайзер, debounce
// 600мс). Публикация/архив/откат — через AdminConfirmDialog. Картинки —
// «Загрузить картинку» (magic-bytes проверяет сервер), markdown вставляется
// в позицию курсора. Ревизии — diff к предыдущей + «Откатиться».
import { useEffect, useMemo, useRef, useState } from 'react'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { Link, useNavigate, useParams } from 'react-router-dom'
import toast from 'react-hot-toast'

import { errorMessage } from '../../shared/api/client'
import {
  helpAdminApi, type HelpArticlePayload, type HelpRevision,
} from '../../features/help/adminApi'
import AdminConfirmDialog, { type ConfirmSpec } from '../../components/AdminConfirmDialog'
import AdminSelect from '../../components/AdminSelect'
import AdminQueryError from './AdminQueryError'
import { admPath } from '../../shared/hostRouting'

// построчный diff, тот же подход что в редакторе новостей
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

const EMPTY: HelpArticlePayload = {
  slug: '', category_id: '', title: '', body_md: '',
  excerpt: '', sort_order: 0, seo_title: '', seo_description: '',
}

export default function AdminHelpEditorPage() {
  const { articleId } = useParams()
  const isNew = !articleId || articleId === 'new'
  const nav = useNavigate()
  const qc = useQueryClient()
  const [confirm, setConfirm] = useState<ConfirmSpec | null>(null)
  const bodyRef = useRef<HTMLTextAreaElement | null>(null)
  const fileRef = useRef<HTMLInputElement | null>(null)

  const { data: cats = [] } = useQuery({
    queryKey: ['admin-help-categories'],
    queryFn: () => helpAdminApi.categories(),
  })
  const { data: article, isError, refetch } = useQuery({
    queryKey: ['admin-help-article', articleId],
    queryFn: () => helpAdminApi.article(articleId as string),
    enabled: !isNew,
  })
  const { data: revisions = [] } = useQuery({
    queryKey: ['admin-help-revisions', articleId],
    queryFn: () => helpAdminApi.revisions(articleId as string),
    enabled: !isNew,
  })

  const [form, setForm] = useState<HelpArticlePayload>(EMPTY)
  useEffect(() => {
    if (article) {
      setForm({
        slug: article.slug, category_id: article.category_id,
        title: article.title, body_md: article.body_md,
        excerpt: article.excerpt, sort_order: article.sort_order,
        seo_title: article.seo_title, seo_description: article.seo_description,
      })
      setPreview(article.body_html)
    }
  }, [article])

  // серверное превью с debounce — единственный рендерер Markdown
  const [preview, setPreview] = useState('')
  const previewTimer = useRef<number | null>(null)
  const requestPreview = (body: string) => {
    if (previewTimer.current) window.clearTimeout(previewTimer.current)
    previewTimer.current = window.setTimeout(() => {
      if (body.trim()) {
        helpAdminApi.preview(body)
          .then(setPreview)
          .catch(() => setPreview('<p class="text-danger">превью недоступно</p>'))
      } else setPreview('')
    }, 600)
  }

  const set = <K extends keyof HelpArticlePayload>(k: K, v: HelpArticlePayload[K]) => {
    setForm((f) => ({ ...f, [k]: v }))
    if (k === 'body_md') requestPreview(v as string)
  }

  const invalidate = () => {
    qc.invalidateQueries({ queryKey: ['admin-help-articles'] })
    qc.invalidateQueries({ queryKey: ['admin-help-categories'] })
    if (!isNew) {
      qc.invalidateQueries({ queryKey: ['admin-help-article', articleId] })
      qc.invalidateQueries({ queryKey: ['admin-help-revisions', articleId] })
    }
  }

  const saveMut = useMutation({
    mutationFn: () => isNew
      ? helpAdminApi.createArticle(form)
      : helpAdminApi.updateArticle(articleId as string, form),
    onSuccess: (a) => {
      toast.success(isNew ? 'Черновик создан' : 'Сохранено')
      invalidate()
      if (isNew) nav(admPath(`/admin/help/${encodeURIComponent(a.id)}`), { replace: true })
    },
    onError: (e) => toast.error(errorMessage(e, 'Не удалось сохранить')),
  })
  const publishMut = useMutation({
    mutationFn: () => helpAdminApi.publish(articleId as string),
    onSuccess: () => { toast.success('Статья опубликована'); invalidate() },
    onError: (e) => toast.error(errorMessage(e, 'Публикация не удалась')),
  })
  const archiveMut = useMutation({
    mutationFn: () => helpAdminApi.archive(articleId as string),
    onSuccess: () => { toast.success('Статья в архиве'); invalidate() },
    onError: (e) => toast.error(errorMessage(e, 'Не удалось архивировать')),
  })
  const rollbackMut = useMutation({
    mutationFn: (revisionId: number) => helpAdminApi.rollback(articleId as string, revisionId),
    onSuccess: () => { toast.success('Откат выполнен (создана новая ревизия)'); invalidate() },
    onError: (e) => toast.error(errorMessage(e, 'Откат не удался')),
  })
  const uploadMut = useMutation({
    mutationFn: (file: File) => helpAdminApi.uploadMedia(file),
    onSuccess: ({ markdown }) => {
      // вставляем в позицию курсора textarea
      const ta = bodyRef.current
      const body = form.body_md
      const pos = ta ? ta.selectionStart : body.length
      const next = `${body.slice(0, pos)}\n${markdown}\n${body.slice(pos)}`
      set('body_md', next)
      toast.success('Картинка загружена, markdown вставлен')
    },
    onError: (e) => toast.error(errorMessage(e, 'Загрузка не удалась')),
  })

  const revDiffs = useMemo(() => revisions.map((r: HelpRevision, i: number) => ({
    rev: r,
    diff: i + 1 < revisions.length ? lineDiff(revisions[i + 1].body_md, r.body_md) : null,
  })), [revisions])

  if (!isNew && isError) {
    return (
      <div className="max-w-5xl space-y-4">
        <Link to={admPath('/admin/help')} className="text-sm text-ink-muted hover:text-ink">← База знаний</Link>
        <AdminQueryError what="статью" onRetry={() => void refetch()} />
      </div>
    )
  }

  return (
    <div className="space-y-4 max-w-5xl">
      <div className="flex items-center gap-3">
        <Link to={admPath('/admin/help')} className="text-sm text-ink-muted hover:text-ink">← База знаний</Link>
        {article && (
          <span className={article.status === 'published' ? 'badge-success' : 'badge-neutral'}>
            {article.status === 'published' ? 'опубликована'
              : article.status === 'archived' ? 'архив' : 'черновик'}
          </span>
        )}
        <div className="ml-auto flex items-center gap-2">
          <button type="button" className="btn-secondary text-xs"
                  disabled={saveMut.isPending || !form.title || !form.slug
                    || !form.category_id || !form.body_md}
                  onClick={() => saveMut.mutate()}>
            {isNew ? 'Создать черновик' : 'Сохранить'}
          </button>
          {!isNew && article?.status !== 'published' && (
            <button type="button" className="btn-primary text-xs"
                    disabled={publishMut.isPending}
                    onClick={() => setConfirm({
                      title: 'Опубликовать статью',
                      body: 'Статья немедленно станет публичной в базе знаний (видна даже без логина).',
                      actionLabel: 'Опубликовать',
                      onConfirm: () => publishMut.mutate(),
                    })}>
              Опубликовать
            </button>
          )}
          {!isNew && article?.status === 'published' && (
            <button type="button" className="btn-secondary text-xs"
                    disabled={archiveMut.isPending}
                    onClick={() => setConfirm({
                      title: 'Архивировать статью',
                      body: 'Статья исчезнет из публичной базы знаний. Вернуть можно повторной публикацией.',
                      actionLabel: 'В архив',
                      danger: true,
                      onConfirm: () => archiveMut.mutate(),
                    })}>
              Архивировать
            </button>
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
          <div className="grid grid-cols-[1fr_90px] gap-3">
            <div>
              <label className="label text-xs">Категория</label>
              <AdminSelect ariaLabel="Категория" value={form.category_id}
                           onChange={(v) => set('category_id', v)}
                           options={[{ value: '', label: '— выберите —' },
                                     ...cats.map((c) => ({ value: c.id, label: c.title }))]} />
            </div>
            <div>
              <label className="label text-xs">Порядок</label>
              <input type="number" className="input" value={form.sort_order ?? 0}
                     onChange={(e) => set('sort_order', Number(e.target.value))} />
            </div>
          </div>
          <div>
            <label className="label text-xs">Короткое описание (список статей)</label>
            <input className="input" value={form.excerpt ?? ''}
                   onChange={(e) => set('excerpt', e.target.value)} />
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="label text-xs">SEO title (опционально)</label>
              <input className="input" value={form.seo_title ?? ''}
                     onChange={(e) => set('seo_title', e.target.value)} />
            </div>
            <div>
              <label className="label text-xs">SEO description (опционально)</label>
              <input className="input" value={form.seo_description ?? ''}
                     onChange={(e) => set('seo_description', e.target.value)} />
            </div>
          </div>
          <div>
            <div className="flex items-center justify-between">
              <label className="label text-xs">Текст (Markdown)</label>
              <button type="button" className="btn-ghost text-xs"
                      disabled={uploadMut.isPending}
                      onClick={() => fileRef.current?.click()}>
                {uploadMut.isPending ? 'Загрузка…' : 'Загрузить картинку'}
              </button>
              <input ref={fileRef} type="file" className="hidden"
                     accept="image/png,image/jpeg,image/webp"
                     onChange={(e) => {
                       const f = e.target.files?.[0]
                       if (f) uploadMut.mutate(f)
                       e.target.value = ''
                     }} />
            </div>
            <textarea ref={bodyRef} className="input font-mono text-xs min-h-[320px]"
                      value={form.body_md}
                      onChange={(e) => set('body_md', e.target.value)} />
          </div>
        </section>

        {/* ── превью (серверный санитайзер) ── */}
        <section className="card-paper p-4">
          <div className="text-xs text-ink-subtle mb-2">
            Превью — как увидит читатель (санировано сервером)
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
                      <button type="button" className="btn-ghost text-xs shrink-0"
                              disabled={rollbackMut.isPending}
                              onClick={(e) => {
                                e.preventDefault()
                                setConfirm({
                                  title: 'Откатиться к ревизии',
                                  body: `Текущий текст будет заменён содержимым ревизии «${rev.title}». Откат создаст новую ревизию — история не теряется.`,
                                  actionLabel: 'Откатиться',
                                  danger: true,
                                  onConfirm: () => rollbackMut.mutate(rev.id),
                                })
                              }}>
                        Откатиться
                      </button>
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
