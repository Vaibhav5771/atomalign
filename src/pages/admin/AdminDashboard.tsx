import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { UserPlus2 } from "lucide-react";
import { supabase } from "@/lib/supabase";
import { useAuthStore } from "@/stores/authStore";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Dialog, DialogContent } from "@/components/ui/dialog";
import { CreateTeamWizard } from "@/components/admin/CreateTeamWizard";
import type { SheetStatus } from "@/types";

interface AdminStats {
  employees: number;
  managers: number;
  sheets: number;
  byStatus: Record<SheetStatus, number>;
}

const EMPTY: AdminStats = {
  employees: 0,
  managers: 0,
  sheets: 0,
  byStatus: { DRAFT: 0, SUBMITTED: 0, APPROVED: 0, RETURNED: 0 },
};

const ONBOARDING_KEY_PREFIX = "atomalign:onboarding-seen:";

export default function AdminDashboard() {
  const adminId = useAuthStore((s) => s.user?.id);
  const [stats, setStats] = useState<AdminStats>(EMPTY);
  const [loading, setLoading] = useState(true);
  const [wizardOpen, setWizardOpen] = useState(false);

  const loadStats = async () => {
    setLoading(true);
    const [{ data: profiles }, { data: sheets }] = await Promise.all([
      supabase.from("profiles").select("role"),
      supabase.from("goal_sheets").select("status"),
    ]);

    const next: AdminStats = {
      employees: 0,
      managers: 0,
      sheets: sheets?.length ?? 0,
      byStatus: { DRAFT: 0, SUBMITTED: 0, APPROVED: 0, RETURNED: 0 },
    };

    for (const p of profiles ?? []) {
      if (p.role === "EMPLOYEE") next.employees++;
      else if (p.role === "MANAGER") next.managers++;
    }
    for (const s of sheets ?? []) {
      next.byStatus[s.status as SheetStatus] =
        (next.byStatus[s.status as SheetStatus] ?? 0) + 1;
    }
    setStats(next);
    setLoading(false);
  };

  useEffect(() => {
    void loadStats();
  }, []);

  // Auto-open the wizard once per admin (per browser). Triggered after stats
  // resolve so the dialog overlays the populated dashboard rather than a
  // skeleton.
  useEffect(() => {
    if (loading || !adminId) return;
    const seen = window.localStorage.getItem(ONBOARDING_KEY_PREFIX + adminId);
    if (seen === "1") return;
    setWizardOpen(true);
  }, [loading, adminId]);

  const onWizardClose = () => {
    if (adminId) {
      window.localStorage.setItem(ONBOARDING_KEY_PREFIX + adminId, "1");
    }
    setWizardOpen(false);
  };

  return (
    <div className="space-y-5 max-w-5xl">
      <div className="flex items-start justify-between gap-3">
        <div>
          <h1 className="text-2xl font-semibold">Admin overview</h1>
          <p className="text-sm text-muted-foreground mt-1">
            Org-wide snapshot of the current goal cycle.
          </p>
        </div>
        <Button type="button" onClick={() => setWizardOpen(true)}>
          <UserPlus2 className="h-4 w-4 mr-1" />
          Create Team
        </Button>
      </div>

      <div className="grid grid-cols-4 gap-3">
        <Stat label="Employees" value={stats.employees} loading={loading} />
        <Stat label="Managers" value={stats.managers} loading={loading} />
        <Stat label="Total sheets" value={stats.sheets} loading={loading} />
        <Stat label="Approved" value={stats.byStatus.APPROVED} loading={loading} />
      </div>

      <Card>
        <CardHeader>
          <CardTitle className="text-base">Sheet status breakdown</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-4 gap-3">
            <Stat label="Draft" value={stats.byStatus.DRAFT} loading={loading} muted />
            <Stat label="Submitted" value={stats.byStatus.SUBMITTED} loading={loading} muted />
            <Stat label="Approved" value={stats.byStatus.APPROVED} loading={loading} muted />
            <Stat label="Returned" value={stats.byStatus.RETURNED} loading={loading} muted />
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="text-base">Shared goals</CardTitle>
        </CardHeader>
        <CardContent className="space-y-2">
          <p className="text-sm text-muted-foreground">
            Push organisation-wide goals to selected employees.
          </p>
          <Button asChild>
            <Link to="/admin/shared-goals">Push a shared goal</Link>
          </Button>
        </CardContent>
      </Card>

      <Dialog
        open={wizardOpen}
        onOpenChange={(open) => {
          if (!open) onWizardClose();
        }}
      >
        <DialogContent className="sm:max-w-3xl">
          <CreateTeamWizard
            showProfileStep
            onClose={onWizardClose}
            onComplete={() => {
              void loadStats();
            }}
          />
        </DialogContent>
      </Dialog>
    </div>
  );
}

function Stat({
  label,
  value,
  loading,
  muted = false,
}: {
  label: string;
  value: number;
  loading: boolean;
  muted?: boolean;
}) {
  return (
    <div className={"border border-border p-3 " + (muted ? "bg-muted/30" : "")}>
      <div className="text-xs text-muted-foreground uppercase tracking-wide">{label}</div>
      <div className="text-xl font-semibold mt-1 font-mono tabular-nums">
        {loading ? "—" : value}
      </div>
    </div>
  );
}
