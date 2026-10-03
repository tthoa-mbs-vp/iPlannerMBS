import { lazy, Suspense, useEffect, useRef } from "react";
import { Routes, Route, Navigate, useSearchParams } from "react-router-dom";
import { useAuthStore } from "./stores/authStore";
import ProtectedRoute from "./components/layout/ProtectedRoute";
import AppLayout from "./components/layout/AppLayout";
import ToastContainer from "./components/shared/Toast";
import ErrorBoundary from "./components/shared/ErrorBoundary";
import { useRealtimeNotifications } from "./hooks/useRealtimeNotifications";
import { isMobileDevice } from "./utils/device";

const LoginPage = lazy(() => import("./pages/LoginPage"));
const DashboardPage = lazy(() => import("./pages/DashboardPage"));
const MyDayPage = lazy(() => import("./pages/MyDayPage"));
const PlansPage = lazy(() => import("./pages/PlansPage"));
const PlanDetailPage = lazy(() => import("./pages/PlanDetailPage"));
const TaskDetailPage = lazy(() => import("./pages/TaskDetailPage"));
const MLayout = lazy(() => import("./pages/mobile/MLayout"));
const MDashboardPage = lazy(() => import("./pages/mobile/MDashboardPage"));
const MTasksPage = lazy(() => import("./pages/mobile/MTasksPage"));
const MProfilePage = lazy(() => import("./pages/mobile/MProfilePage"));
const MNotificationsPage = lazy(() => import("./pages/mobile/MNotificationsPage"));
const MKpiPage = lazy(() => import("./pages/mobile/MKpiPage"));
const ReportsPage = lazy(() => import("./pages/ReportsPage"));
const KpiPage = lazy(() => import("./pages/KpiPage"));
const TrashPage = lazy(() => import("./pages/TrashPage"));
const AdminPage = lazy(() => import("./pages/AdminPage"));
const LogsPage = lazy(() => import("./pages/LogsPage"));
const DataPage = lazy(() => import("./pages/DataPage"));
const ProfileRedirect = lazy(() => import("./pages/ProfileRedirect"));
const NotificationsPage = lazy(() => import("./pages/NotificationsPage"));


function PageLoader() {
  return (
    <div className="flex h-full items-center justify-center">
      <div className="h-8 w-8 animate-spin rounded-full border-4 border-blue-600 border-t-transparent" />
    </div>
  );
}

function useEffectiveMobile(): boolean {
  const [searchParams] = useSearchParams();
  const forced = searchParams.get("device");
  if (forced === "mobile") return true;
  if (forced === "desktop") return false;
  return isMobileDevice();
}

function HomeRedirect() {
  return <Navigate to={isMobileDevice() ? "/m" : "/dashboard"} replace />;
}

function DesktopGate({ children }: { children: React.ReactNode }) {
  const isMobile = useEffectiveMobile();
  if (isMobile) return <Navigate to="/m" replace />;
  return <>{children}</>;
}

function MobileGate({ children }: { children: React.ReactNode }) {
  const isMobile = useEffectiveMobile();
  if (!isMobile) return <Navigate to="/dashboard" replace />;
  return <>{children}</>;
}

export default function App() {
  const checkAuth = useAuthStore((s) => s.checkAuth);
  const isLoading = useAuthStore((s) => s.isLoading);
  const checked = useRef(false);
  useRealtimeNotifications();

  useEffect(() => {
    if (checked.current) return;
    checked.current = true;
    checkAuth();
  }, [checkAuth]);

  if (isLoading) {
    return (
      <div className="flex h-screen items-center justify-center">
        <div className="h-8 w-8 animate-spin rounded-full border-4 border-blue-600 border-t-transparent" />
      </div>
    );
  }

  return (
    <ErrorBoundary>
      <Suspense fallback={<PageLoader />}>
        <Routes>
          <Route path="/" element={<HomeRedirect />} />
          <Route path="/login" element={<LoginPage />} />
          <Route
            element={
              <ProtectedRoute>
                <DesktopGate>
                  <AppLayout />
                </DesktopGate>
              </ProtectedRoute>
            }
          >
            <Route path="/dashboard" element={<DashboardPage />} />
            <Route path="/my-day" element={<MyDayPage />} />
            <Route path="/plans" element={<PlansPage />} />
            <Route path="/plans/:id" element={<PlanDetailPage />} />
            <Route path="/tasks" element={<Navigate to="/plans" replace />} />
            <Route path="/tasks/:id" element={<TaskDetailPage />} />
            <Route path="/reports" element={<ReportsPage />} />
            <Route path="/kpi" element={<KpiPage />} />
            <Route path="/profile" element={<ProfileRedirect />} />
            <Route path="/notifications" element={<NotificationsPage />} />

            <Route path="/trash" element={<TrashPage />} />
            <Route path="/admin" element={<AdminPage />} />
            <Route path="/admin/logs" element={<LogsPage />} />
            <Route path="/admin/data" element={<DataPage />} />
          </Route>
          <Route
            element={
              <ProtectedRoute>
                <MobileGate>
                  <MLayout />
                </MobileGate>
              </ProtectedRoute>
            }
          >
            <Route path="/m" element={<MDashboardPage />} />
            <Route path="/m/notifications" element={<MNotificationsPage />} />
            <Route path="/m/tasks" element={<MTasksPage />} />
            <Route path="/m/kpi" element={<MKpiPage />} />
            <Route path="/m/profile" element={<MProfilePage />} />
          </Route>
          <Route path="*" element={<HomeRedirect />} />
        </Routes>
        <ToastContainer />
      </Suspense>
    </ErrorBoundary>
  );
}
