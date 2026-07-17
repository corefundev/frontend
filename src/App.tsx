import { Navigate, Route, Routes } from 'react-router-dom'
import { lazy, Suspense, useEffect, useState } from 'react'

import { useAuthStore } from './features/auth/store'
import { tryRefreshToken } from './shared/api/client'
import AppLayout from './components/AppLayout'
import AdminGuard from './components/AdminGuard'
import { MAIN_ORIGIN, SECTION_HOST } from './shared/hostRouting'
import PjaxLoader from './components/PjaxLoader'
import LoginPage from './pages/LoginPage'
import AdminLoginPage from './pages/AdminLoginPage'
import LandingPage from './pages/LandingPage'

// Code-split client pages — keeps the initial bundle small (login first).
const DashboardPage     = lazy(() => import('./pages/client/DashboardPage'))
const UpgradePage       = lazy(() => import('./pages/client/UpgradePage'))
const ScenariosPage     = lazy(() => import('./pages/client/ScenariosPage'))
const PromoPage         = lazy(() => import('./pages/client/PromoPage'))
const ForecastsPage     = lazy(() => import('./pages/client/ForecastsPage'))
const OrdersPage        = lazy(() => import('./pages/client/OrdersPage'))
const TrainingPage      = lazy(() => import('./pages/client/TrainingPage'))
const TrainingHistoryPage = lazy(() => import('./pages/client/TrainingHistoryPage'))
const SettingsPage      = lazy(() => import('./pages/client/SettingsPage'))
const AccountPage       = lazy(() => import('./pages/client/AccountPage'))
const AccountProfile    = lazy(() => import('./features/account/ProfileSection'))
const AccountSecurity   = lazy(() => import('./features/account/SecuritySection'))
const AccountData       = lazy(() => import('./features/account/DataSection'))

// AC-1 (#312): tiny inline placeholder for account sections whose AC issue
// hasn't shipped — kept in App.tsx so AccountPage stays a clean lazy chunk.
function AccountSectionPlaceholder() {
  return (
    <section className="card p-8">
      <p className="text-ink-muted">Скоро здесь появятся настройки этого раздела.</p>
    </section>
  )
}

// «Данные» group (epic #320) — placeholder pages until the real sections ship
// (Подготовка данных = DP-5 after the DP-2/3/4 backend; Обогащение = later).
function DataSectionPlaceholder({ title, body }: { title: string; body: string }) {
  return (
    <div className="max-w-3xl">
      <div className="eyebrow">Данные</div>
      <h1 className="display-em text-brand-700 text-3xl sm:text-4xl mt-2 leading-[1.05]">{title}</h1>
      <section className="card p-8 mt-6">
        <p className="text-ink-muted leading-relaxed">{body}</p>
        <p className="mt-3 text-xs text-ink-subtle">Раздел в разработке.</p>
      </section>
    </div>
  )
}
const UploadsPage       = lazy(() => import('./pages/client/UploadsPage'))
const DataPreparePage   = lazy(() => import('./pages/client/DataPreparePage'))
const PlansPage         = lazy(() => import('./pages/PlansPage'))
const OnboardingPage    = lazy(() => import('./pages/OnboardingPage'))
const SignupPage        = lazy(() => import('./pages/SignupPage'))
const SignupVerifyPage  = lazy(() => import('./pages/SignupVerifyPage'))
const ForgotPasswordPage = lazy(() => import('./pages/ForgotPasswordPage'))
const ResetPasswordPage  = lazy(() => import('./pages/ResetPasswordPage'))
const OAuthReturnPage   = lazy(() => import('./pages/OAuthReturnPage'))
const AdminClientsPage  = lazy(() => import('./pages/admin/AdminClientsPage'))
const AdminLegalPage    = lazy(() => import('./pages/admin/AdminLegalPage'))
const AdminNotificationsPage = lazy(() => import('./pages/admin/AdminNotificationsPage'))
const AdminNewsPage = lazy(() => import('./pages/admin/AdminNewsPage'))
const AdminNewsEditorPage = lazy(() => import('./pages/admin/AdminNewsEditorPage'))
const AdminHelpPage = lazy(() => import('./pages/admin/AdminHelpPage'))
const AdminHelpEditorPage = lazy(() => import('./pages/admin/AdminHelpEditorPage'))
const AdminHomePage = lazy(() => import('./pages/admin/AdminHomePage'))
const AdminPlansPage = lazy(() => import('./pages/admin/AdminPlansPage'))
const AdminTrainingPage = lazy(() => import('./pages/admin/AdminTrainingPage'))
const AdminSystemPage = lazy(() => import('./pages/admin/AdminSystemPage'))
const AdminAuditPage = lazy(() => import('./pages/admin/AdminAuditPage'))
const AdminSecurityPage = lazy(() => import('./pages/admin/AdminSecurityPage'))
const AdminDataPage = lazy(() => import('./pages/admin/AdminDataPage'))
const AdminClientCardPage = lazy(() => import('./pages/admin/AdminClientCardPage'))
const AdminLayout = lazy(() => import('./components/AdminLayout'))
const LegalDocPage      = lazy(() => import('./pages/LegalDocPage'))
const NewsPage          = lazy(() => import('./pages/NewsPage'))
const NewsPostPage      = lazy(() => import('./pages/NewsPostPage'))
const NewsClientPage    = lazy(() => import('./pages/client/NewsClientPage'))
const HelpPage          = lazy(() => import('./pages/HelpPage'))
const HelpCategoryPage  = lazy(() => import('./pages/HelpCategoryPage'))
const HelpArticlePage   = lazy(() => import('./pages/HelpArticlePage'))
const HelpClientPage    = lazy(() => import('./pages/client/HelpClientPage'))

