// AC-3 (#314) — «Данные и приватность». Consolidates the 152-ФЗ PII controls
// (were in the profile dropdown, #156) into their proper home: export my data,
// close account (two-step), and a link to the full privacy policy (/privacy,
// admin-editable legal doc).
import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { useMutation } from '@tanstack/react-query'
import toast from 'react-hot-toast'

import { apiClient, errorMessage } from '../../shared/api/client'
import { useAuthStore } from '../auth/store'

export default function DataSection() {
  const nav = useNavigate()
  const clientId = useAuthStore((s) => s.clientId)
  const logout = useAuthStore((s) => s.logout)
  const [confirmClose, setConfirmClose] = useState(false)

  const { mutate: exportData, isPending: exporting } = useMutation({
    mutationFn: async () => {
      const { data } = await apiClient.get(`/clients/${clientId}/export`)
      return data
    },
    onSuccess: (data) => {
      const blob = new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' })
      const url = URL.createObjectURL(blob)
      const a = document.createElement('a')
      a.href = url
      a.download = `my-data-${clientId}.json`
      document.body.appendChild(a)
      a.click()
      a.remove()
      URL.revokeObjectURL(url)
      toast.success('Данные выгружены')
    },
    onError: (e) => toast.error(errorMessage(e, 'Не удалось выгрузить данные')),
  })

  const { mutate: closeAccount, isPending: closing } = useMutation({
    mutationFn: async () => { await apiClient.delete(`/clients/${clientId}`) },
    onSuccess: () => {
      toast.success('Аккаунт закрыт')
      setTimeout(() => { logout(); nav('/login') }, 1200)
    },
    onError: (e) => toast.error(errorMessage(e, 'Не удалось закрыть аккаунт')),
  })

  return (
    <div className="space-y-6">
      {/* Policy */}
      <section className="card p-6 sm:p-8">
        <p className="text-ink-muted text-sm mb-4">
          Мы обрабатываем ваши персональные данные в соответствии с 152-ФЗ
          «О персональных данных». Вы можете выгрузить их или закрыть аккаунт
          в любой момент.
        </p>
        <button className="text-sm text-brand-700 hover:underline" onClick={() => nav('/privacy')}>
          Политика конфиденциальности →
        </button>
      </section>

      {/* Export */}
      <section className="card p-6 sm:p-8">
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
          <div>
            <div className="font-medium text-ink">Скачать мои данные</div>
            <p className="text-sm text-ink-muted mt-1 max-w-md">
              Выгрузка профиля, обучений, загрузок и журнала доступа в JSON.
            </p>
          </div>
          <button className="btn-secondary shrink-0" onClick={() => exportData()} disabled={exporting}>
            {exporting ? 'Готовлю выгрузку…' : 'Скачать'}
          </button>
        </div>
      </section>

      {/* Close account */}
      <section className="card p-6 sm:p-8 border-danger/30">
        <div className="font-medium text-ink">Закрыть аккаунт</div>
        <p className="text-sm text-ink-muted mt-1 max-w-md">
          Доступ прекратится сразу. Данные хранятся ещё 30 дней, затем удаляются
          безвозвратно.
        </p>
        {!confirmClose ? (
          <button className="mt-4 text-sm font-medium text-danger hover:opacity-80" onClick={() => setConfirmClose(true)}>
            Закрыть аккаунт
          </button>
        ) : (
          <div className="mt-4 rounded-md border border-danger/40 bg-danger/5 p-4 space-y-3">
            <p className="text-sm text-ink leading-relaxed">
              Вы уверены? Это действие необратимо после 30 дней.
            </p>
            <div className="flex items-center gap-3">
              <button
                className="text-sm font-medium text-white bg-danger hover:bg-danger/90 rounded-md px-3 py-2 disabled:opacity-50"
                onClick={() => closeAccount()}
                disabled={closing}
              >
                {closing ? 'Закрываю…' : 'Да, закрыть аккаунт'}
              </button>
              <button
                className="text-sm text-ink-muted hover:text-ink px-2 py-2"
                onClick={() => setConfirmClose(false)}
                disabled={closing}
              >
                Отмена
              </button>
            </div>
          </div>
        )}
      </section>
    </div>
  )
}
