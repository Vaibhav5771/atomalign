import { useEffect, useMemo, useState } from "react";
import { Loader2 } from "lucide-react";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { useAuthStore } from "@/stores/authStore";
import { TeamTree, type SummaryManagerNode } from "@/components/admin/TeamTree";

interface ViewTeamDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

export function ViewTeamDialog({ open, onOpenChange }: ViewTeamDialogProps) {
  const me = useAuthStore((s) => s.user);
  const fetchWorkspaceManagers = useAuthStore((s) => s.fetchWorkspaceManagers);
  const fetchWorkspaceEmployees = useAuthStore(
    (s) => s.fetchWorkspaceEmployees,
  );

  const [managers, setManagers] = useState<
    Awaited<ReturnType<typeof fetchWorkspaceManagers>>
  >([]);
  const [employees, setEmployees] = useState<
    Awaited<ReturnType<typeof fetchWorkspaceEmployees>>
  >([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!open) return;
    let cancelled = false;
    setLoading(true);
    setError(null);
    (async () => {
      try {
        const [mgrs, emps] = await Promise.all([
          fetchWorkspaceManagers(true),
          fetchWorkspaceEmployees(true),
        ]);
        if (!cancelled) {
          setManagers(mgrs);
          setEmployees(emps);
        }
      } catch (e) {
        if (!cancelled) {
          setError(e instanceof Error ? e.message : String(e));
        }
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [open, fetchWorkspaceManagers, fetchWorkspaceEmployees]);

  const tree = useMemo<SummaryManagerNode[]>(() => {
    const map = new Map<string, SummaryManagerNode>();
    managers.forEach((m) => {
      map.set(m.email, {
        mgrName: m.full_name || m.email,
        mgrEmail: m.email,
        mgrRole: m.role || "MANAGER",
        isNew: false,
        employees: [],
      });
    });
    employees.forEach((e) => {
      const mgr = managers.find((mx) => mx.id === e.manager_id);
      const mgrEmail = mgr?.email;
      if (!mgrEmail || !map.has(mgrEmail)) return;
      map.get(mgrEmail)!.employees.push({
        id: e.id,
        full_name: e.full_name || e.email,
        email: e.email,
        isNew: false,
      });
    });
    return Array.from(map.values());
  }, [managers, employees]);

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-3xl rounded-md border border-border/60 bg-card shadow-2xl shadow-black/40 ring-0">
        <DialogHeader>
          <DialogTitle className="text-2xl font-semibold tracking-tight leading-tight">
            Team hierarchy
          </DialogTitle>
          <DialogDescription className="text-sm/relaxed">
            Live snapshot of your workspace — admin, managers, and their direct
            reports.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4 py-2 max-h-[70vh] overflow-y-auto pr-1 scrollbar-hide">
          {loading ? (
            <div className="flex items-center justify-center p-12 text-muted-foreground">
              <Loader2 className="mr-2 h-6 w-6 animate-spin" />
              <span className="text-sm">Loading team…</span>
            </div>
          ) : error ? (
            <p className="p-4 text-sm text-destructive">
              Could not load team: {error}
            </p>
          ) : (
            <TeamTree
              admin={{
                name: me?.full_name || me?.email || "Admin",
                email: me?.email || "",
                role: me?.role || "ADMIN",
              }}
              tree={tree}
            />
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
}
