import { Navigate } from "react-router-dom";
import { useAuthStore } from "@/stores/authStore";
import { SplashScreen } from "@/components/layout/SplashScreen";
import type { UserRole } from "@/types";

const ROLE_HOME: Record<UserRole, string> = {
  EMPLOYEE: "/employee/dashboard",
  MANAGER: "/manager/dashboard",
  ADMIN: "/admin/dashboard",
};

// Landing page after Microsoft / Entra ID redirect.
// Supabase consumes the URL hash (detectSessionInUrl: true) and fires the
// SIGNED_IN event. authStore's listener then runs the Graph sync (setting
// `syncing = true`) and re-fetches the profile. We just wait it out.
export default function AuthCallbackPage() {
  const user = useAuthStore((s) => s.user);
  const syncing = useAuthStore((s) => s.syncing);
  const initialized = useAuthStore((s) => s.initialized);

  if (!initialized || syncing || !user) {
    return <SplashScreen label="Setting up your account…" />;
  }

  return <Navigate to={ROLE_HOME[user.role]} replace />;
}
