// #599: восстановление после падения lazy-чанка.
//
// Каждый деплой меняет хэши чанков; вкладка, открытая до деплоя, при
// первом же ленивом переходе получает 404 на старое имя → React
// размонтирует дерево → белый экран. Vite сигналит об этом событием
// `vite:preloadError` ДО того, как ошибка дойдёт до React — здесь мы
// один раз перезагружаем страницу (свежий index подтянет новые хэши).
//
// Гард от цикла: если чанк падает и после перезагрузки (реальный сбой
// сети/сервера, не смена хэшей), второй раз НЕ перезагружаем — ошибка
// доходит до AppErrorBoundary, который показывает человеку экран с
// кнопкой вместо бесконечного цикла reload'ов.
const KEY = 'sku-chunk-reload-at'
const WINDOW_MS = 60_000

export function installChunkReloadHandler(): void {
  window.addEventListener('vite:preloadError', (event) => {
    const last = Number(sessionStorage.getItem(KEY) || '0')
    if (Date.now() - last < WINDOW_MS) {
      // уже перезагружались недавно — не зацикливаемся, пусть ошибку
      // покажет AppErrorBoundary
      return
    }
    sessionStorage.setItem(KEY, String(Date.now()))
    event.preventDefault()          // гасим стандартный проброс ошибки
    window.location.reload()
  })
}
