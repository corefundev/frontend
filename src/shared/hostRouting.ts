// MIGR-1 (#424): host-routing сервис-поддоменов news./help.
//
// Единственный источник правды о том, на каком хосте живёт SPA:
//   • news.<domain> / help.<domain> — раздел рендерится от корня;
//     ЛЮБАЯ внутренняя ссылка вне раздела обязана быть АБСОЛЮТНОЙ на
//     основной домен — относительный путь (/plans, /login, даже /news
//     на help-хосте) проглатывается slug-роутами раздела;
//   • на основном домене нового бренда ссылки на «Новости»/«Базу знаний»
//     ведут на поддомены (канонические адреса);
//   • на легаси-домене (до Фазы 2) всё остаётся относительным.

export const HOSTNAME: string =
  typeof window !== 'undefined' ? window.location.hostname : ''

export const SECTION_HOST: 'news' | 'help' | null =
  HOSTNAME.startsWith('news.') ? 'news'
  : HOSTNAME.startsWith('help.') ? 'help'
  : null

/** APP-1 (#495): рабочая зона живёт на app.<домен>. */
export const IS_APP_HOST: boolean = HOSTNAME.startsWith('app.')

/** Базовый (основной) домен: на поддомене — без префикса news./help./app. */
export const MAIN_HOST: string = (SECTION_HOST || IS_APP_HOST)
  ? HOSTNAME.replace(/^(news|help|app)\./, '')
  : HOSTNAME

export const MAIN_ORIGIN: string =
  typeof window !== 'undefined'
    ? `${window.location.protocol}//${MAIN_HOST}`
    : ''

/** Хост нового бренда (поддомены существуют)? Легаси-домен их не имеет. */
const ON_BRANDED_HOST: boolean =
  MAIN_HOST === 'sprosly.com' || MAIN_HOST.endsWith('.sprosly.com')

/** Ссылка на страницу ОСНОВНОГО домена: относительная на нём самом,
 *  абсолютная — с сервис-поддоменов и app-хоста. */
export function mainUrl(path: string): string {
  return (SECTION_HOST || IS_APP_HOST) ? `${MAIN_ORIGIN}${path}` : path
}

/** APP-1 (#495): адрес рабочей зоны. На новом бренде кабинет живёт на
 *  app.<домен> (пути /app/* сохраняются); на легаси/dev-хостах app-хоста
 *  нет — путь остаётся относительным. */
export function appUrl(path: string): string {
  if (IS_APP_HOST) return path
  if (ON_BRANDED_HOST) {
    const proto = typeof window !== 'undefined'
      ? window.location.protocol : 'https:'
    return `${proto}//app.${MAIN_HOST}${path}`
  }
  return path
}

/** Канонический адрес раздела: поддомен на новом бренде, путь на легаси. */
export function sectionUrl(section: 'news' | 'help'): string {
  if (SECTION_HOST === section) return '/'
  if (ON_BRANDED_HOST) {
    return `${typeof window !== 'undefined' ? window.location.protocol : 'https:'}//${section}.${MAIN_HOST}/`
  }
  return `/${section}`
}

/** true, когда URL нужно рендерить <a>, а не router-<Link>. */
export function isExternal(url: string): boolean {
  return url.startsWith('http')
}
