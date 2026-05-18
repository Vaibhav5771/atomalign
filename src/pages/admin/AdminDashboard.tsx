import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { UserPlus2, Network } from "lucide-react";
import { supabase } from "@/lib/supabase";
import { useFocusRefresh } from "@/lib/use-focus-refresh";
import { useAuthStore } from "@/stores/authStore";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent } from "@/components/ui/dialog";
import { NumberTicker } from "@/components/ui/magicui/number-ticker";
import { BentoGrid } from "@/components/ui/magicui/bento-grid";
import { CreateTeamWizard } from "@/components/admin/CreateTeamWizard";
import { ViewTeamDialog } from "@/components/admin/ViewTeamDialog";
import { StatCard } from "@/components/shared/StatCard";
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
  const [viewTeamOpen, setViewTeamOpen] = useState(false);
  const teamExists = stats.managers + stats.employees > 0;

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

  useFocusRefresh(() => {
    void loadStats();
  });

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

  const approvalRate =
    stats.sheets === 0 ? 0 : Math.round((stats.byStatus.APPROVED / stats.sheets) * 100);

  return (
    <div className="space-y-5 max-w-6xl">
      <div className="flex items-start justify-between gap-3">
        <div>
          <h1 className="text-2xl font-semibold">Admin overview</h1>
          <p className="text-sm text-muted-foreground mt-1">
            Organization's snapshot of the current goal cycle.
          </p>
        </div>
        <div className="flex items-center gap-2">
          {teamExists ? (
            <Button
              type="button"
              variant="outline"
              onClick={() => setViewTeamOpen(true)}
              className="rounded-sm"
            >
              <Network className="h-4 w-4 mr-1" />
              View Team
            </Button>
          ) : (
            <Button
              type="button"
              onClick={() => setWizardOpen(true)}
              className="rounded-sm"
            >
              <UserPlus2 className="h-4 w-4 mr-1" />
              Create Team
            </Button>
          )}
        </div>
      </div>

      <BentoGrid>
        <StatTile label="Employees" value={stats.employees} loading={loading} />
        <StatTile label="Managers" value={stats.managers} loading={loading} />
        <StatTile label="Total sheets" value={stats.sheets} loading={loading} />

        <StatCard className="md:col-span-2 p-4">
          <div className="text-sm font-medium mb-3">Sheet status breakdown</div>
          <div className="grid grid-cols-4 gap-3">
            <MiniStat label="Draft" value={stats.byStatus.DRAFT} loading={loading} />
            <MiniStat label="Submitted" value={stats.byStatus.SUBMITTED} loading={loading} />
            <MiniStat label="Approved" value={stats.byStatus.APPROVED} loading={loading} />
            <MiniStat label="Returned" value={stats.byStatus.RETURNED} loading={loading} />
          </div>
        </StatCard>

        <StatCard className="p-4">
          <div className="text-sm font-medium mb-2">Approval rate</div>
          {loading ? (
            <div className="text-3xl font-semibold font-mono">—</div>
          ) : (
            <div className="text-3xl font-semibold font-mono">
              <NumberTicker value={approvalRate} suffix="%" />
            </div>
          )}
          <div className="text-xs text-muted-foreground mt-1">
            of all sheets approved this cycle
          </div>
        </StatCard>

        <StatCard className="md:col-span-3 p-4">
          <div className="flex items-start justify-between gap-3">
            <div>
              <div className="text-sm font-medium">Shared goals</div>
              <p className="text-sm text-muted-foreground mt-1">
                Push organisation-wide goals to selected employees.
              </p>
            </div>
            <Button asChild className="rounded-sm">
              <Link to="/admin/shared-goals">Push a shared goal</Link>
            </Button>
          </div>
        </StatCard>
      </BentoGrid>

      <Dialog
        open={wizardOpen}
        onOpenChange={(open) => {
          if (!open) onWizardClose();
        }}
      >
        <DialogContent className="sm:max-w-3xl rounded-md border border-border/60 bg-card shadow-2xl shadow-black/40 ring-0">
          <CreateTeamWizard
            showProfileStep
            onClose={onWizardClose}
            onComplete={() => {
              void loadStats();
            }}
          />
        </DialogContent>
      </Dialog>

      <ViewTeamDialog open={viewTeamOpen} onOpenChange={setViewTeamOpen} />
    </div>
  );
}

function StatTile({ label, value, loading }: { label: string; value: number; loading: boolean }) {
  return (
    <StatCard className="p-4">
      <div className="text-xs text-muted-foreground uppercase tracking-wide">{label}</div>
      <div className="text-3xl font-semibold mt-1 font-mono">
        {loading ? "—" : <NumberTicker value={value} />}
      </div>
    </StatCard>
  );
}

function MiniStat({ label, value, loading }: { label: string; value: number; loading: boolean }) {
  return (
    <div className="border border-border rounded-md p-2">
      <div className="text-[0.65rem] text-muted-foreground uppercase tracking-wide">{label}</div>
      <div className="text-lg font-semibold mt-0.5 font-mono">
        {loading ? "—" : <NumberTicker value={value} />}
      </div>
    </div>
  );
}
