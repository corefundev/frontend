// Общая строка аккаунт-разделов (#472 правки 2026-07-28):
// «иконка-кружок · заголовок + подзаголовок · действие справа» —
// используется Безопасностью и Интеграцией. Не-компонентные общие
// экспорты живут в audit.ts (react-refresh).
export function SecRow({ icon, title, subtitle, action }: {
  icon: React.ReactNode
  title: string
  subtitle: React.ReactNode
  action?: React.ReactNode
}) {
  return (
    <div className="flex items-center gap-4 py-3">
      <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-full bg-surface-sunken text-ink-muted">
        {icon}
      </div>
      <div className="min-w-0 flex-1">
        <div className="text-sm font-medium text-ink">{title}</div>
        <div className="text-sm text-ink-muted truncate">{subtitle}</div>
      </div>
      {action && <div className="shrink-0">{action}</div>}
    </div>
  )
}

