import { Badge } from "@/components/ui/badge";
import type { UserRole } from "@/types";
import { cn } from "@/lib/utils";

const STYLES: Record<UserRole, string> = {
  EMPLOYEE: "bg-slate-100 text-slate-700 hover:bg-slate-100 dark:bg-slate-800 dark:text-slate-200",
  MANAGER: "bg-indigo-100 text-indigo-800 hover:bg-indigo-100 dark:bg-indigo-900 dark:text-indigo-200",
  ADMIN: "bg-purple-100 text-purple-800 hover:bg-purple-100 dark:bg-purple-900 dark:text-purple-200",
};

export function RoleBadge({ role }: { role: UserRole }) {
  return (
    <Badge variant="outline" className={cn("border-transparent font-medium", STYLES[role])}>
      {role}
    </Badge>
  );
}
