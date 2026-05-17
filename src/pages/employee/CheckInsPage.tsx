import { useEffect, useMemo, useState } from "react";
import { Link } from "react-router-dom";
import { useAuthStore } from "@/stores/authStore";
import { useGoalSheetStore, currentCycleYear } from "@/stores/goalSheetStore";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { QuarterSelector } from "@/components/goals/QuarterSelector";
import { CheckInForm } from "@/components/goals/CheckInForm";
import { CyclePhaseBanner } from "@/components/goals/CyclePhaseBanner";
import { currentQuarter } from "@/lib/utils";
import type { Quarter } from "@/types";

export default function CheckInsPage() {
  const user = useAuthStore((s) => s.user);
  const {
    currentSheet,
    goals,
    sharedAssignments,
    checkIns,
    loading,
    checkInsLoading,
    fetchMySheet,
    fetchCheckIns,
    saveCheckIn,
  } = useGoalSheetStore();

  const [quarter, setQuarter] = useState<Quarter>(currentQuarter());

  useEffect(() => {
    if (user) void fetchMySheet(user.id, currentCycleYear);
  }, [user, fetchMySheet]);

  useEffect(() => {
    if (currentSheet?.status === "APPROVED") void fetchCheckIns(currentSheet.id);
  }, [currentSheet?.id, currentSheet?.status, fetchCheckIns]);

  const isApproved = currentSheet?.status === "APPROVED";

  const allGoals = useMemo(() => {
    const own = goals.map((g) => ({ ...g }));
    const shared = sharedAssignments.map((a) => ({
      ...a.source,
      weightage: a.link.weightage,
    }));
    return [...own, ...shared];
  }, [goals, sharedAssignments]);

  if (!user) return null;

  return (
    <div className="space-y-5 max-w-5xl">
      <div className="flex items-end justify-between gap-3 flex-wrap">
        <div>
          <h1 className="text-2xl font-semibold">My Check-ins</h1>
          <p className="text-sm text-muted-foreground mt-1">
            Log actual achievement against your approved targets each quarter.
          </p>
        </div>
        {isApproved && (
          <QuarterSelector activeQuarter={quarter} onQuarterChange={setQuarter} />
        )}
      </div>

      <CyclePhaseBanner />

      {loading ? (
        <p className="text-sm text-muted-foreground">Loading…</p>
      ) : !currentSheet ? (
        <Card>
          <CardHeader>
            <CardTitle className="text-base">No goal sheet yet</CardTitle>
            <CardDescription>
              Create and submit a goal sheet first. Check-ins unlock once your manager approves it.
            </CardDescription>
          </CardHeader>
          <CardContent>
            <Button asChild>
              <Link to="/employee/goals/new">Create goal sheet</Link>
            </Button>
          </CardContent>
        </Card>
      ) : !isApproved ? (
        <Card>
          <CardHeader>
            <CardTitle className="text-base">Awaiting manager approval</CardTitle>
            <CardDescription>
              Your goal sheet must be approved before logging check-ins. Current status:{" "}
              <span className="font-medium">{currentSheet.status}</span>.
            </CardDescription>
          </CardHeader>
        </Card>
      ) : allGoals.length === 0 ? (
        <Card>
          <CardHeader>
            <CardTitle className="text-base">No goals on this sheet</CardTitle>
            <CardDescription>
              There are no approved goals to check in against.
            </CardDescription>
          </CardHeader>
        </Card>
      ) : (
        <div className="space-y-3">
          {checkInsLoading && (
            <p className="text-xs text-muted-foreground">Loading check-ins…</p>
          )}
          {allGoals.map((g) => {
            const existing =
              (checkIns[g.id] ?? []).find((c) => c.quarter === quarter) ?? null;
            return (
              <CheckInForm
                key={`${g.id}-${quarter}`}
                goal={g}
                quarter={quarter}
                checkIn={existing}
                onSave={saveCheckIn}
              />
            );
          })}
        </div>
      )}
    </div>
  );
}
