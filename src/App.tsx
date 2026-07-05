import { Navigate, Route, Routes } from 'react-router-dom'
import { lazy, Suspense, useEffect } from 'react'

import { useAuthStore } from './features/auth/store'
import AppLayout from './components/AppLayout'
import AdminGuard from './components/AdminGuard'
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
const TrainingPage      = lazy(() => import('./pages/client/TrainingPage'))
const TrainingHistoryPage = lazy(() => import('./pages/client/TrainingHistoryPage'))
const SettingsPage      = lazy(() => import('./pages/client/SettingsPage'))
const UploadsPage       = lazy(() => import('./pages/client/UploadsPage'))
const PlansPage         = lazy(() => import('./pages/PlansPage'))
const OnboardingPage    = lazy(() => import('./pages/OnboardingPage'))
const SignupPage        = lazy(() => import('./pages/SignupPage'))
const SignupVerifyPage  = lazy(() => import('./pages/SignupVerifyPage'))
const OAuthReturnPage   = lazy(() => import('./pages/OAuthReturnPage'))
const AdminClientsPage  = lazy(() => import('./pages/admin/AdminClientsPage'))
const AdminLegalPage    = lazy(() => import('./pages/admin/AdminLegalPage'))
const AdminNotificationsPage = lazy(() => import('./pages/admin/AdminNotificationsPage'))
const AdminHomePage = lazy(() => import('./pages/admin/AdminHomePage'))
const AdminPlansPage = lazy(() => import('./pages/admin/AdminPlansPage'))
const AdminClientCardPage = lazy(() => import('./pages/admin/AdminClientCardPage'))
const AdminClientNewPage = lazy(() => import('./pages/admin/AdminClientNewPage'))
const AdminLayout = lazy(() => import('./components/AdminLayout'))
const PrivacyPage       = lazy(() => import('./pages/PrivacyPage'))

function ProtectedRoute({ children }: { children: JSX.Element }) {
  const isAuthed  = useAuthStore((s) => s.isAuthenticated())
  const expiresAt = useAuthStore((s) => s.expiresAt)
  const logout    = useAuthStore((s) => s.logout)

  // R11-L3: react to time-based JWT expiry on an IDLE tab. isAuthenticated()
  // is only evaluated on render, so without this an idle tab keeps showing
  // authed chrome until the next nav / API 401. Schedule a logout exactly
  // when the token expires → the store update re-renders this guard → it
  // bounces to /login. (The server 401 remains the real boundary; this is
  // a client-side UX correctness fix.)
  useEffect(() => {
    if (!expiresAt) return
    const ms = expiresAt - Date.now()
    if (ms <= 0) { logout(); return }
    const t = setTimeout(() => logout(), ms)
    return () => clearTimeout(t)
  }, [expiresAt, logout])

  if (!isAuthed) return <Navigate to="/login" replace />
  return children
}

function SuspenseFallback() {
  // PJAX loader at the top of viewport speaks for "fetching chunk".
  // Empty spacer preserves layout height so the page doesn't snap.
  return <div className="h-64" aria-hidden="true" />
}

export default function App() {
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

      {/* Public legal — privacy policy (admin-editable via /admin/legal) */}
      <Route
        path="/privacy"
        element={
          <Suspense fallback={<SuspenseFallback />}>
            <PrivacyPage />
          </Suspense>
        }
      />

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
          <Suspense fallback={<SuspenseFallback />}><AdminClientNewPage /></Suspense>
        } />
        <Route path="clients/:clientId" element={
          <Suspense fallback={<SuspenseFallback />}><AdminClientCardPage /></Suspense>
        } />
        <Route path="plans" element={
          <Suspense fallback={<SuspenseFallback />}><AdminPlansPage /></Suspense>
        } />
        <Route path="notifications" element={
          <Suspense fallback={<SuspenseFallback />}><AdminNotificationsPage /></Suspense>
        } />
        <Route path="legal" element={
          <Suspense fallback={<SuspenseFallback />}><AdminLegalPage /></Suspense>
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
