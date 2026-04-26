import { Navigate, Route, Routes } from 'react-router-dom'
import { lazy, Suspense } from 'react'

import { useAuthStore } from './features/auth/store'
import AppLayout from './components/AppLayout'
import AdminGuard from './components/AdminGuard'
import LoginPage from './pages/LoginPage'

// Code-split client pages — keeps the initial bundle small (login first).
const DashboardPage     = lazy(() => import('./pages/client/DashboardPage'))
const ScenariosPage     = lazy(() => import('./pages/client/ScenariosPage'))
const PromoPage         = lazy(() => import('./pages/client/PromoPage'))
const ForecastsPage     = lazy(() => import('./pages/client/ForecastsPage'))
const TrainingPage      = lazy(() => import('./pages/client/TrainingPage'))
const SettingsPage      = lazy(() => import('./pages/client/SettingsPage'))
const UploadsPage       = lazy(() => import('./pages/client/UploadsPage'))
const PlansPage         = lazy(() => import('./pages/PlansPage'))
const OnboardingPage    = lazy(() => import('./pages/OnboardingPage'))
const SignupPage        = lazy(() => import('./pages/SignupPage'))
const SignupVerifyPage  = lazy(() => import('./pages/SignupVerifyPage'))
const OAuthReturnPage   = lazy(() => import('./pages/OAuthReturnPage'))
const AdminClientsPage  = lazy(() => import('./pages/admin/AdminClientsPage'))

function ProtectedRoute({ children }: { children: JSX.Element }) {
  const isAuthed = useAuthStore((s) => s.isAuthenticated())
  if (!isAuthed) return <Navigate to="/login" replace />
  return children
}

function SuspenseFallback() {
  return (
    <div className="flex h-64 items-center justify-center text-ink-muted">
      Загрузка…
    </div>
  )
}

export default function App() {
  return (
    <Routes>
      <Route path="/login" element={<LoginPage />} />
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

      <Route
        path="/"
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
          path="admin/clients"
          element={
            <AdminGuard>
              <Suspense fallback={<SuspenseFallback />}>
                <AdminClientsPage />
              </Suspense>
            </AdminGuard>
          }
        />
      </Route>

      <Route path="*" element={<Navigate to="/" replace />} />
    </Routes>
  )
}
