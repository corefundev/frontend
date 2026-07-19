// COOK-1 (#497): информационный cookie-баннер публичного контура.
//
// У сервиса есть ТОЛЬКО строго необходимые cookie (httpOnly refresh-кука,
// сервисные cookie Cloudflare, идентификаторы Turnstile) — аналитики нет,
// поэтому согласие не запрашивается: достаточно уведомления с одной
// кнопкой «Понятно». Категории/тумблеры появятся только вместе с
// opt-in-механикой, когда (и если) добавится аналитика.
//
// Показывается ТОЛЬКО на публичном контуре: апекс + сервис-поддомены
// news./help. На app-/admin-хостах не рендерится вовсе (туда попадают
// только после входа через публичный контур, где баннер уже был виден).
// Факт прочтения — localStorage `cookie-notice-ack` (ISO-дата); ключ
// стоит — баннер больше не показываем.

import { useState } from 'react'
import { Link } from 'react-router-dom'

import { IS_ADMIN_HOST, IS_APP_HOST, isExternal, mainUrl } from '../shared/hostRouting'

const ACK_KEY = 'cookie-notice-ack'

function isAcked(): boolean {
  if (typeof window === 'undefined') return true
  try {
    return window.localStorage.getItem(ACK_KEY) !== null
  } catch {
    // localStorage недоступен (приватный режим и т.п.) — запомнить
    // прочтение не сможем; не мозолим глаза баннером на каждой странице.
    return true
  }
}

export default function CookieNotice() {
  const [acked, setAcked] = useState(isAcked)
  if (IS_APP_HOST || IS_ADMIN_HOST || acked) return null

  function dismiss() {
    try {
      window.localStorage.setItem(ACK_KEY, new Date().toISOString())
    } catch {
      // Не смогли записать — скрываем хотя бы до перезагрузки страницы.
    }
    setAcked(true)
  }

  // На сервис-поддоменах относительный /privacy проглотили бы slug-роуты
  // раздела — mainUrl() даёт абсолютный адрес апекса (см. hostRouting).
  const privacyUrl = mainUrl('/privacy')
  const privacyLinkClass = 'font-medium text-brand-500 hover:text-brand-600'

  return (
    <div
      role="region"
      aria-label="Уведомление об использовании cookie"
      className="fixed inset-x-0 bottom-0 z-40 p-3 sm:bottom-4 sm:flex sm:justify-center sm:p-0"
    >
      <div className="flex flex-col gap-3 rounded-xl border border-ink/10 bg-white p-4 shadow-[0_8px_30px_rgba(15,23,42,0.12)] sm:mx-4 sm:max-w-2xl sm:flex-row sm:items-center">
        <p className="text-sm text-ink-muted">
          Мы используем cookie, строго необходимые для работы сервиса, и
          сервисные cookie Cloudflare. Аналитических cookie нет.{' '}
          {isExternal(privacyUrl) ? (
            <a href={privacyUrl} className={privacyLinkClass}>Подробнее</a>
          ) : (
            <Link to={privacyUrl} className={privacyLinkClass}>Подробнее</Link>
          )}
        </p>
        <button type="button" onClick={dismiss} className="btn-primary shrink-0">
          Понятно
        </button>
      </div>
    </div>
  )
}
