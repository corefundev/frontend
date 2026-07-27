// Кросс-контурный хинт «у пользователя есть сессия» (#472 баг: хедер
// публичного контура на sprosly.com не видел сессию кабинета —
// localStorage per-origin, а httpOnly refresh-куку JS не читает).
// Паттерн #569 (CookieNotice): first-party кука Domain=.MAIN_HOST —
// общая для апекса и поддоменов. Хинт НЕ несёт секретов и НЕ даёт
// доступа — только переключает «Войти» ↔ «В кабинет»; истина о сессии
// остаётся за refresh-кукой (мёртвая сессия просто приведёт на /login).
import { MAIN_HOST } from '../../shared/hostRouting'

const KEY = 'sku-session-hint'
// синхронно с REFRESH_TTL_DAYS бэкенда (30 дней); хинт продлевается
// каждым setAuth (логин / тихий refresh в кабинете)
const MAX_AGE_S = 30 * 24 * 3600

function domainAttr(): string {
  // Domain только для настоящих доменов: на localhost атрибут невалиден
  return MAIN_HOST.includes('.') ? `; Domain=.${MAIN_HOST}` : ''
}

export function setSessionHint(): void {
  document.cookie =
    `${KEY}=1; Max-Age=${MAX_AGE_S}; Path=/${domainAttr()}; Secure; SameSite=Lax`
}

export function clearSessionHint(): void {
  document.cookie = `${KEY}=; Max-Age=0; Path=/${domainAttr()}; Secure; SameSite=Lax`
}

export function hasSessionHint(): boolean {
  return document.cookie.split('; ').some((c) => c.startsWith(`${KEY}=`))
}
