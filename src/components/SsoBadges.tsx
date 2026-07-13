// AUTH-3 #447 — SSO-заглушки (решение владельца 2026-07-14): кнопки
// «Войти через Яндекс / ВКонтакте» рендерятся неактивными бейджами
// «скоро». Реальный OAuth включаем после переезда домена (MIGR-1 #424) —
// redirect URI приложений привязан к домену, дважды не регистрируем.
// Заменил собой OAuthButtons (живые кнопки — в git-истории).

export function SsoBadges() {
  return (
    <div>
      <div className="flex items-center gap-3 my-5" aria-hidden>
        <div className="h-px flex-1 bg-surface-border" />
        <span className="text-[11px] text-ink-subtle">или</span>
        <div className="h-px flex-1 bg-surface-border" />
      </div>
      <div className="grid grid-cols-2 gap-2">
        <SsoBadge label="Яндекс" mark="Я" markBg="#FC3F1D" />
        <SsoBadge label="ВКонтакте" mark="VK" markBg="#0077FF" />
      </div>
    </div>
  )
}

function SsoBadge({ label, mark, markBg }: { label: string; mark: string; markBg: string }) {
  return (
    <div
      className="relative flex items-center justify-center gap-2 rounded-md border border-surface-border
                 bg-surface-muted px-3 py-2.5 text-sm font-medium text-ink-subtle cursor-not-allowed select-none"
      title="Скоро — после переезда на новый домен"
      aria-disabled="true"
    >
      <span
        aria-hidden
        className="flex h-[18px] w-[18px] items-center justify-center rounded text-[9px] font-extrabold text-white opacity-60"
        style={{ background: markBg }}
      >
        {mark}
      </span>
      {label}
      <span className="absolute -top-2 -right-1.5 rounded-full bg-warn-bg px-1.5 py-px text-[9px] font-bold tracking-wide text-warn">
        скоро
      </span>
    </div>
  )
}
