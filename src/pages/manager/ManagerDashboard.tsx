import { useEffect } from "react";
import { useAuthStore } from "@/stores/authStore";
import { useManagerStore } from "@/stores/managerStore";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { TeamTable } from "@/components/manager/TeamTable";

export default function ManagerDashboard() {
  const user = useAuthStore((s) => s.user);
  const { teamSheets, loading, fetchTeamSheets } = useManagerStore();

  useEffect(() => {
    if (user) void fetchTeamSheets(user.id);
  }, [user, fetchTeamSheets]);

  if (!user) return null;

  const submittedCount = teamSheets.filter((s) => s.status === "SUBMITTED").length;
  const approvedCount = teamSheets.filter((s) => s.status === "APPROVED").length;

  return (
    <div className="space-y-5 max-w-5xl">
      <div>
        <h1 className="text-2xl font-semibold">Team</h1>
        <p className="text-sm text-muted-foreground mt-1">
          Review and approve direct reports' goal sheets.
        </p>
      </div>

      <div className="grid grid-cols-3 gap-3 max-w-2xl">
        <Stat label="Direct reports" value={String(teamSheets.length)} />
        <Stat label="Pending review" value={String(submittedCount)} />
        <Stat label="Approved" value={String(approvedCount)} />
      </div>

      <Card>
        <CardHeader>
          <CardTitle className="text-base">Direct reports</CardTitle>
        </CardHeader>
        <CardContent>
          {loading ? (
            <p className="text-sm text-muted-foreground">Loading…</p>
          ) : (
            <TeamTable rows={teamSheets} />
          )}
        </CardContent>
      </Card>
    </div>
  );
}

function Stat({ label, value }: { label: string; value: string }) {
  return (
    <div className="border border-border p-3">
      <div className="text-xs text-muted-foreground uppercase tracking-wide">{label}</div>
      <div className="text-xl font-semibold mt-1 font-mono tabular-nums">{value}</div>
    </div>
  );
}
