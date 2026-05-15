import { BrowserRouter, Navigate, Route, Routes } from "react-router-dom";
import { Toaster } from "@/components/ui/toaster";
import { ProtectedRoute } from "@/components/layout/ProtectedRoute";
import { AppShell } from "@/components/layout/AppShell";
import LoginPage from "@/pages/auth/LoginPage";
import EmployeeDashboard from "@/pages/employee/EmployeeDashboard";
import NewGoalSheetPage from "@/pages/employee/NewGoalSheetPage";
import GoalSheetPage from "@/pages/employee/GoalSheetPage";
import ManagerDashboard from "@/pages/manager/ManagerDashboard";
import ReviewGoalSheet from "@/pages/manager/ReviewGoalSheet";
import AdminDashboard from "@/pages/admin/AdminDashboard";
import SharedGoalsPage from "@/pages/admin/SharedGoalsPage";
import NotFoundPage from "@/pages/NotFoundPage";

export default function App() {
  return (
    <BrowserRouter>
      <Routes>
        <Route path="/" element={<Navigate to="/login" replace />} />
        <Route path="/login" element={<LoginPage />} />

        {/* Employee */}
        <Route element={<ProtectedRoute allowedRoles={["EMPLOYEE"]} />}>
          <Route element={<AppShell />}>
            <Route path="/employee/dashboard" element={<EmployeeDashboard />} />
            <Route path="/employee/goals" element={<GoalSheetPage />} />
            <Route path="/employee/goals/new" element={<NewGoalSheetPage />} />
          </Route>
        </Route>

        {/* Manager */}
        <Route element={<ProtectedRoute allowedRoles={["MANAGER"]} />}>
          <Route element={<AppShell />}>
            <Route path="/manager/dashboard" element={<ManagerDashboard />} />
            <Route path="/manager/review/:sheetId" element={<ReviewGoalSheet />} />
          </Route>
        </Route>

        {/* Admin */}
        <Route element={<ProtectedRoute allowedRoles={["ADMIN"]} />}>
          <Route element={<AppShell />}>
            <Route path="/admin/dashboard" element={<AdminDashboard />} />
            <Route path="/admin/shared-goals" element={<SharedGoalsPage />} />
          </Route>
        </Route>

        <Route path="*" element={<NotFoundPage />} />
      </Routes>
      <Toaster />
    </BrowserRouter>
  );
}
