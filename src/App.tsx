import { useEffect } from "react";
import { BrowserRouter, Navigate, Route, Routes } from "react-router-dom";
import { Toaster } from "@/components/ui/toaster";
import { ProtectedRoute } from "@/components/layout/ProtectedRoute";
import { AppShell } from "@/components/layout/AppShell";
import { SplashScreen } from "@/components/layout/SplashScreen";
import { useAuthStore } from "@/stores/authStore";
import LoginPage from "@/pages/auth/LoginPage";
import AuthCallbackPage from "@/pages/auth/AuthCallbackPage";
import EmployeeDashboard from "@/pages/employee/EmployeeDashboard";
import NewGoalSheetPage from "@/pages/employee/NewGoalSheetPage";
import GoalSheetPage from "@/pages/employee/GoalSheetPage";
import CheckInsPage from "@/pages/employee/CheckInsPage";
import ManagerDashboard from "@/pages/manager/ManagerDashboard";
import ReviewGoalSheet from "@/pages/manager/ReviewGoalSheet";
import ManagerCheckInsPage from "@/pages/manager/ManagerCheckInsPage";
import AdminDashboard from "@/pages/admin/AdminDashboard";
import SharedGoalsPage from "@/pages/admin/SharedGoalsPage";
import UsersPage from "@/pages/admin/UsersPage";
import ReportsPage from "@/pages/admin/ReportsPage";
import AnalyticsPage from "@/pages/admin/AnalyticsPage";
import EscalationsPage from "@/pages/admin/EscalationsPage";
import NotFoundPage from "@/pages/NotFoundPage";
import type { UserRole } from "@/types";

const ROLE_HOME: Record<UserRole, string> = {
  EMPLOYEE: "/employee/dashboard",
  MANAGER: "/manager/dashboard",
  ADMIN: "/admin/dashboard",
};

function RootRedirect() {
  const user = useAuthStore((s) => s.user);
  return <Navigate to={user ? ROLE_HOME[user.role] : "/login"} replace />;
}

export default function App() {
  const initialized = useAuthStore((s) => s.initialized);
  const init = useAuthStore((s) => s.init);

  useEffect(() => {
    void init();
  }, [init]);

  if (!initialized) {
    return <SplashScreen />;
  }

  return (
    <BrowserRouter>
      <Routes>
        <Route path="/" element={<RootRedirect />} />
        <Route path="/login" element={<LoginPage />} />
        <Route path="/auth/callback" element={<AuthCallbackPage />} />

        {/* Employee */}
        <Route element={<ProtectedRoute allowedRoles={["EMPLOYEE"]} />}>
          <Route element={<AppShell />}>
            <Route path="/employee/dashboard" element={<EmployeeDashboard />} />
            <Route path="/employee/goals" element={<GoalSheetPage />} />
            <Route path="/employee/goals/new" element={<NewGoalSheetPage />} />
            <Route path="/employee/checkins" element={<CheckInsPage />} />
          </Route>
        </Route>

        {/* Manager */}
        <Route element={<ProtectedRoute allowedRoles={["MANAGER"]} />}>
          <Route element={<AppShell />}>
            <Route path="/manager/dashboard" element={<ManagerDashboard />} />
            <Route path="/manager/review/:sheetId" element={<ReviewGoalSheet />} />
            <Route path="/manager/checkins" element={<ManagerCheckInsPage />} />
          </Route>
        </Route>

        {/* Admin */}
        <Route element={<ProtectedRoute allowedRoles={["ADMIN"]} />}>
          <Route element={<AppShell />}>
            <Route path="/admin/dashboard" element={<AdminDashboard />} />
            <Route path="/admin/shared-goals" element={<SharedGoalsPage />} />
            <Route path="/admin/users" element={<UsersPage />} />
            <Route path="/admin/reports" element={<ReportsPage />} />
            <Route path="/admin/analytics" element={<AnalyticsPage />} />
            <Route path="/admin/escalations" element={<EscalationsPage />} />
          </Route>
        </Route>

        <Route path="*" element={<NotFoundPage />} />
      </Routes>
      <Toaster />
    </BrowserRouter>
  );
}
