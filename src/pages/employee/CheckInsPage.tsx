import { useEffect, useMemo, useState } from "react";
import { Link } from "react-router-dom";
import { DotLottieReact } from "@lottiefiles/dotlottie-react";
import { useFocusRefresh } from "@/lib/use-focus-refresh";
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
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { BlurFade } from "@/components/ui/magicui/blur-fade";
import { QuarterSelector } from "@/components/goals/QuarterSelector";
import { CheckInForm } from "@/components/goals/CheckInForm";
import { CyclePhaseBanner } from "@/components/goals/CyclePhaseBanner";
import { QUARTER_LABELS, currentQuarter } from "@/lib/utils";
import type { CheckInStatus, Quarter } from "@/types";

type OutcomeResult = {
  status: "success" | "error";
  title: string;
  message: string;
};

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
  const [result, setResult] = useState<OutcomeResult | null>(null);

  useEffect(() => {
    if (user) void fetchMySheet(user.id, currentCycleYear);
  }, [user, fetchMySheet]);

  useEffect(() => {
    if (currentSheet?.status === "APPROVED") void fetchCheckIns(currentSheet.id);
  }, [currentSheet?.id, currentSheet?.status, fetchCheckIns]);

  useFocusRefresh(() => {
    if (!user) return;
    void fetchMySheet(user.id, currentCycleYear).then(() => {
      const sheet = useGoalSheetStore.getState().currentSheet;
      if (sheet?.status === "APPROVED") void fetchCheckIns(sheet.id);
    });
  });

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

  // Wrap the store's saveCheckIn so the outcome lives at the page level — one
  // Lottie surface for every per-goal save, matching the round-7 design rule
  // that outcome dialog is the sole feedback channel.
  const handleSaveCheckIn = async (
    goalId: string,
    q: Quarter,
    actual: string | null,
    actualDate: string | null,
    status: CheckInStatus,
  ) => {
    const goal = allGoals.find((g) => g.id === goalId);
    const { error } = await saveCheckIn(goalId, q, actual, actualDate, status);
    if (error) {
      setResult({
        status: "error",
        title: "Could not save check-in",
        message: error,
      });
    } else {
      setResult({
        status: "success",
        title: "Check-in saved",
        message: goal
          ? `${goal.title} · ${QUARTER_LABELS[q]}`
          : `Saved for ${QUARTER_LABELS[q]}.`,
      });
    }
    return { error };
  };

  return (
    <div className="space-y-5 max-w-5xl">
      <BlurFade>
        <div className="flex items-end justify-between gap-3 flex-wrap">
          <div>
            <h1 className="text-2xl font-semibold tracking-tight leading-tight">
              My Check-ins
            </h1>
            <p className="text-sm text-muted-foreground mt-1 max-w-2xl">
              Log actual achievement against your approved targets each quarter.
            </p>
          </div>
          {isApproved && (
            <QuarterSelector activeQuarter={quarter} onQuarterChange={setQuarter} />
          )}
        </div>
      </BlurFade>

      <BlurFade delay={0.04}>
        <CyclePhaseBanner />
      </BlurFade>

      {loading ? (
        <p className="text-sm text-muted-foreground">Loading…</p>
      ) : !currentSheet ? (
        <BlurFade delay={0.08}>
          <Card className="rounded-md border-border/60 bg-card">
            <CardHeader>
              <CardTitle className="text-base">No goal sheet yet</CardTitle>
              <CardDescription>
                Create and submit a goal sheet first. Check-ins unlock once your manager approves it.
              </CardDescription>
            </CardHeader>
            <CardContent>
              <Button asChild className="rounded-sm">
                <Link to="/employee/goals/new">Create goal sheet</Link>
              </Button>
            </CardContent>
          </Card>
        </BlurFade>
      ) : !isApproved ? (
        <BlurFade delay={0.08}>
          <Card className="rounded-md border-border/60 bg-card">
            <CardHeader>
              <CardTitle className="text-base">Awaiting manager approval</CardTitle>
              <CardDescription>
                Your goal sheet must be approved before logging check-ins. Current status:{" "}
                <span className="font-medium">{currentSheet.status}</span>.
              </CardDescription>
            </CardHeader>
          </Card>
        </BlurFade>
      ) : allGoals.length === 0 ? (
        <BlurFade delay={0.08}>
          <Card className="rounded-md border-border/60 bg-card">
            <CardHeader>
              <CardTitle className="text-base">No goals on this sheet</CardTitle>
              <CardDescription>
                There are no approved goals to check in against.
              </CardDescription>
            </CardHeader>
          </Card>
        </BlurFade>
      ) : (
        <BlurFade delay={0.08}>
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
                  onSave={handleSaveCheckIn}
                />
              );
            })}
          </div>
        </BlurFade>
      )}

      {/* -------------------- Outcome dialog (success / error) ------------- */}
      <Dialog
        open={!!result}
        onOpenChange={(o) => {
          if (!o) setResult(null);
        }}
      >
        <DialogContent
          showCloseButton={false}
          className="overflow-hidden rounded-md border border-border/60 bg-card p-5 text-foreground shadow-2xl shadow-black/40 sm:max-w-md"
        >
          <DialogHeader className="items-center text-center">
            <div className="mx-auto h-28 w-28">
              {result && (
                <DotLottieReact
                  key={result.status}
                  src={
                    result.status === "success"
                      ? "/success.lottie"
                      : "/error.lottie"
                  }
                  autoplay
                  loop={false}
                />
              )}
            </div>
            <DialogTitle className="text-lg font-semibold tracking-tight">
              {result?.title}
            </DialogTitle>
            <DialogDescription className="text-sm text-muted-foreground">
              {result?.message}
            </DialogDescription>
          </DialogHeader>
          <DialogFooter className="mt-4 gap-2 sm:gap-2 sm:justify-center">
            <Button
              className="rounded-sm"
              variant={result?.status === "success" ? "default" : "outline"}
              onClick={() => setResult(null)}
            >
              {result?.status === "success" ? "OK" : "Close"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
