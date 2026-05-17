import { useEffect, useState } from "react";
import { Link, Navigate } from "react-router-dom";
import { useAuthStore } from "@/stores/authStore";
import { SplashScreen } from "@/components/layout/SplashScreen";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
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
//
// If the sign-in fails (most commonly: migration 0009's `handle_new_user`
// trigger rejects an azure provider for an email not pre-registered by an
// admin via the Create Team wizard), Supabase puts `error=…` /
// `error_description=…` in the URL hash. We pull those out and render a
// friendly card with a "Back to login" link instead of leaving the user
// stuck on the splash screen forever.
function readHashError(): string | null {
  if (typeof window === "undefined") return null;
  const hash = window.location.hash.startsWith("#")
    ? window.location.hash.slice(1)
    : window.location.hash;
  if (!hash) return null;
  const params = new URLSearchParams(hash);
  const description = params.get("error_description");
  if (description) return description.replace(/\+/g, " ");
  const error = params.get("error");
  return error || null;
}

export default function AuthCallbackPage() {
  const user = useAuthStore((s) => s.user);
  const syncing = useAuthStore((s) => s.syncing);
  const initialized = useAuthStore((s) => s.initialized);
  const [hashError] = useState<string | null>(() => readHashError());

  // Clear the hash so a refresh doesn't reshow the error.
  useEffect(() => {
    if (hashError && typeof window !== "undefined") {
      try {
        window.history.replaceState(
          null,
          "",
          window.location.pathname + window.location.search,
        );
      } catch {
        /* noop */
      }
    }
  }, [hashError]);

  if (hashError) {
    const isRestriction = /restricted|admin|pre-registered/i.test(hashError);
    return (
      <div className="min-h-screen flex items-center justify-center p-4 bg-muted/30">
        <Card className="max-w-md w-full">
          <CardHeader>
            <CardTitle className="text-base">
              {isRestriction
                ? "Microsoft sign-in is restricted"
                : "Sign-in failed"}
            </CardTitle>
            <CardDescription>{hashError}</CardDescription>
          </CardHeader>
          <CardContent className="space-y-3">
            {isRestriction && (
              <p className="text-sm text-muted-foreground">
                Ask an admin to add your email via the Create Team wizard on
                <code className="mx-1 px-1 py-0.5 bg-muted rounded text-xs">
                  /admin/users
                </code>
                , then try again.
              </p>
            )}
            <Button asChild>
              <Link to="/login">Back to login</Link>
            </Button>
          </CardContent>
        </Card>
      </div>
    );
  }

  if (!initialized || syncing || !user) {
    return <SplashScreen label="Setting up your account…" />;
  }

  return <Navigate to={ROLE_HOME[user.role]} replace />;
}
