import { Badge } from "@/components/ui/badge";
import type { SheetStatus } from "@/types";
import { cn } from "@/lib/utils";

const STYLES: Record<SheetStatus, string> = {
  DRAFT: "bg-muted text-muted-foreground hover:bg-muted",
  SUBMITTED: "bg-blue-100 text-blue-800 hover:bg-blue-100 dark:bg-blue-900 dark:text-blue-200",
  APPROVED: "bg-green-100 text-green-800 hover:bg-green-100 dark:bg-green-900 dark:text-green-200",
  RETURNED: "bg-amber-100 text-amber-800 hover:bg-amber-100 dark:bg-amber-900 dark:text-amber-200",
};

export function StatusBadge({ status }: { status: SheetStatus }) {
  return (
    <Badge variant="outline" className={cn("border-transparent font-medium", STYLES[status])}>
      {status}
    </Badge>
  );
}
