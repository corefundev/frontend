// HC-4 (#410): публичная витрина базы знаний — видна без логина.
import PublicLayout from '../components/PublicLayout'
import { HelpCategoriesGrid, HelpSearchBox } from '../features/help/HelpComponents'

export default function HelpPage() {
  return (
    <PublicLayout>
      <section className="py-12 lg:py-16">
        <div className="mx-auto max-w-3xl px-5 lg:px-8">
          <h1 className="text-3xl font-semibold tracking-tight text-ink">База знаний</h1>
          <p className="text-ink-muted mt-2 mb-6">
            Инструкции по загрузке данных, обучению модели и работе с прогнозами.
          </p>
          <div className="mb-8"><HelpSearchBox basePath="/help" /></div>
          <HelpCategoriesGrid basePath="/help" />
        </div>
      </section>
    </PublicLayout>
  )
}
