// SUP-3 (#506, эпик #503): виджет чата ассистента поддержки.
//
// Поверхности: апекс (анонимы — вопросы по документации) и app-хост
// (авторизованные; user-data ответы приедут с SUP-4). На admin/news/help
// не рендерится. Дизайн — наша система (Inter, brand-500, слоистые
// карточки, радиусы referest).
//
// Состояния честные: до запуска ядра (SUP-2) /support/health офлайн →
// панель говорит «ассистент готовится» и предлагает человека; 'busy'
// показывает очередь; 'ok' — живой диалог со стримингом и цитатами.
import { useEffect, useRef, useState } from 'react'

import {
  supportChat, supportHealth, type Citation, type HealthResponse,
} from '../features/support/api'
import { useAuthStore } from '../features/auth/store'
import { IS_ADMIN_HOST, SECTION_HOST, mainUrl } from '../shared/hostRouting'

interface Msg {
  role: 'user' | 'assistant'
  text: string
  citations?: Citation[]
}

const HUMAN_MAILTO =
  'mailto:dochub.org@gmail.com?subject=%D0%92%D0%BE%D0%BF%D1%80%D0%BE%D1%81%20%D0%B2%20Sprosly'

export default function SupportWidget({ surface }: { surface: 'public' | 'cabinet' }) {
  const [open, setOpen] = useState(false)
  if (IS_ADMIN_HOST || SECTION_HOST) return null
  return (
    <>
      {open && <Panel surface={surface} onClose={() => setOpen(false)} />}
      <button
        type="button"
        aria-label="Чат с ассистентом"
        onClick={() => setOpen((v) => !v)}
        className="fixed bottom-5 right-5 z-40 flex h-[52px] w-[52px] items-center justify-center rounded-full bg-brand-500 text-white shadow-[0_8px_30px_rgba(36,99,235,0.35)] transition-transform hover:scale-105"
      >
        {open ? (
          <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round"><path d="M6 6l12 12M18 6L6 18" /></svg>
        ) : (
          <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M21 12a8 8 0 0 1-8 8H5l-2 2V12a8 8 0 0 1 8-8h2a8 8 0 0 1 8 8z" /></svg>
        )}
      </button>
    </>
  )
}