function ProtectedRoute({ children }: { children: JSX.Element }) {
  const isAuthed  = useAuthStore((s) => s.isAuthenticated())
  const expiresAt = useAuthStore((s) => s.expiresAt)
  const logout    = useAuthStore((s) => s.logout)

  // AUTH-2 #446: remember-me. Нет живого access-токена → ОДНА тихая
  // попытка обменять httpOnly refresh-куку на свежий JWT, и только при
  // неудаче — /login. Это и есть «пользователь заходит без пароля».
  const [restoring, setRestoring] = useState(() => !isAuthed)
  useEffect(() => {
    if (isAuthed) { setRestoring(false); return }
    let alive = true
    tryRefreshToken().finally(() => { if (alive) setRestoring(false) })
    return () => { alive = false }
  }, [isAuthed])

  // R11-L3 (+AUTH-2): истечение JWT в фоне — сперва тихий refresh по
  // куке; logout только если кука мертва. Сервер остаётся границей.
  useEffect(() => {
    if (!expiresAt) return
    const ms = Math.max(0, expiresAt - Date.now())
    const t = setTimeout(() => {
      void tryRefreshToken().then((fresh) => { if (!fresh) logout() })
    }, ms)
    return () => clearTimeout(t)
  }, [expiresAt, logout])

  if (restoring) return <SuspenseFallback />
  if (!isAuthed) return <Navigate to="/login" replace />
  return children
}

function SuspenseFallback() {
  // PJAX loader at the top of viewport speaks for "fetching chunk".
  // Empty spacer preserves layout height so the page doesn't snap.
  return <div className="h-64" aria-hidden="true" />
}

// ── MIGR-1 (#424): сервис-поддомены news.<домен> / help.<домен> ──────────
// Решение владельца 2026-07-17: «Новости» и «База знаний» живут на своих
// поддоменах. Тот же бандл, раздел выбирается по hostname: на news.* /
// help.* раздел рендерится ОТ КОРНЯ (basePath=''), любой чужой путь
// уезжает full-reload'ом на основной домен (пути кабинета/лендинга на
// поддомене не существуют). На основном домене поведение прежнее.

function ToMainDomain() {
  useEffect(() => {
    window.location.replace(MAIN_ORIGIN + window.location.pathname + window.location.search)
  }, [])
  return <SuspenseFallback />
}

