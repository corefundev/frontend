// src/components/PublicLayout.tsx
//
// Общая обёртка для публичных страниц: одинаковая шапка + подвал на
// всех маршрутах вне /app. Эстетика — referest.ru-style: чистый
// белый фон, brand teal как единственный акцент, sticky header, 4-кол
// footer + bottom row с копирайтом и навигацией.

import { Link } from 'react-router-dom'
import { ReactNode } from 'react'
import { useAuthStore } from '../features/auth/store'

interface Props {
  children: ReactNode
}

export default function PublicLayout({ children }: Props) {
  const isAuthed = useAuthStore((s) => s.isAuthenticated())
  return (
    <div className="min-h-screen bg-white text-ink flex flex-col">
      <PublicHeader isAuthed={isAuthed} />
      <main className="flex-1">{children}</main>
      <PublicFooter />
    </div>
  )
}

// ── Header ─────────────────────────────────────────────────────────────

function PublicHeader({ isAuthed }: { isAuthed: boolean }) {
  // Header palette spec:
  //   • foreground (all text)  #020817  (slate-950)
  //   • link hover background  #f1f5f9  (slate-100), 2px radius
  //   • Регистрация CTA bg     #0f172a  (slate-900)
  //   • Регистрация CTA text   #f8fafc  (slate-50)
  return (
    <header className="sticky top-0 z-30 bg-white/90 backdrop-blur-sm border-b border-ink/10">
      <div className="mx-auto max-w-6xl px-5 lg:px-8 h-16 flex items-center justify-between text-sm leading-5 text-[#020817]">
        <Link to="/" className="flex items-center gap-2.5">
          <div className="h-8 w-8 rounded bg-brand-500 grid place-items-center text-white font-bold text-sm">
            S
          </div>
          <span className="font-semibold">SKU Forecasting</span>
        </Link>

        <nav className="hidden md:flex items-center gap-1">
          <Link
            to="/#benefits"
            className="px-3 py-2 rounded hover:bg-[#f1f5f9] transition-colors"
          >
            Возможности
          </Link>
          <Link
            to="/#audience"
            className="px-3 py-2 rounded hover:bg-[#f1f5f9] transition-colors"
          >
            Для кого
          </Link>
          <Link
            to="/plans"
            className="px-3 py-2 rounded hover:bg-[#f1f5f9] transition-colors"
          >
            Тарифы
          </Link>
        </nav>

        <div className="flex items-center gap-2">
          {isAuthed ? (
            <Link
              to="/app"
              className="inline-flex items-center px-4 py-2 rounded text-sm font-medium bg-[#0f172a] text-[#f8fafc] hover:bg-[#020817] transition-colors"
            >
              В кабинет →
            </Link>
          ) : (
            <>
              <Link
                to="/login"
                className="hidden sm:inline-flex px-3 py-2 rounded text-sm hover:bg-[#f1f5f9] transition-colors"
              >
                Войти
              </Link>
              <Link
                to="/signup"
                className="inline-flex items-center px-4 py-2 rounded text-sm font-medium bg-[#0f172a] text-[#f8fafc] hover:bg-[#020817] transition-colors"
              >
                Регистрация
              </Link>
            </>
          )}
        </div>
      </div>
    </header>
  )
}

// ── Footer ─────────────────────────────────────────────────────────────
//
// Цвета фиксированы по запросу (referest-style):
//   • base   : rgb(100, 116, 139)  — slate-500, links + bottom-bar
//   • hover  : rgb(2, 8, 23)       — slate-950 near-black
//   • size   : 0.875rem = text-sm  (Tailwind)
//
// Класс `footer-link` ниже = `text-sm text-[#64748B] hover:text-[#020817]`.

