import { Outlet } from "react-router-dom";
import { Sidebar } from "@/components/layout/Sidebar";
import { Mascot } from "@/components/layout/Mascot";
import { ThemeToggle } from "@/components/layout/ThemeToggle";
import { RoleBadge } from "@/components/shared/RoleBadge";
import { DotPattern } from "@/components/ui/magicui/dot-pattern";
import { AvatarBeam } from "@/components/ui/magicui/avatar-beam";
import { BlurFade } from "@/components/ui/magicui/blur-fade";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { useAuthStore } from "@/stores/authStore";

function getEmailInitials(email: string): string {
  const local = email.split("@")[0] ?? email;
  const parts = local.split(/[._\-+]+/).filter(Boolean);
  if (parts.length >= 2) return (parts[0][0] + parts[1][0]).toUpperCase();
  return local.slice(0, 2).toUpperCase();
}

export function AppShell() {
  const user = useAuthStore((s) => s.user);

  const initials = user?.email ? getEmailInitials(user.email) : "··";

  return (
    <div className="h-screen flex bg-background overflow-hidden">
      <Sidebar />
      <div className="flex-1 flex flex-col min-w-0 min-h-0">
        <header className="h-14 shrink-0 border-b border-border bg-card flex items-center justify-end gap-3 px-6">
          <ThemeToggle />
          {user && (
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <button
                  type="button"
                  aria-label="Account menu"
                  className="rounded-full outline-none ring-offset-2 ring-offset-card focus-visible:ring-2 focus-visible:ring-primary/40"
                >
                  <AvatarBeam initials={initials} size="sm" />
                </button>
              </DropdownMenuTrigger>
              <DropdownMenuContent className="w-72">
                <BlurFade duration={0.25} yOffset={0}>
                  <div className="flex items-center gap-3 p-3">
                    <AvatarBeam initials={initials} size="lg" showBeam />
                    <div className="flex min-w-0 flex-col">
                      <span className="truncate text-sm font-semibold text-foreground">
                        {user.full_name || user.email}
                      </span>
                      <span className="truncate text-xs text-muted-foreground">
                        {user.email}
                      </span>
                    </div>
                  </div>
                </BlurFade>
                <DropdownMenuSeparator />
                <div className="flex items-center justify-between px-3 py-2">
                  <span className="text-xs text-muted-foreground">Role</span>
                  <RoleBadge role={user.role} />
                </div>
              </DropdownMenuContent>
            </DropdownMenu>
          )}
        </header>
        <main className="relative flex-1 overflow-auto scrollbar-hide">
          <DotPattern className="text-foreground/[0.06] [mask-image:radial-gradient(ellipse_at_center,white,transparent_75%)]" />
          <div className="relative p-6">
            <Outlet />
          </div>
        </main>
      </div>
      <Mascot />
    </div>
  );
}
