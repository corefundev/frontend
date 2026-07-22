// SUP-3 (#506, эпик #503): виджет чата ассистента поддержки.
//
// Поверхности: апекс (анонимы — вопросы по документации) и app-хост
// (авторизованные). На admin/news/help не рендерится.
//
// Внешний вид — порт прототипа владельца (мессенджер-стиль поддержки,
// 2026-07-23) на нашу систему (Inter, brand-500, радиусы referest):
// шапка аватар+статус, серые пузыри ассистента с именем и временем,
// светло-голубые пузыри клиента, чипы быстрых вопросов в пустом
// состоянии, pill-инпут с круглой кнопкой-стрелкой.
//
// Состояния честные: /support/health офлайн → «ассистент готовится» и
// предлагает человека; 'busy' показывает очередь; 'ok' — живой диалог
// со стримингом и цитатами.
import { useEffect, useRef, useState } from 'react'

import {
  supportChat, supportHealth, type Citation, type HealthResponse,
} from '../features/support/api'
import { useAuthStore } from '../features/auth/store'
import { IS_ADMIN_HOST, SECTION_HOST, mainUrl } from '../shared/hostRouting'

interface Msg {
  role: 'user' | 'assistant'
  text: string
  at: string          // HH:MM локальное время постановки сообщения
  citations?: Citation[]
}

const HUMAN_MAILTO =
  'mailto:dochub.org@gmail.com?subject=%D0%92%D0%BE%D0%BF%D1%80%D0%BE%D1%81%20%D0%B2%20Sprosly'

// Чипы пустого состояния — вопросы, на которые база знаний точно отвечает.
const QUICK_QUESTIONS = [
  'Как загрузить данные из 1С?',
  'Какие есть тарифы?',
  'Как оценивается точность?',
  'Как обучить модель?',
]

const nowHHMM = () =>
  new Date().toLocaleTimeString('ru-RU', { hour: '2-digit', minute: '2-digit' })

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