function PublicFooter() {
  // Структура — footer-7 (shadcnblocks, реализовано in-house): слева
  // бренд-блок (лого + описание + соц-иконки), справа 3 колонки ссылок,
  // внизу полоса © + правовые ссылки. Палитра — НАША, без изменений.
  return (
    <footer className="bg-[#f1f5f9] border-t border-ink/10 mt-auto">
      <div className="mx-auto max-w-7xl px-5 lg:px-8 py-12">
        <div className="flex flex-col lg:flex-row gap-10 lg:gap-20">
          {/* ── бренд ── */}
          <div className="max-w-sm shrink-0">
            <Link to="/" className="flex items-center gap-2.5">
              <div className="h-8 w-8 rounded bg-brand-500 grid place-items-center text-white font-bold text-sm">
                S
              </div>
              <span className="font-semibold text-[#020817]">SKU Forecasting</span>
            </Link>
            <p className="mt-4 text-sm text-[#64748B] leading-relaxed">
              Прогноз спроса по каждому SKU на вашей истории продаж —
              c честной метрикой качества и без ручной настройки.
            </p>
            <div className="mt-6 flex items-center gap-4">
              <a href="mailto:dochub.org@gmail.com" aria-label="Написать на почту"
                 className="text-[#64748B] hover:text-[#020817] transition-colors">
                <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8"
                     className="h-5 w-5" aria-hidden>
                  <rect x="3" y="5" width="18" height="14" rx="2" />
                  <path d="M3 7l9 6 9-6" />
                </svg>
              </a>
              <a href="https://t.me/dochub_support" target="_blank" rel="noopener noreferrer"
                 aria-label="Telegram"
                 className="text-[#64748B] hover:text-[#020817] transition-colors">
                <svg viewBox="0 0 24 24" fill="currentColor" className="h-5 w-5" aria-hidden>
                  <path d="M21.9 4.6c.3-1.2-.9-2.2-2-1.7L2.7 9.9c-1.2.5-1.1 2.2.1 2.6l4.7 1.5 1.8 5.6c.4 1.1 1.8 1.4 2.6.5l2.6-2.8 4.8 3.5c1 .7 2.4.2 2.7-1l-.1.4 2-15.6zM8.4 13.2l9.7-6-7.5 7.1-.3.3-.5 3.6-1.4-5z" />
                </svg>
              </a>
            </div>
          </div>

          {/* ── 3 колонки ссылок ── */}
          <div className="grid grid-cols-2 sm:grid-cols-3 gap-8 lg:ml-auto flex-1 lg:max-w-2xl">
            <FooterCol
              title="Продукт"
              links={[
                { label: 'Возможности',       href: '/#benefits' },
                { label: 'Для кого',          href: '/#audience' },
                { label: 'Тарифы',            href: '/plans' },
                { label: 'Новости',           href: '/news' },
              ]}
            />
            <FooterCol
              title="Применение"
              links={[
                { label: 'Розница',            href: '/#audience' },
                { label: 'E-commerce',         href: '/#audience' },
                { label: 'Маркетплейсы',       href: '/#audience' },
                { label: 'Производство и опт', href: '/#audience' },
              ]}
            />
            <FooterCol
              title="Ресурсы"
              links={[
                { label: 'База знаний',        href: '/help' },
                { label: 'Войти',              href: '/login' },
                { label: 'Зарегистрироваться', href: '/signup' },
                { label: 'Обратная связь',     href: 'mailto:dochub.org@gmail.com', external: true },
              ]}
            />
          </div>
        </div>

        {/* ── нижняя полоса ── */}
        <div className="mt-12 pt-6 border-t border-ink/10 flex flex-col md:flex-row md:items-center justify-between gap-4">
          <p className="text-sm text-[#64748B]">
            © {new Date().getFullYear()} SKU Forecasting. Все права защищены.
          </p>
          <nav className="flex flex-wrap items-center gap-x-6 gap-y-2">
            <Link to="/privacy" className="text-sm text-[#64748B] hover:text-[#020817] transition-colors">Политика конфиденциальности</Link>
            <Link to="/plans"   className="text-sm text-[#64748B] hover:text-[#020817] transition-colors">Тарифы</Link>
          </nav>
        </div>
      </div>
    </footer>
  )
}

interface FooterLink {
  label:    string
  href:     string
  external?: boolean
}

function FooterCol({ title, links }: { title: string; links: FooterLink[] }) {
  return (
    <div>
      <h4 className="text-xs font-semibold uppercase tracking-wider text-[#020817] mb-4">
        {title}
      </h4>
      <ul className="space-y-2.5">
        {links.map((l) =>
          l.external ? (
            <li key={l.label}>
              <a
                href={l.href}
                target="_blank"
                rel="noopener noreferrer"
                className="text-sm text-[#64748B] hover:text-[#020817] transition-colors"
              >
                {l.label}
              </a>
            </li>
          ) : (
            <li key={l.label}>
              <Link
                to={l.href}
                className="text-sm text-[#64748B] hover:text-[#020817] transition-colors"
              >
                {l.label}
              </Link>
            </li>
          ),
        )}
      </ul>
    </div>
  )
}
