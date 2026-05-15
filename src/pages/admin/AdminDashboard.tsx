import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { supabase } from "@/lib/supabase";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
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

export default function AdminDashboard() {
  const [stats, setStats] = useState<AdminStats>(EMPTY);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    void (async () => {
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
    })();
  }, []);

  return (
    <div className="space-y-5 max-w-5xl">
      <div>
        <h1 className="text-2xl font-semibold">Admin overview</h1>
        <p className="text-sm text-muted-foreground mt-1">
          Org-wide snapshot of the current goal cycle.
        </p>
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
