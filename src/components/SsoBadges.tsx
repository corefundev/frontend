// AUTH-3 #447 — SSO-заглушки (решение владельца 2026-07-14): кнопки
// «Войти через Яндекс / ВКонтакте» рендерятся неактивными бейджами
// «скоро». Реальный OAuth включаем после переезда домена (MIGR-1 #424) —
// redirect URI приложений привязан к домену, дважды не регистрируем.
// Редизайн 2026-07-15 (референс владельца): бейджи В ДВЕ СТРОКИ (каждый
// на всю ширину колонки) НАД формой; разделитель — отдельный SsoDivider.

export function SsoBadges() {
  return (
    <div className="grid gap-2.5">
      <SsoBadge label="Яндекс ID" mark="Я" markBg="#FC3F1D" />
      <SsoBadge label="VK ID" mark="VK" markBg="#0077FF" />
    </div>
  )
}

export function SsoDivider({ label }: { label: string }) {
  return (
    <div className="flex items-center gap-4 my-7" aria-hidden>
      <div className="h-px flex-1 bg-surface-deep/60" />
      <span className="text-sm text-ink-muted">{label}</span>
      <div className="h-px flex-1 bg-surface-deep/60" />
    </div>
  )
}

function SsoBadge({ label, mark, markBg }: { label: string; mark: string; markBg: string }) {
  return (
    <div
      className="relative flex items-center justify-center gap-2.5 rounded-md border border-surface-border
                 bg-surface-muted px-4 py-3 text-sm font-medium text-ink-subtle cursor-not-allowed select-none"
      title="Скоро — после переезда на новый домен"
      aria-disabled="true"
    >
      <span
        aria-hidden
        className="flex h-[20px] w-[20px] items-center justify-center rounded text-[10px] font-extrabold text-white opacity-60"
        style={{ background: markBg }}
      >
        {mark}
      </span>
      {label}
      <span className="absolute top-1/2 -translate-y-1/2 right-3 rounded-full bg-warn-bg px-2 py-0.5 text-[10px] font-bold tracking-wide text-warn">
        скоро
      </span>
    </div>
  )
}
