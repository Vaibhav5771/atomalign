import { Navigate, Outlet, useLocation } from "react-router-dom";
import { useAuthStore } from "@/stores/authStore";
import type { UserRole } from "@/types";

interface Props {
  allowedRoles?: UserRole[];
}

const ROLE_HOME: Record<UserRole, string> = {
  EMPLOYEE: "/employee/dashboard",
  MANAGER: "/manager/dashboard",
  ADMIN: "/admin/dashboard",
};

export function ProtectedRoute({ allowedRoles }: Props) {
  const user = useAuthStore((s) => s.user);
  const session = useAuthStore((s) => s.session);
  const location = useLocation();

  // Auth bootstrap is done at App level, so by the time we render here
  // `user`/`session` reflect the resolved state — no in-flight loading flash.

  if (!session || !user) {
    return <Navigate to="/login" replace state={{ from: location }} />;
  }

  if (allowedRoles && !allowedRoles.includes(user.role)) {
    return <Navigate to={ROLE_HOME[user.role]} replace />;
  }

  return <Outlet />;
}
