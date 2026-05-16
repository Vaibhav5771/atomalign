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
} from "lucide-react";
import { useAuthStore } from "@/stores/authStore";
import { cn } from "@/lib/utils";

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
  ],
};

export function Sidebar() {
  const user = useAuthStore((s) => s.user);
  if (!user) return null;
  const items = NAV_BY_ROLE[user.role] ?? [];

  return (
    <aside className="w-60 shrink-0 border-r border-border bg-card flex flex-col">
      <div className="px-5 py-5 border-b border-border">
        <div className="text-base font-semibold">AtomAlign</div>
        <div className="text-xs text-muted-foreground mt-0.5">Phase 2</div>
      </div>
      <nav className="flex-1 p-3 space-y-1">
        {items.map(({ to, label, icon: Icon }) => (
          <NavLink
            key={to}
            to={to}
            end={false}
            className={({ isActive }) =>
              cn(
                "flex items-center gap-2 px-3 py-2 text-sm font-medium",
                isActive
                  ? "bg-primary text-primary-foreground"
                  : "text-foreground hover:bg-accent hover:text-accent-foreground",
              )
            }
          >
            <Icon className="h-4 w-4" />
            {label}
          </NavLink>
        ))}
      </nav>
    </aside>
  );
}
