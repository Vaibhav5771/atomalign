import { useEffect } from "react";
import { Link } from "react-router-dom";
import { useFocusRefresh } from "@/lib/use-focus-refresh";
import { useAuthStore } from "@/stores/authStore";
import { useGoalSheetStore, currentCycleYear } from "@/stores/goalSheetStore";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { NumberTicker } from "@/components/ui/magicui/number-ticker";
import { AnimatedCircularProgress } from "@/components/ui/magicui/animated-circular-progress";
import { StatCard } from "@/components/shared/StatCard";
import { StatusBadge } from "@/components/shared/StatusBadge";

export default function EmployeeDashboard() {
  const user = useAuthStore((s) => s.user);
  const { currentSheet, goals, sharedAssignments, loading, fetchMySheet, totalWeightage } =
    useGoalSheetStore();

  useEffect(() => {
    if (user) void fetchMySheet(user.id, currentCycleYear);
  }, [user, fetchMySheet]);

  useFocusRefresh(() => {
    if (user) void fetchMySheet(user.id, currentCycleYear);
  });

  if (!user) return null;

  const total = totalWeightage();
  const goalCount = goals.length + sharedAssignments.length;

  return (
    <div className="space-y-6 max-w-4xl">
      <div>
        <h1 className="text-2xl font-semibold">Welcome, {user.full_name || user.email}</h1>
        <p className="text-sm text-muted-foreground mt-1">
          Cycle {currentCycleYear} — manage your goal sheet
        </p>
      </div>

      <Card>
        <CardHeader className="flex flex-row items-center justify-between">
          <div>
            <CardTitle>My goal sheet</CardTitle>
            <CardDescription>Status of your {currentCycleYear} sheet</CardDescription>
          </div>
          {currentSheet && <StatusBadge status={currentSheet.status} />}
        </CardHeader>
        <CardContent className="space-y-4">
          {loading ? (
            <p className="text-sm text-muted-foreground">Loading…</p>
          ) : !currentSheet ? (
            <div className="space-y-3">
              <p className="text-sm text-muted-foreground">
                You haven't created a goal sheet for this cycle yet.
              </p>
              <Button asChild>
                <Link to="/employee/goals/new">Create Goal Sheet</Link>
              </Button>
            </div>
          ) : (
            <>
              <div className="grid grid-cols-3 gap-4">
                <Stat label="Goals" value={goalCount} />
                <Stat label="Weightage" value={total} suffix="%" />
                <div className="border border-border rounded-lg p-3 flex items-center gap-3">
                  <AnimatedCircularProgress
                    value={total}
                    size={56}
                    strokeWidth={6}
                    label="Weightage filled"
                  />
                  <div>
                    <div className="text-xs text-muted-foreground uppercase tracking-wide">
                      Last update
                    </div>
                    <div className="text-sm font-mono mt-0.5">
                      {new Date(currentSheet.updated_at).toLocaleDateString()}
                    </div>
                  </div>
                </div>
              </div>
              {currentSheet.status === "RETURNED" && currentSheet.manager_remark && (
                <div className="border border-amber-300 bg-amber-50 dark:bg-amber-900/20 px-3 py-2 text-sm rounded">
                  <div className="font-medium text-amber-800 dark:text-amber-200">
                    Manager feedback
                  </div>
                  <div className="text-amber-900 dark:text-amber-100 mt-0.5">
                    {currentSheet.manager_remark}
                  </div>
                </div>
              )}
              <div className="flex gap-2">
                {(currentSheet.status === "DRAFT" || currentSheet.status === "RETURNED") && (
                  <Button asChild>
                    <Link to="/employee/goals/new">
                      {currentSheet.status === "RETURNED" ? "Edit & Resubmit" : "Continue Editing"}
                    </Link>
                  </Button>
                )}
                <Button asChild variant="outline">
                  <Link to="/employee/goals">View Sheet</Link>
                </Button>
              </div>
            </>
          )}
        </CardContent>
      </Card>
    </div>
  );
}

function Stat({ label, value, suffix }: { label: string; value: number; suffix?: string }) {
  return (
    <StatCard className="p-3">
      <div className="text-xs text-muted-foreground uppercase tracking-wide">{label}</div>
      <div className="text-2xl font-semibold mt-1 font-mono">
        <NumberTicker value={value} suffix={suffix} />
      </div>
    </StatCard>
  );
}