function AssistantAvatar({ size }: { size: 'header' | 'bubble' }) {
  const cls = size === 'header'
    ? 'h-10 w-10 text-[15px]'
    : 'h-7 w-7 text-[11px]'
  return (
    <div className={`flex ${cls} shrink-0 select-none items-center justify-center rounded-full bg-brand-500 font-bold text-white`}>
      S
    </div>
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

  function sendText(raw: string) {
    const text = raw.trim()
    if (!text || streaming || health?.status !== 'ok') return
    setInput('')
    setMsgs((m) => [
      ...m,
      { role: 'user', text, at: nowHHMM() },
      { role: 'assistant', text: '', at: nowHHMM() },
    ])
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

  const ready = health?.status === 'ok'

  return (
    <div className="fixed bottom-24 right-5 z-40 flex h-[560px] w-[380px] max-w-[calc(100vw-2.5rem)] flex-col overflow-hidden rounded-pill bg-white shadow-[0_20px_60px_rgba(15,23,42,0.18)]">
      {/* Шапка: аватар + имя/статус, свернуть справа */}
      <div className="flex items-center gap-3 px-4 pb-3 pt-4">
        <AssistantAvatar size="header" />
        <div className="min-w-0 flex-1">
          <div className="flex items-center gap-1.5">
            <span className="truncate text-[15px] font-bold text-ink">Ассистент Sprosly</span>
            <span className="rounded-full bg-brand-500/10 px-1.5 py-0.5 text-[10px] font-bold uppercase leading-none tracking-wide text-brand-600">
              beta
            </span>
          </div>
          <div className="text-xs text-ink-faint">
            {health === null ? 'подключение…'
              : health.status === 'ok' ? 'на связи · отвечает по документации'
              : health.status === 'busy' ? `очередь: ${health.queue_depth ?? '—'}`
              : 'скоро запустится'}
          </div>
        </div>
        <button type="button" onClick={onClose} aria-label="Свернуть чат"
                className="flex h-9 w-9 items-center justify-center rounded-full text-ink-faint transition-colors hover:bg-surface hover:text-ink">
          <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round"><path d="M6 9l6 6 6-6" /></svg>
        </button>
      </div>

      {/* Лента */}
      <div ref={listRef} className="flex flex-1 flex-col overflow-y-auto px-4 py-2">
        {health?.status === 'offline' && (
          <div className="rounded-pill bg-surface p-4 text-sm leading-relaxed text-ink-muted">
            Ассистент готовится к запуску. Пока он спит — загляните в{' '}
            <a href={mainUrl('/help')} className="font-medium text-brand-500 hover:text-brand-600">Базу знаний</a>{' '}
            или напишите нам — отвечаем быстро.
          </div>
        )}

        {msgs.length > 0 && (
          <div className="mb-3 mt-1 flex justify-center">
            <span className="rounded-full border border-surface-border bg-white px-3 py-1 text-xs text-ink-muted shadow-raised">
              Сегодня
            </span>
          </div>
        )}

        <div className="space-y-3">
          {msgs.map((m, i) => (
            m.role === 'user' ? (
              <div key={i} className="flex justify-end">
                <div className="max-w-[85%] rounded-pill bg-brand-100 px-4 py-2.5 text-sm leading-relaxed text-ink">
                  {m.text}
                  <span className="float-right ml-2 mt-1.5 text-[11px] leading-none text-ink-faint">{m.at}</span>
                </div>
              </div>
            ) : (
              <div key={i} className="flex items-end gap-2">
                <AssistantAvatar size="bubble" />
                <div className="max-w-[85%] rounded-pill bg-surface px-4 py-2.5 text-sm leading-relaxed text-ink">
                  <div className="mb-0.5 text-[13px] font-semibold text-brand-500">Ассистент</div>
                  {m.text || (streaming && i === msgs.length - 1 ? '…' : '')}
                  <span className="float-right ml-2 mt-1.5 text-[11px] leading-none text-ink-faint">{m.at}</span>
                  {m.citations && m.citations.length > 0 && (
                    <div className="clear-both mt-2 border-t border-surface-border pt-1.5 text-[11px]">
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
            )
          ))}
        </div>

        {/* Пустое состояние: чипы быстрых вопросов над инпутом */}
        {ready && msgs.length === 0 && (
          <div className="mt-auto flex flex-wrap justify-center gap-2 pb-2 pt-4">
            {QUICK_QUESTIONS.map((q) => (
              <button
                key={q}
                type="button"
                onClick={() => sendText(q)}
                className="rounded-full bg-white px-4 py-2.5 text-sm font-medium text-brand-500 shadow-floating transition-colors hover:bg-brand-50"
              >
                {q}
              </button>
            ))}
          </div>
        )}
      </div>

      {/* Инпут: pill-поле + круглая кнопка-стрелка */}
      <div className="px-3 pb-2 pt-1.5">
        <div className="flex items-center gap-2">
          <input
            value={input}
            onChange={(e) => setInput(e.target.value)}
            onKeyDown={(e) => { if (e.key === 'Enter') sendText(input) }}
            disabled={!ready || streaming}
            placeholder={ready ? 'Напишите сообщение…' : 'Ассистент недоступен'}
            className="h-11 min-w-0 flex-1 rounded-full bg-surface px-4 text-sm text-ink outline-none placeholder:text-ink-faint focus:ring-2 focus:ring-brand-200 disabled:opacity-60"
          />
          <button
            type="button"
            onClick={() => sendText(input)}
            disabled={!ready || streaming || !input.trim()}
            aria-label="Отправить"
            className="flex h-11 w-11 shrink-0 items-center justify-center rounded-full bg-brand-500 text-white transition-colors hover:bg-brand-600 disabled:bg-brand-200"
          >
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round"><path d="M12 19V5M5 12l7-7 7 7" /></svg>
          </button>
        </div>
        <a href={HUMAN_MAILTO}
           className="mt-1.5 block text-center text-[11.5px] font-medium text-ink-faint hover:text-ink">
          Связаться с человеком
        </a>
      </div>
    </div>
  )
}