function SectionHostApp({ section }: { section: 'news' | 'help' }) {
  return (
    <>
      <PjaxLoader />
      <Routes>
        {section === 'news' ? (
          <>
            <Route path="/" element={
              <Suspense fallback={<SuspenseFallback />}><NewsPage basePath="" /></Suspense>
            } />
            <Route path="/:slug" element={
              <Suspense fallback={<SuspenseFallback />}><NewsPostPage basePath="" /></Suspense>
            } />
          </>
        ) : (
          <>
            <Route path="/" element={
              <Suspense fallback={<SuspenseFallback />}><HelpPage basePath="" /></Suspense>
            } />
            <Route path="/a/:artSlug" element={
              <Suspense fallback={<SuspenseFallback />}><HelpArticlePage basePath="" /></Suspense>
            } />
            <Route path="/:catSlug" element={
              <Suspense fallback={<SuspenseFallback />}><HelpCategoryPage basePath="" /></Suspense>
            } />
          </>
        )}
        <Route path="*" element={<ToMainDomain />} />
      </Routes>
    </>
  )
}

export default function App() {
  if (SECTION_HOST) return <SectionHostApp section={SECTION_HOST} />
  return (
    <>
      {/* GitHub-style pjax progress bar — fixed-top, brand-500.
          Listens to route changes + react-query in-flight state. */}
      <PjaxLoader />
      <Routes>
        <Route path="/login" element={<LoginPage />} />
      <Route path="/login/admin" element={<AdminLoginPage />} />
      <Route
        path="/signup"
        element={
          <Suspense fallback={<SuspenseFallback />}>
            <SignupPage />
          </Suspense>
        }
      />
      <Route
        path="/signup/verify"
        element={
          <Suspense fallback={<SuspenseFallback />}>
            <SignupVerifyPage />
          </Suspense>
        }
      />
      <Route
        path="/forgot"
        element={
          <Suspense fallback={<SuspenseFallback />}>
            <ForgotPasswordPage />
          </Suspense>
        }
      />
      <Route
        path="/auth/reset"
        element={
          <Suspense fallback={<SuspenseFallback />}>
            <ResetPasswordPage />
          </Suspense>
        }
      />
      <Route
        path="/oauth/return"
        element={
          <Suspense fallback={<SuspenseFallback />}>
            <OAuthReturnPage />
          </Suspense>
        }
      />
      <Route
        path="/plans"
        element={
          <Suspense fallback={<SuspenseFallback />}>
            <PlansPage />
          </Suspense>
        }
      />
      {/* Onboarding: полноэкранный wizard, требует auth но не AppLayout */}
      <Route
        path="/welcome"
        element={
          <ProtectedRoute>
            <Suspense fallback={<SuspenseFallback />}>
              <OnboardingPage />
            </Suspense>
          </ProtectedRoute>
        }
      />

      {/* Public legal — admin-editable via /admin/legal (LEG-1 #427: + terms) */}
      <Route
        path="/terms"
        element={
          <Suspense fallback={<SuspenseFallback />}>
            <LegalDocPage docId="terms" />
          </Suspense>
        }
      />
      <Route
        path="/consent"
        element={
          <Suspense fallback={<SuspenseFallback />}>
            <LegalDocPage docId="consent" />
          </Suspense>
        }
      />
      <Route
        path="/pdn-policy"
        element={
          <Suspense fallback={<SuspenseFallback />}>
            <LegalDocPage docId="pdn" />
          </Suspense>
        }
      />
      <Route
        path="/requisites"
        element={
          <Suspense fallback={<SuspenseFallback />}>
            <LegalDocPage docId="requisites" />
          </Suspense>
        }
      />
      <Route
        path="/privacy"
        element={
          <Suspense fallback={<SuspenseFallback />}>
            <LegalDocPage docId="privacy" />
          </Suspense>
        }
      />
      {/* NEWS-7 (#409): публичные новости — видны без логина */}
      <Route path="/news" element={
        <Suspense fallback={<SuspenseFallback />}><NewsPage /></Suspense>
      } />
      <Route path="/news/:slug" element={
        <Suspense fallback={<SuspenseFallback />}><NewsPostPage /></Suspense>
      } />

      {/* HC-4 (#410): публичная база знаний — видна без логина.
          Статья канонично /help/a/{slug} — не пересекается с категориями. */}
      <Route path="/help" element={
        <Suspense fallback={<SuspenseFallback />}><HelpPage /></Suspense>
      } />
      <Route path="/help/a/:artSlug" element={
        <Suspense fallback={<SuspenseFallback />}><HelpArticlePage /></Suspense>
      } />
      <Route path="/help/:catSlug" element={
        <Suspense fallback={<SuspenseFallback />}><HelpCategoryPage /></Suspense>
      } />

      {/* Public landing — / показывает лендинг и неавторизованным, и
          авторизованным (для последних шапка ведёт в /app). */}
      <Route path="/" element={<LandingPage />} />

      {/* Authenticated app под /app/* — перенесён с / на /app, чтобы
          корень мог быть публичным. */}
      <Route
        path="/app"
        element={
          <ProtectedRoute>
            <AppLayout />
          </ProtectedRoute>
        }
      >
        <Route
          index
          element={
            <Suspense fallback={<SuspenseFallback />}>
              <DashboardPage />
            </Suspense>
          }
        />
        <Route
          path="uploads"
          element={
            <Suspense fallback={<SuspenseFallback />}>
              <UploadsPage />
            </Suspense>
          }
        />
        {/* «Данные» group (epic #320): prepare (DP-5 #32) + enrich (placeholder). */}
        <Route
          path="data/prepare"
          element={
            <Suspense fallback={<SuspenseFallback />}>
              <DataPreparePage />
            </Suspense>
          }
        />
        <Route
          path="data/enrich"
          element={
            <DataSectionPlaceholder
              title="Обогащение данных"
              body="Скоро: обогащение ваших данных дополнительными и производными признаками для более точного прогноза. Состав раздела обсудим отдельно."
            />
          }
        />
        <Route
          path="training"
          element={
            <Suspense fallback={<SuspenseFallback />}>
              <TrainingPage />
            </Suspense>
          }
        />
        <Route
          path="training/history"
          element={
            <Suspense fallback={<SuspenseFallback />}>
              <TrainingHistoryPage />
            </Suspense>
          }
        />
        <Route
          path="forecasts"
          element={
            <Suspense fallback={<SuspenseFallback />}>
              <ForecastsPage />
            </Suspense>
          }
        />
        <Route
          path="orders"
          element={
            <Suspense fallback={<SuspenseFallback />}>
              <OrdersPage />
            </Suspense>
          }
        />
        <Route
          path="news/*"
          element={
            <Suspense fallback={<SuspenseFallback />}>
              <NewsClientPage />
            </Suspense>
          }
        />
        <Route
          path="help/*"
          element={
            <Suspense fallback={<SuspenseFallback />}>
              <HelpClientPage />
            </Suspense>
          }
        />
        <Route
          path="scenarios"
          element={
            <Suspense fallback={<SuspenseFallback />}>
              <ScenariosPage />
            </Suspense>
          }
        />
        <Route
          path="promo"
          element={
            <Suspense fallback={<SuspenseFallback />}>
              <PromoPage />
            </Suspense>
          }
        />
        <Route
          path="settings"
          element={
            <Suspense fallback={<SuspenseFallback />}>
              <SettingsPage />
            </Suspense>
          }
        />
        <Route
          path="upgrade"
          element={
            <Suspense fallback={<SuspenseFallback />}>
              <UpgradePage />
            </Suspense>
          }
        />
        {/* AC-1 (#312): Account Center — secondary left-nav inside AppLayout.
            Sections fill in via AC-2/3/4; empty ones show a placeholder. */}
        <Route
          path="account"
          element={
            <Suspense fallback={<SuspenseFallback />}>
              <AccountPage />
            </Suspense>
          }
        >
          <Route index element={<Navigate to="profile" replace />} />
          <Route path="profile"       element={<Suspense fallback={<SuspenseFallback />}><AccountProfile /></Suspense>} />
          <Route path="security"      element={<Suspense fallback={<SuspenseFallback />}><AccountSecurity /></Suspense>} />
          <Route path="subscription"  element={<AccountSectionPlaceholder />} />
          <Route path="notifications" element={<AccountSectionPlaceholder />} />
          <Route path="data"          element={<Suspense fallback={<SuspenseFallback />}><AccountData /></Suspense>} />
        </Route>
      </Route>

      {/* ADM-0 (#276): выделенная админ-консоль — свой shell, никакого
          клиентского кабинета. AdminGuard на уровне layout'а. */}
      <Route
        path="/admin"
        element={
          <ProtectedRoute>
            <AdminGuard>
              <Suspense fallback={<SuspenseFallback />}>
                <AdminLayout />
              </Suspense>
            </AdminGuard>
          </ProtectedRoute>
        }
      >
        <Route index element={
          <Suspense fallback={<SuspenseFallback />}><AdminHomePage /></Suspense>
        } />
        <Route path="clients" element={
          <Suspense fallback={<SuspenseFallback />}><AdminClientsPage /></Suspense>
        } />
        <Route path="clients/new" element={
          <Suspense fallback={<SuspenseFallback />}><AdminClientsPage /></Suspense>
        } />
        <Route path="clients/:clientId" element={
          <Suspense fallback={<SuspenseFallback />}><AdminClientCardPage /></Suspense>
        } />
        <Route path="plans" element={
          <Suspense fallback={<SuspenseFallback />}><AdminPlansPage /></Suspense>
        } />
        <Route path="training" element={
          <Suspense fallback={<SuspenseFallback />}><AdminTrainingPage /></Suspense>
        } />
        <Route path="notifications" element={
          <Suspense fallback={<SuspenseFallback />}><AdminNotificationsPage /></Suspense>
        } />
        <Route path="news" element={
          <Suspense fallback={<SuspenseFallback />}><AdminNewsPage /></Suspense>
        } />
        <Route path="news/new" element={
          <Suspense fallback={<SuspenseFallback />}><AdminNewsEditorPage /></Suspense>
        } />
        <Route path="news/:postId" element={
          <Suspense fallback={<SuspenseFallback />}><AdminNewsEditorPage /></Suspense>
        } />
        <Route path="help" element={
          <Suspense fallback={<SuspenseFallback />}><AdminHelpPage /></Suspense>
        } />
        <Route path="help/new" element={
          <Suspense fallback={<SuspenseFallback />}><AdminHelpEditorPage /></Suspense>
        } />
        <Route path="help/:articleId" element={
          <Suspense fallback={<SuspenseFallback />}><AdminHelpEditorPage /></Suspense>
        } />
        <Route path="legal" element={
          <Suspense fallback={<SuspenseFallback />}><AdminLegalPage /></Suspense>
        } />
        <Route path="legal/:docId" element={
          <Suspense fallback={<SuspenseFallback />}><AdminLegalPage /></Suspense>
        } />
        <Route path="system" element={
          <Suspense fallback={<SuspenseFallback />}><AdminSystemPage /></Suspense>
        } />
        <Route path="audit" element={
          <Suspense fallback={<SuspenseFallback />}><AdminAuditPage /></Suspense>
        } />
        <Route path="security" element={
          <Suspense fallback={<SuspenseFallback />}><AdminSecurityPage /></Suspense>
        } />
        <Route path="data" element={
          <Suspense fallback={<SuspenseFallback />}><AdminDataPage /></Suspense>
        } />
      </Route>

      {/* /app/admin/* → выделенная консоль (ADM-0) */}
      <Route path="/app/admin/clients"       element={<Navigate to="/admin/clients"       replace />} />
      <Route path="/app/admin/legal"         element={<Navigate to="/admin/legal"         replace />} />
      <Route path="/app/admin/notifications" element={<Navigate to="/admin/notifications" replace />} />

      {/* Старые ссылки вида /uploads, /forecasts и т.п. редиректим на /app/* */}
      <Route path="/uploads"        element={<Navigate to="/app/uploads"        replace />} />
      <Route path="/training"       element={<Navigate to="/app/training"       replace />} />
      <Route path="/forecasts"      element={<Navigate to="/app/forecasts"      replace />} />
      <Route path="/scenarios"      element={<Navigate to="/app/scenarios"      replace />} />
      <Route path="/promo"          element={<Navigate to="/app/promo"          replace />} />
      <Route path="/settings"       element={<Navigate to="/app/settings"       replace />} />

      <Route path="*" element={<Navigate to="/" replace />} />
      </Routes>
    </>
  )
}
