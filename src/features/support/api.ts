// SUP-3 (#506): контракт Chat API ассистента поддержки (эпик #503).
// Ядро (SUP-2) реализует РОВНО этот контракт; до его запуска health
// отвечает 404/сетевой ошибкой → виджет показывает честный офлайн.
//
//   GET  /support/health → {status: 'ok'|'busy'|'offline', queue_depth?}
//   POST /support/chat   → text/event-stream:
//        event: token     data: {"delta": "..."}
//        event: citations data: {"items": [{"title": "...", "slug": "..."}]}
//        event: done      data: {"session_id": "...", "escalate": false}
import { BASE_URL } from '../../shared/api/client'

export interface Citation { title: string; slug: string }
export interface HealthResponse { status: 'ok' | 'busy' | 'offline'; queue_depth?: number }

export interface StreamHandlers {
  onToken:     (delta: string) => void
  onCitations: (items: Citation[]) => void
  onDone:      (sessionId: string, escalate: boolean) => void
  onError:     (e: unknown) => void
}

export async function supportHealth(): Promise<HealthResponse> {
  const r = await fetch(`${BASE_URL}/support/health`, { method: 'GET' })
  if (!r.ok) return { status: 'offline' }
  return (await r.json()) as HealthResponse
}

export async function supportChat(
  message: string,
  sessionId: string | null,
  surface: 'public' | 'cabinet',
  h: StreamHandlers,
  authToken?: string | null,
): Promise<void> {
  try {
    const r = await fetch(`${BASE_URL}/support/chat`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        ...(authToken ? { Authorization: `Bearer ${authToken}` } : {}),
      },
      body: JSON.stringify({ message, session_id: sessionId, surface }),
    })
    if (!r.ok || !r.body) throw new Error(`chat http ${r.status}`)
    const reader = r.body.getReader()
    const dec = new TextDecoder()
    let buf = ''
    for (;;) {
      const { done, value } = await reader.read()
      if (done) break
      buf += dec.decode(value, { stream: true })
      // SSE-фреймы разделены пустой строкой
      for (;;) {
        const i = buf.indexOf('\n\n')
        if (i < 0) break
        const frame = buf.slice(0, i); buf = buf.slice(i + 2)
        const ev = /^event: (.+)$/m.exec(frame)?.[1]
        const data = /^data: (.+)$/m.exec(frame)?.[1]
        if (!ev || !data) continue
        const j = JSON.parse(data)
        if (ev === 'token') h.onToken(String(j.delta ?? ''))
        else if (ev === 'citations') h.onCitations(j.items ?? [])
        else if (ev === 'done') h.onDone(String(j.session_id ?? ''), !!j.escalate)
      }
    }
  } catch (e) {
    h.onError(e)
  }
}
