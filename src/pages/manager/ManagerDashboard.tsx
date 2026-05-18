import { useEffect } from "react";
import { useFocusRefresh } from "@/lib/use-focus-refresh";
import { useAuthStore } from "@/stores/authStore";
import { useManagerStore } from "@/stores/managerStore";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { StatCard } from "@/components/shared/StatCard";
import { NumberTicker } from "@/components/ui/magicui/number-ticker";
import { BlurFade } from "@/components/ui/magicui/blur-fade";
import { TeamTable } from "@/components/manager/TeamTable";

export default function ManagerDashboard() {
  const user = useAuthStore((s) => s.user);
  const { teamSheets, loading, fetchTeamSheets } = useManagerStore();

  useEffect(() => {
    if (user) void fetchTeamSheets(user.id);
  }, [user, fetchTeamSheets]);

  useFocusRefresh(() => {
    if (user) void fetchTeamSheets(user.id);
  });

  if (!user) return null;

  const submittedCount = teamSheets.filter((s) => s.status === "SUBMITTED").length;
  const approvedCount = teamSheets.filter((s) => s.status === "APPROVED").length;

  return (
    <div className="space-y-5 max-w-5xl">
      <BlurFade>
        <div>
          <h1 className="text-2xl font-semibold tracking-tight leading-tight">Team</h1>
          <p className="text-sm text-muted-foreground mt-1 max-w-2xl">
            Review and approve direct reports' goal sheets.
          </p>
        </div>
      </BlurFade>

      <BlurFade delay={0.05}>
        <div className="grid grid-cols-3 gap-3 max-w-2xl">
          <Stat label="Direct reports" value={teamSheets.length} />
          <Stat label="Pending review" value={submittedCount} />
          <Stat label="Approved" value={approvedCount} />
        </div>
      </BlurFade>

      <BlurFade delay={0.1}>
        <Card className="rounded-md border-border/60 bg-card">
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
      </BlurFade>
    </div>
  );
}

function Stat({ label, value }: { label: string; value: number }) {
  return (
    <StatCard className="p-3">
      <div className="text-xs text-muted-foreground uppercase tracking-wide">{label}</div>
      <div className="text-2xl font-semibold mt-1 font-mono">
        <NumberTicker value={value} />
      </div>
    </StatCard>
  );
}
