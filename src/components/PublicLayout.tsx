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
  return (
    <header className="sticky top-0 z-30 bg-white/90 backdrop-blur-sm border-b border-ink/10">
      <div className="mx-auto max-w-6xl px-5 lg:px-8 h-16 flex items-center justify-between">
        <Link to="/" className="flex items-center gap-2.5">
          <div className="h-8 w-8 rounded-lg bg-brand-500 grid place-items-center text-white font-bold text-sm">
            S
          </div>
          <span className="text-lg font-semibold text-ink">SKU Forecasting</span>
        </Link>

        <nav className="hidden md:flex items-center gap-7 text-sm text-ink-muted">
          <Link to="/#benefits" className="hover:text-ink transition-colors">
            Возможности
          </Link>
          <Link to="/#audience" className="hover:text-ink transition-colors">
            Для кого
          </Link>
          <Link to="/plans" className="hover:text-ink transition-colors">
            Тарифы
          </Link>
        </nav>

        <div className="flex items-center gap-2">
          {isAuthed ? (
            <Link
              to="/app"
              className="inline-flex items-center px-4 py-2 rounded-lg bg-brand-500 text-white text-sm font-medium hover:bg-brand-600 transition-colors"
            >
              В кабинет →
            </Link>
          ) : (
            <>
              <Link
                to="/login"
                className="hidden sm:inline-flex px-4 py-2 text-sm text-ink-muted hover:text-ink transition-colors"
              >
                Войти
              </Link>
              <Link
                to="/signup"
                className="inline-flex items-center px-4 py-2 rounded-lg bg-brand-500 text-white text-sm font-medium hover:bg-brand-600 transition-colors"
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

function PublicFooter() {
  return (
    <footer className="bg-ink/[0.03] border-t border-ink/10 mt-auto">
      <div className="mx-auto max-w-6xl px-5 lg:px-8 py-12">
        <div className="grid grid-cols-2 md:grid-cols-4 gap-8 mb-10">
          <FooterCol
            title="Возможности"
            links={[
              { label: 'Прогнозы',          href: '/#benefits' },
              { label: 'Учёт сезонности',   href: '/#benefits' },
              { label: 'API + интерфейс',   href: '/#benefits' },
              { label: 'Метрики качества',  href: '/#benefits' },
            ]}
          />

          <FooterCol
            title="Применение"
            links={[
              { label: 'Розница',                href: '/#audience' },
              { label: 'E-commerce',             href: '/#audience' },
              { label: 'Маркетплейсы',           href: '/#audience' },
              { label: 'Производство и опт',     href: '/#audience' },
            ]}
          />

          <FooterCol
            title="Личный кабинет"
            links={[
              { label: 'Войти',           href: '/login'  },
              { label: 'Зарегистрироваться', href: '/signup' },
              { label: 'Тарифы',          href: '/plans'  },
            ]}
          />

          <FooterCol
            title="Контакты"
            links={[
              { label: 'dochub.org@gmail.com', href: 'mailto:dochub.org@gmail.com', external: true },
              { label: 'Telegram',             href: 'https://t.me/dochub_support', external: true },
              { label: 'Обратная связь',       href: 'mailto:dochub.org@gmail.com', external: true },
            ]}
          />
        </div>

        <hr className="border-ink/10 my-6" />

        <div className="flex flex-wrap items-center justify-between gap-4">
          <p className="text-xs text-ink-subtle">
            © {new Date().getFullYear()} SKU Forecasting
          </p>

          <nav className="flex flex-wrap items-center gap-x-6 gap-y-2 text-xs">
            <Link to="/"        className="text-ink-subtle hover:text-ink transition-colors">Главная</Link>
            <Link to="/plans"   className="text-ink-subtle hover:text-ink transition-colors">Тарифы</Link>
            <Link to="/privacy" className="text-ink-subtle hover:text-ink transition-colors">Политика конфиденциальности</Link>
            <Link to="/login"   className="text-ink-subtle hover:text-ink transition-colors">Войти</Link>
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
      <h4 className="text-xs font-semibold uppercase tracking-wider text-ink-muted mb-4">
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
                className="text-sm text-ink hover:text-brand-500 transition-colors"
              >
                {l.label}
              </a>
            </li>
          ) : (
            <li key={l.label}>
              <Link
                to={l.href}
                className="text-sm text-ink hover:text-brand-500 transition-colors"
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
