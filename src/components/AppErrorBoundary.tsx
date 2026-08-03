// #599: корневой ErrorBoundary — страховка от белого экрана.
//
// Основная защита от упавших чанков — одноразовый reload в
// chunkReload.ts; сюда ошибка доходит, только если и после перезагрузки
// не лучше (или упал обычный рендер). Показываем человеку читаемый
// экран с кнопкой вместо пустоты.
import React from 'react'

function isChunkError(err: unknown): boolean {
  const msg = String((err as Error)?.message ?? err ?? '')
  return /dynamically imported module|Importing a module script failed|ChunkLoadError/i
    .test(msg)
}

interface State { error: unknown | null }

export class AppErrorBoundary extends React.Component<
  { children: React.ReactNode }, State
> {
  state: State = { error: null }

  static getDerivedStateFromError(error: unknown): State {
    return { error }
  }

  componentDidCatch(error: unknown, info: React.ErrorInfo): void {
    // консоль — единственный канал диагностики на клиенте
    console.error('[AppErrorBoundary]', error, info.componentStack)
  }

  render(): React.ReactNode {
    if (this.state.error === null) return this.props.children
    const chunk = isChunkError(this.state.error)
    return (
      <div className="grid min-h-screen place-items-center bg-surface p-6">
        <div className="w-full max-w-md rounded-lg border border-surface-border bg-surface-raised p-8 text-center shadow-raised">
          <div className="mx-auto flex h-12 w-12 items-center justify-center rounded-full bg-warn-bg text-warn">
            <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
              <path d="M12 9v4m0 4h.01M10.3 3.9 1.8 18a2 2 0 0 0 1.7 3h17a2 2 0 0 0 1.7-3L13.7 3.9a2 2 0 0 0-3.4 0z" />
            </svg>
          </div>
          <h1 className="mt-4 text-lg font-semibold text-ink">
            {chunk ? 'Не удалось загрузить страницу' : 'Что-то пошло не так'}
          </h1>
          <p className="mt-2 text-sm text-ink-muted">
            {chunk
              ? 'Похоже, сервис только что обновился. Обновите страницу — это займёт секунду.'
              : 'Произошла ошибка отображения. Обновите страницу; если повторится — напишите нам в поддержку.'}
          </p>
          <button
            type="button"
            className="btn-primary mt-5"
            onClick={() => window.location.reload()}
          >
            Обновить страницу
          </button>
        </div>
      </div>
    )
  }
}
