// #599: скелетон кабинета на время восстановления сессии (обмен
// remember-me-куки при заходе/переходе с апекса на app-хост).
// Каркас зеркалит геометрию AppLayout (шапка h-14 → таб-бар → карточка
// контента), чтобы после загрузки интерфейс «проявился» на своих местах
// без скачка. Логотип настоящий, остальное — пульсирующие плейсхолдеры.
export default function CabinetSkeleton() {
  return (
    <div className="cabinet-v2 min-h-screen flex flex-col bg-surface">
      <header className="bg-surface-raised border-b border-surface-border shrink-0">
        <div className="flex h-14 items-center gap-3 px-5">
          <span className="flex items-center gap-2.5 mr-1">
            <span className="flex h-8 w-8 items-center justify-center rounded-lg bg-brand-500 text-[15px] font-bold text-white">S</span>
            <span className="text-[15.5px] font-bold text-ink">Sprosly</span>
          </span>
          <span className="flex-1" />
          <div className="flex animate-pulse items-center gap-3">
            <div className="h-7 w-24 rounded-lg bg-surface-muted" />
            <div className="h-8 w-8 rounded-full bg-surface-muted" />
          </div>
        </div>
        <div className="flex animate-pulse items-center gap-4 px-5 pb-3">
          <div className="h-4 w-20 rounded-md bg-surface-muted" />
          <div className="h-4 w-24 rounded-md bg-surface-muted" />
          <div className="h-4 w-16 rounded-md bg-surface-muted" />
          <div className="h-4 w-24 rounded-md bg-surface-muted" />
        </div>
      </header>
      <main className="flex-1 overflow-auto p-4">
        <div className="min-h-full animate-pulse rounded-lg border border-surface-border bg-surface-raised p-6 shadow-raised sm:p-7">
          <div className="mb-6 h-5 w-44 rounded-md bg-surface-muted" />
          <div className="grid gap-4 sm:grid-cols-3">
            <div className="h-24 rounded-lg bg-surface-muted" />
            <div className="h-24 rounded-lg bg-surface-muted" />
            <div className="h-24 rounded-lg bg-surface-muted" />
          </div>
          <div className="mt-6 space-y-3">
            <div className="h-4 w-3/4 rounded-md bg-surface-muted" />
            <div className="h-4 w-2/3 rounded-md bg-surface-muted" />
            <div className="h-4 w-1/2 rounded-md bg-surface-muted" />
          </div>
          <div className="mt-6 h-72 rounded-lg bg-surface-muted" />
        </div>
      </main>
    </div>
  )
}
