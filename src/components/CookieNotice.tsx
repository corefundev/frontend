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
//
// Факт прочтения (#569): first-party кука `cookie-notice-ack` с
// Domain=.<MAIN_HOST> — общая для апекса и ВСЕХ поддоменов (localStorage
// per-origin: прочтение на апексе не было видно на help./news., баннер
// выскакивал на каждом поддомене заново). localStorage остаётся как
// fallback (кука заблокирована) и как путь миграции: старым прочтениям
// из LS кука дозаписывается при следующем визите (backfill).

import { useEffect, useState } from 'react'
import { Link } from 'react-router-dom'

import {
  IS_ADMIN_HOST, IS_APP_HOST, MAIN_HOST, isExternal, mainUrl,
} from '../shared/hostRouting'

const ACK_KEY = 'cookie-notice-ack'

function hasAckCookie(): boolean {
  return document.cookie.split('; ').some((c) => c.startsWith(`${ACK_KEY}=`))
}

function isAcked(): boolean {
  if (typeof window === 'undefined') return true
  try {
    return hasAckCookie() || window.localStorage.getItem(ACK_KEY) !== null
  } catch {
    // Хранилища недоступны (приватный режим и т.п.) — запомнить
    // прочтение не сможем; не мозолим глаза баннером на каждой странице.
    return true
  }
}

function persistAck(): void {
  const iso = new Date().toISOString()
  // Domain только для настоящих доменов: на localhost атрибут невалиден.
  const domain = MAIN_HOST.includes('.') ? `; Domain=.${MAIN_HOST}` : ''
  const secure = window.location.protocol === 'https:' ? '; Secure' : ''
  document.cookie =
    `${ACK_KEY}=${encodeURIComponent(iso)}; Path=/; Max-Age=31536000; SameSite=Lax${domain}${secure}`
  try {
    window.localStorage.setItem(ACK_KEY, iso)
  } catch {
    // LS недоступен — куки достаточно.
  }
}

export default function CookieNotice() {
  const [acked, setAcked] = useState(isAcked)

  // Миграция: прочтение записано до #569 (только LS) — дозаписываем общую
  // куку, чтобы поддомены больше не показывали баннер повторно.
  useEffect(() => {
    if (acked && !IS_APP_HOST && !IS_ADMIN_HOST) {
      try {
        if (!hasAckCookie() && window.localStorage.getItem(ACK_KEY) !== null) {
          persistAck()
        }
      } catch {
        // Хранилища недоступны — мигрировать нечего.
      }
    }
  }, [acked])

  if (IS_APP_HOST || IS_ADMIN_HOST || acked) return null

  function dismiss() {
    try {
      persistAck()
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
