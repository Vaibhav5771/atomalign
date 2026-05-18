import { useEffect } from "react";
import { Link } from "react-router-dom";
import { useFocusRefresh } from "@/lib/use-focus-refresh";
import { useAuthStore } from "@/stores/authStore";
import { useGoalSheetStore, currentCycleYear } from "@/stores/goalSheetStore";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { BlurFade } from "@/components/ui/magicui/blur-fade";
import { GoalList } from "@/components/goals/GoalList";
import { WeightageBar } from "@/components/goals/WeightageBar";
import { StatusBadge } from "@/components/shared/StatusBadge";

export default function GoalSheetPage() {
  const user = useAuthStore((s) => s.user);
  const {
    currentSheet,
    goals,
    sharedAssignments,
    sharerProfiles,
    loading,
    fetchMySheet,
    totalWeightage,
  } = useGoalSheetStore();

  useEffect(() => {
    if (user) void fetchMySheet(user.id, currentCycleYear);
  }, [user, fetchMySheet]);

  useFocusRefresh(() => {
    if (user) void fetchMySheet(user.id, currentCycleYear);
  });

  if (!user) return null;

  if (loading) return <p className="text-sm text-muted-foreground">Loading…</p>;

  if (!currentSheet) {
    return (
      <div className="max-w-xl space-y-3">
        <h1 className="text-2xl font-semibold tracking-tight leading-tight">My goal sheet</h1>
        <p className="text-sm text-muted-foreground max-w-2xl">
          You don't have a goal sheet for cycle {currentCycleYear} yet.
        </p>
        <Button asChild className="rounded-sm">
          <Link to="/employee/goals/new">Create goal sheet</Link>
        </Button>
      </div>
    );
  }

  const editable = currentSheet.status === "DRAFT" || currentSheet.status === "RETURNED";

  return (
    <div className="space-y-5 max-w-5xl">
      <BlurFade>
        <div className="flex items-start justify-between gap-3 flex-wrap">
          <div>
            <h1 className="text-2xl font-semibold tracking-tight leading-tight">
              My goal sheet — {currentCycleYear}
            </h1>
            <p className="text-sm text-muted-foreground mt-1 max-w-2xl">
              {currentSheet.submitted_at &&
                `Submitted on ${new Date(currentSheet.submitted_at).toLocaleDateString()}`}
              {currentSheet.approved_at &&
                ` · Approved on ${new Date(currentSheet.approved_at).toLocaleDateString()}`}
            </p>
          </div>
          <div className="flex items-center gap-2">
            <StatusBadge status={currentSheet.status} />
            {editable && (
              <Button asChild size="sm" className="rounded-sm">
                <Link to="/employee/goals/new">Edit</Link>
              </Button>
            )}
          </div>
        </div>
      </BlurFade>

      {currentSheet.manager_remark && (
        <BlurFade delay={0.04}>
          <div className="rounded-md border border-primary/40 bg-primary/[0.12] px-3 py-2 text-sm">
            <div className="font-medium text-primary">Manager remark</div>
            <div className="text-foreground/90 mt-0.5">
              {currentSheet.manager_remark}
            </div>
          </div>
        </BlurFade>
      )}

      <BlurFade delay={0.08}>
        <Card className="rounded-md border-border/60 bg-card">
          <CardContent className="pt-6">
            <WeightageBar total={totalWeightage()} />
          </CardContent>
        </Card>
      </BlurFade>

      <BlurFade delay={0.12}>
        <Card className="rounded-md border-border/60 bg-card">
          <CardContent className="pt-6">
            <GoalList
              goals={goals}
              sharedAssignments={sharedAssignments}
              sharerProfiles={sharerProfiles}
              editable={false}
            />
          </CardContent>
        </Card>
      </BlurFade>
    </div>
  );
}
