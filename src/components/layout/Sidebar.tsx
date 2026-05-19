import { useState } from "react";
import { NavLink } from "react-router-dom";
import {
  LayoutDashboard,
  Target,
  Users,
  Share2,
  ClipboardCheck,
  UserPlus,
  FileBarChart,
  TrendingUp,
  AlertTriangle,
  ChevronLeft,
  ChevronRight,
  LogOut,
} from "lucide-react";
import { useAuthStore } from "@/stores/authStore";
import { useUIStore } from "@/stores/uiStore";
import { LogoutDialog } from "@/components/layout/LogoutDialog";
import { cn } from "@/lib/utils";
import logoUrl from "@/assets/logo.svg";

interface NavItem {
  to: string;
  label: string;
  icon: typeof LayoutDashboard;
}

const NAV_BY_ROLE: Record<string, NavItem[]> = {
  EMPLOYEE: [
    { to: "/employee/dashboard", label: "Dashboard", icon: LayoutDashboard },
    { to: "/employee/goals", label: "My Goals", icon: Target },
    { to: "/employee/checkins", label: "My Check-ins", icon: ClipboardCheck },
  ],
  MANAGER: [
    { to: "/manager/dashboard", label: "Team", icon: Users },
    { to: "/manager/checkins", label: "Team Check-ins", icon: ClipboardCheck },
  ],
  ADMIN: [
    { to: "/admin/dashboard", label: "Dashboard", icon: LayoutDashboard },
    { to: "/admin/users", label: "Users", icon: UserPlus },
    { to: "/admin/shared-goals", label: "Shared Goals", icon: Share2 },
    { to: "/admin/reports", label: "Reports", icon: FileBarChart },
    { to: "/admin/analytics", label: "Analytics", icon: TrendingUp },
    { to: "/admin/escalations", label: "Escalations", icon: AlertTriangle },
  ],
};

export function Sidebar() {
  const user = useAuthStore((s) => s.user);
  const collapsed = useUIStore((s) => s.sidebarCollapsed);
  const toggleSidebar = useUIStore((s) => s.toggleSidebar);
  const [logoutOpen, setLogoutOpen] = useState(false);

  if (!user) return null;
  const items = NAV_BY_ROLE[user.role] ?? [];

  return (
    <div
      data-collapsed={collapsed || undefined}
      className={cn(
        "relative shrink-0 transition-[width] duration-200 ease-out",
        collapsed ? "w-14" : "w-52",
      )}
    >
      <aside
        aria-label="Primary navigation"
        className="flex h-full flex-col overflow-hidden border-r border-border bg-card"
      >
        <nav
          className={cn(
            "flex-1 space-y-1 overflow-y-auto scrollbar-hide",
            collapsed ? "p-2 pt-3" : "p-3 pt-4",
          )}
        >
          {items.map(({ to, label, icon: Icon }) => (
            <NavLink
              key={to}
              to={to}
              end={false}
              title={collapsed ? label : undefined}
              aria-label={collapsed ? label : undefined}
              className={({ isActive }) =>
                cn(
                  "flex items-center rounded-sm text-sm font-medium transition-colors",
                  collapsed ? "justify-center p-2.5" : "gap-2 px-3 py-2",
                  isActive
                    ? "bg-primary text-primary-foreground"
                    : "text-foreground hover:bg-accent hover:text-accent-foreground",
                )
              }
            >
              <Icon className="h-4 w-4 shrink-0" />
              {!collapsed && <span className="truncate">{label}</span>}
            </NavLink>
          ))}
        </nav>

        <div
          className={cn(
            "border-t border-border",
            collapsed ? "p-2" : "px-3 py-3",
          )}
        >
          <div
            className={cn(
              "flex items-center",
              collapsed ? "flex-col gap-1" : "gap-2",
            )}
          >
            <div
              className={cn(
                "flex min-w-0 items-center gap-2",
                collapsed ? "justify-center" : "flex-1",
              )}
            >
              <img
                src={logoUrl}
                alt=""
                aria-hidden="true"
                className="h-8 w-8 shrink-0"
              />
              {!collapsed && (
                <div className="flex min-w-0 flex-col">
                  <span className="truncate font-spock text-sm font-bold leading-tight">
                    AtomAlign
                  </span>
                  <span className="truncate text-[10px] text-muted-foreground">
                    Goal Setting & Tracking
                  </span>
                </div>
              )}
            </div>

            <button
              type="button"
              onClick={() => setLogoutOpen(true)}
              aria-label="Sign out"
              title="Sign out"
              className="flex h-8 w-8 shrink-0 items-center justify-center rounded-sm text-muted-foreground transition-colors hover:bg-accent hover:text-foreground"
            >
              <LogOut className="h-4 w-4" />
            </button>
          </div>
        </div>
      </aside>

      <button
        type="button"
        onClick={toggleSidebar}
        aria-label={collapsed ? "Expand sidebar" : "Collapse sidebar"}
        aria-expanded={!collapsed}
        title={collapsed ? "Expand sidebar" : "Collapse sidebar"}
        className="absolute -right-3 top-1/2 z-20 flex h-6 w-6 -translate-y-1/2 items-center justify-center rounded-full border border-border bg-card text-muted-foreground shadow-md transition-colors hover:bg-accent hover:text-foreground"
      >
        {collapsed ? (
          <ChevronRight className="h-3.5 w-3.5" />
        ) : (
          <ChevronLeft className="h-3.5 w-3.5" />
        )}
      </button>

      <LogoutDialog open={logoutOpen} onOpenChange={setLogoutOpen} />
    </div>
  );
}
