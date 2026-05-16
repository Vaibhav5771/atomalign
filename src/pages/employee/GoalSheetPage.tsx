import { useEffect } from "react";
import { Link } from "react-router-dom";
import { useAuthStore } from "@/stores/authStore";
import { useGoalSheetStore, currentCycleYear } from "@/stores/goalSheetStore";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
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

  if (!user) return null;

  if (loading) return <p className="text-sm text-muted-foreground">Loading…</p>;

  if (!currentSheet) {
    return (
      <div className="max-w-xl space-y-3">
        <h1 className="text-2xl font-semibold">My goal sheet</h1>
        <p className="text-sm text-muted-foreground">
          You don't have a goal sheet for cycle {currentCycleYear} yet.
        </p>
        <Button asChild>
          <Link to="/employee/goals/new">Create goal sheet</Link>
        </Button>
      </div>
    );
  }

  const editable = currentSheet.status === "DRAFT" || currentSheet.status === "RETURNED";

  return (
    <div className="space-y-5 max-w-5xl">
      <div className="flex items-start justify-between">
        <div>
          <h1 className="text-2xl font-semibold">My goal sheet — {currentCycleYear}</h1>
          <p className="text-sm text-muted-foreground mt-1">
            {currentSheet.submitted_at &&
              `Submitted on ${new Date(currentSheet.submitted_at).toLocaleDateString()}`}
            {currentSheet.approved_at &&
              ` · Approved on ${new Date(currentSheet.approved_at).toLocaleDateString()}`}
          </p>
        </div>
        <div className="flex items-center gap-2">
          <StatusBadge status={currentSheet.status} />
          {editable && (
            <Button asChild size="sm">
              <Link to="/employee/goals/new">Edit</Link>
            </Button>
          )}
        </div>
      </div>

      {currentSheet.manager_remark && (
        <div className="border border-amber-300 bg-amber-50 dark:bg-amber-900/20 px-3 py-2 text-sm">
          <div className="font-medium text-amber-800 dark:text-amber-200">Manager remark</div>
          <div className="text-amber-900 dark:text-amber-100 mt-0.5">
            {currentSheet.manager_remark}
          </div>
        </div>
      )}

      <Card>
        <CardContent className="pt-6">
          <WeightageBar total={totalWeightage()} />
        </CardContent>
      </Card>

      <Card>
        <CardContent className="pt-6">
          <GoalList
            goals={goals}
            sharedAssignments={sharedAssignments}
            sharerProfiles={sharerProfiles}
            editable={false}
          />
        </CardContent>
      </Card>
    </div>
  );
}
