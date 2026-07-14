// src/components/AuthShell.tsx
//
// Обёртка auth-страниц (вход / регистрация / подтверждение / сброс):
// общий PublicHeader сверху + узкая колонка контента ПРЯМО НА ФОНЕ —
// без карточки и контура (референс владельца 2026-07-15). Header тот
// же, что на лендинге/тарифах/новостях. Футер намеренно не носим:
// auth-флоу короткий, лишний скролл вреден.

import { ReactNode } from 'react'

import { useAuthStore } from '../features/auth/store'
import { PublicHeader } from './PublicLayout'

export default function AuthShell({ children }: { children: ReactNode }) {
  const isAuthed = useAuthStore((s) => s.isAuthenticated())
  return (
    <div className="min-h-screen bg-white flex flex-col">
      <PublicHeader isAuthed={isAuthed} />
      <main className="flex-1 px-6 pt-7 pb-10 sm:pt-9">
        <div className="mx-auto w-full max-w-md animate-fade-in">
          {children}
        </div>
      </main>
    </div>
  )
}
