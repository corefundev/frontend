// LEG-3 #431 (инкремент 2): блокирующая модалка повторного согласия.
// Показывается в кабинете, когда /auth/consent-status говорит required:
// владелец пометил версию документа чекбоксом «требует повторного
// согласия». Закрыть без принятия нельзя (материальность изменений уже
// решена владельцем при пометке); запасной выход — «Выйти».
import { useState } from 'react'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { useNavigate } from 'react-router-dom'
import toast from 'react-hot-toast'

import { consentApi } from '../features/auth/api'
import { useAuthStore } from '../features/auth/store'
import { errorMessage } from '../shared/api/client'

const DOC_URLS: Record<string, string> = {
  terms: '/terms', privacy: '/privacy', consent: '/consent', pdn: '/pdn-policy',
}

export default function ConsentGate() {
  const qc = useQueryClient()
  const nav = useNavigate()
  const logout = useAuthStore((s) => s.logout)
  const [agreed, setAgreed] = useState(false)

  const { data } = useQuery({
    queryKey: ['consent-status'],
    queryFn: () => consentApi.status(),
    staleTime: 10 * 60_000,
    meta: { silent: true },
    retry: 1,
  })

  const acceptMut = useMutation({
    mutationFn: () => consentApi.accept(),
    onSuccess: () => {
      toast.success('Спасибо! Согласие зафиксировано')
      qc.invalidateQueries({ queryKey: ['consent-status'] })
    },
    onError: (e) => toast.error(errorMessage(e, 'Не удалось зафиксировать согласие')),
  })

  if (!data?.required) return null

  return (
    <div className="fixed inset-0 z-50 bg-slate-900/45 backdrop-blur-[2px] flex items-start justify-center pt-[18vh] p-4"
         role="dialog" aria-modal="true" aria-label="Условия обновились">
      <div className="w-full max-w-lg card-paper overflow-hidden">
        <div className="px-5 py-3 border-b border-surface-border bg-surface-muted/50 font-semibold text-[14px]">
          Условия использования обновились
        </div>
        <div className="px-5 py-4 space-y-3">
          <p className="text-sm text-ink-muted">
            Для продолжения работы примите, пожалуйста, обновлённые документы:
          </p>
          <ul className="space-y-2">
            {data.docs.map((d) => (
              <li key={d.doc_id} className="rounded-lg border border-surface-border px-3 py-2">
                <a href={DOC_URLS[d.doc_id] ?? '/terms'} target="_blank" rel="noopener noreferrer"
                   className="text-sm font-medium text-brand-600 hover:underline">
                  {d.title}
                </a>
                <span className="text-xs text-ink-subtle ml-2">
                  версия {d.current_version}
                </span>
                {d.change_summary && (
                  <div className="text-xs text-ink-muted mt-1">
                    Что изменилось: {d.change_summary}
                  </div>
                )}
              </li>
            ))}
          </ul>
          <label className="flex items-start gap-2 text-sm select-none pt-1">
            <input type="checkbox" className="mt-0.5" checked={agreed}
                   onChange={(e) => setAgreed(e.target.checked)} />
            <span className="text-ink-muted">
              Я ознакомился с обновлёнными документами и принимаю их условия
            </span>
          </label>
        </div>
        <div className="px-5 py-3 border-t border-surface-border flex justify-between items-center">
          <button type="button" className="btn-ghost text-sm"
                  onClick={() => { logout(); nav('/login', { replace: true }) }}>
            Выйти
          </button>
          <button type="button" className="btn-primary text-sm"
                  disabled={!agreed || acceptMut.isPending}
                  onClick={() => acceptMut.mutate()}>
            {acceptMut.isPending ? 'Сохранение…' : 'Принять и продолжить'}
          </button>
        </div>
      </div>
    </div>
  )
}