function Panel({ surface, onClose }: { surface: 'public' | 'cabinet'; onClose: () => void }) {
  const [health, setHealth] = useState<HealthResponse | null>(null)
  const [msgs, setMsgs] = useState<Msg[]>([])
  const [input, setInput] = useState('')
  const [streaming, setStreaming] = useState(false)
  const [sessionId, setSessionId] = useState<string | null>(null)
  const token = useAuthStore((s) => s.token)
  const listRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    let alive = true
    supportHealth().then((h) => { if (alive) setHealth(h) })
      .catch(() => { if (alive) setHealth({ status: 'offline' }) })
    return () => { alive = false }
  }, [])

  useEffect(() => {
    listRef.current?.scrollTo({ top: listRef.current.scrollHeight })
  }, [msgs])

  function send() {
    const text = input.trim()
    if (!text || streaming || health?.status !== 'ok') return
    setInput('')
    setMsgs((m) => [...m, { role: 'user', text }, { role: 'assistant', text: '' }])
    setStreaming(true)
    void supportChat(text, sessionId, surface, {
      onToken: (d) => setMsgs((m) => {
        const out = [...m]
        out[out.length - 1] = { ...out[out.length - 1], text: out[out.length - 1].text + d }
        return out
      }),
      onCitations: (items) => setMsgs((m) => {
        const out = [...m]
        out[out.length - 1] = { ...out[out.length - 1], citations: items }
        return out
      }),
      onDone: (sid) => { setSessionId(sid || sessionId); setStreaming(false) },
      onError: () => {
        setStreaming(false)
        setHealth({ status: 'offline' })
      },
    }, surface === 'cabinet' ? token : null)
  }

  return (
    <div className="fixed bottom-24 right-5 z-40 flex h-[520px] w-[360px] max-w-[calc(100vw-2.5rem)] flex-col overflow-hidden rounded-2xl border border-ink/10 bg-white shadow-[0_20px_60px_rgba(15,23,42,0.18)]">
      <div className="flex items-center justify-between border-b border-ink/10 bg-surface/60 px-4 py-3">
        <div>
          <div className="flex items-center gap-1.5">
            <span className="text-sm font-bold text-ink">Ассистент Sprosly</span>
            <span className="rounded-full bg-brand-500/10 px-1.5 py-0.5 text-[10px] font-bold uppercase leading-none tracking-wide text-brand-600">
              beta
            </span>
          </div>
          <div className="text-[11px] text-ink-faint">
            {health === null ? 'подключение…'
              : health.status === 'ok' ? 'отвечает по документации'
              : health.status === 'busy' ? `очередь: ${health.queue_depth ?? '—'}`
              : 'скоро запустится'}
          </div>
        </div>
        <button type="button" onClick={onClose} aria-label="Свернуть чат"
                className="text-ink-faint hover:text-ink">
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round"><path d="M6 9l6 6 6-6" /></svg>
        </button>
      </div>

      <div ref={listRef} className="flex-1 space-y-3 overflow-y-auto px-4 py-3">
        {health?.status === 'offline' && (
          <div className="rounded-xl border border-ink/10 bg-surface/50 p-3 text-sm text-ink-muted leading-relaxed">
            Ассистент готовится к запуску. Пока он спит — загляните в{' '}
            <a href={mainUrl('/help')} className="font-medium text-brand-500 hover:text-brand-600">Базу знаний</a>{' '}
            или напишите нам — отвечаем быстро.
          </div>
        )}
        {health?.status !== 'offline' && msgs.length === 0 && (
          <div className="rounded-xl border border-ink/10 bg-surface/50 p-3 text-sm text-ink-muted leading-relaxed">
            Спросите про загрузку данных, обучение модели, точность или тарифы —
            отвечу по документации со ссылками на источники.
          </div>
        )}
        {msgs.map((m, i) => (
          <div key={i} className={m.role === 'user' ? 'flex justify-end' : 'flex justify-start'}>
            <div className={[
              'max-w-[85%] rounded-xl px-3 py-2 text-sm leading-relaxed',
              m.role === 'user' ? 'bg-brand-500 text-white' : 'bg-surface text-ink',
            ].join(' ')}>
              {m.text || (streaming && i === msgs.length - 1 ? '…' : '')}
              {m.citations && m.citations.length > 0 && (
                <div className="mt-2 border-t border-ink/10 pt-1.5 text-[11px]">
                  <span className="text-ink-faint">Источники: </span>
                  {m.citations.map((c) => (
                    <a key={c.slug} href={mainUrl(`/help/a/${c.slug}`)}
                       className="mr-1.5 font-medium text-brand-500 hover:text-brand-600">
                      {c.title}
                    </a>
                  ))}
                </div>
              )}
            </div>
          </div>
        ))}
      </div>

      <div className="border-t border-ink/10 p-3">
        <div className="flex items-center gap-2">
          <input
            value={input}
            onChange={(e) => setInput(e.target.value)}
            onKeyDown={(e) => { if (e.key === 'Enter') send() }}
            disabled={health?.status !== 'ok' || streaming}
            placeholder={health?.status === 'ok' ? 'Ваш вопрос…' : 'Ассистент недоступен'}
            className="h-10 flex-1 rounded-lg border border-ink/10 bg-white px-3 text-sm text-ink placeholder:text-ink-faint outline-none focus:border-brand-500 disabled:bg-surface/60"
          />
          <button
            type="button"
            onClick={send}
            disabled={health?.status !== 'ok' || streaming || !input.trim()}
            aria-label="Отправить"
            className="flex h-10 w-10 items-center justify-center rounded-lg bg-brand-500 text-white transition-colors hover:bg-brand-600 disabled:bg-ink/10 disabled:text-ink-faint"
          >
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M22 2L11 13M22 2l-7 20-4-9-9-4 20-7z" /></svg>
          </button>
        </div>
        <a href={HUMAN_MAILTO}
           className="mt-2 block text-center text-[11.5px] font-medium text-ink-faint hover:text-ink">
          Связаться с человеком
        </a>
      </div>
    </div>
  )
}
