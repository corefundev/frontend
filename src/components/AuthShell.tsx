// src/components/AuthShell.tsx
//
// Обёртка auth-страниц (вход / регистрация / подтверждение / сброс):
// общий PublicHeader сверху + центрированная карточка. Header тот же,
// что на лендинге/тарифах/новостях — навигация не обрывается на входе.
// Футер намеренно не носим: auth-флоу короткий, лишний скролл вреден.

import { ReactNode } from 'react'

import { useAuthStore } from '../features/auth/store'
import { PublicHeader } from './PublicLayout'

export default function AuthShell({ children }: { children: ReactNode }) {
  const isAuthed = useAuthStore((s) => s.isAuthenticated())
  return (
    <div className="min-h-screen bg-surface flex flex-col">
      <PublicHeader isAuthed={isAuthed} />
      <main className="flex-1 flex items-center justify-center p-6">
        {children}
      </main>
    </div>
  )
}
