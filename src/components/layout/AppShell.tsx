import { useState } from "react";
import { Outlet, useNavigate } from "react-router-dom";
import { Loader2, LogOut, Moon, Sun } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Sidebar } from "@/components/layout/Sidebar";
import { RoleBadge } from "@/components/shared/RoleBadge";
import { DotPattern } from "@/components/ui/magicui/dot-pattern";
import { useTheme } from "@/lib/theme-provider";
import { useAuthStore } from "@/stores/authStore";

export function AppShell() {
  const user = useAuthStore((s) => s.user);
  const signOut = useAuthStore((s) => s.signOut);
  const navigate = useNavigate();
  const { theme, toggleTheme } = useTheme();
  const [signingOut, setSigningOut] = useState(false);

  const handleSignOut = async () => {
    if (signingOut) return;
    setSigningOut(true);
    await signOut();
    navigate("/login", { replace: true });
  };

  return (
    <div className="min-h-screen flex bg-background">
      <Sidebar />
      <div className="flex-1 flex flex-col">
        <header className="h-14 border-b border-border bg-card flex items-center justify-between px-6">
          <div className="text-sm text-muted-foreground">
            {user?.full_name || user?.email}
          </div>
          <div className="flex items-center gap-3">
            {user && <RoleBadge role={user.role} />}
            <Button
              variant="ghost"
              size="sm"
              onClick={toggleTheme}
              aria-label={theme === "dark" ? "Switch to light mode" : "Switch to dark mode"}
            >
              {theme === "dark" ? (
                <Sun className="h-4 w-4" />
              ) : (
                <Moon className="h-4 w-4" />
              )}
            </Button>
            <Button
              variant="ghost"
              size="sm"
              onClick={handleSignOut}
              disabled={signingOut}
            >
              {signingOut ? (
                <Loader2 className="h-4 w-4 mr-1 animate-spin" />
              ) : (
                <LogOut className="h-4 w-4 mr-1" />
              )}
              {signingOut ? "Signing out…" : "Sign out"}
            </Button>
          </div>
        </header>
        <main className="relative flex-1 overflow-auto">
          <DotPattern className="text-foreground/[0.06] [mask-image:radial-gradient(ellipse_at_center,white,transparent_75%)]" />
          <div className="relative p-6">
            <Outlet />
          </div>
        </main>
      </div>
    </div>
  );
}
