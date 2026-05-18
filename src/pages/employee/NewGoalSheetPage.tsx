import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { Loader2 } from "lucide-react";
import { DotLottieReact } from "@lottiefiles/dotlottie-react";
import { useAuthStore } from "@/stores/authStore";
import { useGoalSheetStore, currentCycleYear } from "@/stores/goalSheetStore";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { BlurFade } from "@/components/ui/magicui/blur-fade";
import { GoalForm } from "@/components/goals/GoalForm";
import { GoalList } from "@/components/goals/GoalList";
import { WeightageBar } from "@/components/goals/WeightageBar";
import { StatusBadge } from "@/components/shared/StatusBadge";
import type { Goal, GoalDraft } from "@/types";

type OutcomeResult = {
  status: "success" | "error";
  title: string;
  message: string;
};

export default function NewGoalSheetPage() {
  const user = useAuthStore((s) => s.user);
  const navigate = useNavigate();
  const {
    currentSheet,
    goals,
    sharedAssignments,
    sharerProfiles,
    loading,
    fetchMySheet,
    createSheet,
    addGoal,
    updateGoal,
    deleteGoal,
    updateSharedWeightage,
    submitSheet,
    totalWeightage,
    canSubmit,
  } = useGoalSheetStore();

  const [showAddForm, setShowAddForm] = useState(false);
  const [creating, setCreating] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [submitConfirmOpen, setSubmitConfirmOpen] = useState(false);
  const [result, setResult] = useState<OutcomeResult | null>(null);

  useEffect(() => {
    if (user) void fetchMySheet(user.id, currentCycleYear);
  }, [user, fetchMySheet]);

  if (!user) return null;

  const total = totalWeightage();
  const editable =
    !currentSheet ||
    currentSheet.status === "DRAFT" ||
    currentSheet.status === "RETURNED";

  // -----------------------------------------------------------------------
  // Write handlers — non-destructive create/edit follow the round-7 rule:
  //   submit click goes straight to Supabase, no confirm dialog. Only the
  //   final "Submit sheet" gate uses a confirm step because it transitions
  //   the sheet to a read-only state until the manager returns it.
  // -----------------------------------------------------------------------

  const handleCreateSheet = async () => {
    setCreating(true);
    const sheet = await createSheet(user.id, currentCycleYear);
    setCreating(false);
    if (sheet) {
      setResult({
        status: "success",
        title: "Goal sheet created",
        message: `Your ${currentCycleYear} sheet is ready. Add up to 8 goals totalling 100% weightage.`,
      });
    } else {
      setResult({
        status: "error",
        title: "Could not create sheet",
        message: "Something went wrong while creating your sheet. Try again in a moment.",
      });
    }
  };

  const handleAddGoal = async (draft: GoalDraft) => {
    const projectedTotal = totalWeightage() + draft.weightage;
    if (projectedTotal > 100) {
      setResult({
        status: "error",
        title: "Over-allocation",
        message: `Adding this goal would total ${projectedTotal}%. Reduce existing weightages first.`,
      });
      return;
    }
    const { error } = await addGoal(draft);
    if (error) {
      setResult({
        status: "error",
        title: "Could not add goal",
        message: error,
      });
    } else {
      setShowAddForm(false);
      setResult({
        status: "success",
        title: "Goal added",
        message: `${draft.title} is on your sheet at ${draft.weightage}%.`,
      });
    }
  };

  const handleUpdateGoal = async (id: string, patch: Partial<Goal>) => {
    if (typeof patch.weightage === "number") {
      const current = goals.find((g) => g.id === id);
      const delta = patch.weightage - (current?.weightage ?? 0);
      const projectedTotal = totalWeightage() + delta;
      if (projectedTotal > 100 && delta > 0) {
        setResult({
          status: "error",
          title: "Over-allocation",
          message: `That change would push the total to ${projectedTotal}%. Reduce other goals first.`,
        });
        return { error: "Total weightage cannot exceed 100%" };
      }
    }
    const { error } = await updateGoal(id, patch);
    if (error) {
      setResult({
        status: "error",
        title: "Update failed",
        message: error,
      });
    } else if (Object.keys(patch).length > 1 || !("weightage" in patch)) {
      // Loud outcome on full edits (via the GoalForm dialog). Skip the popup
      // for solitary inline weightage edits in the table — those happen on
      // blur and an outcome dialog per blur would be hostile UX.
      setResult({
        status: "success",
        title: "Goal updated",
        message: "Changes saved to your sheet.",
      });
    }
    return { error };
  };

  const handleUpdateSharedWeightage = async (linkId: string, weightage: number) => {
    const current = sharedAssignments.find((s) => s.link.id === linkId);
    const delta = weightage - (current?.link.weightage ?? 0);
    const projectedTotal = totalWeightage() + delta;
    if (projectedTotal > 100 && delta > 0) {
      setResult({
        status: "error",
        title: "Over-allocation",
        message: `That change would push the total to ${projectedTotal}%. Reduce other goals first.`,
      });
      return { error: "Total weightage cannot exceed 100%" };
    }
    const { error } = await updateSharedWeightage(linkId, weightage);
    if (error) {
      setResult({
        status: "error",
        title: "Update failed",
        message: error,
      });
    }
    // Silent on success — inline blur edits in the table commit quietly.
    return { error };
  };

  const handleDelete = async (id: string) => {
    const goal = goals.find((g) => g.id === id);
    const { error } = await deleteGoal(id);
    if (error) {
      setResult({
        status: "error",
        title: "Delete failed",
        message: error,
      });
    } else {
      setResult({
        status: "success",
        title: "Goal deleted",
        message: goal
          ? `${goal.title} was removed and ${goal.weightage}% of weightage freed up.`
          : "Goal removed from your sheet.",
      });
    }
    return { error };
  };

  const handleSubmit = async () => {
    setSubmitting(true);
    const { error } = await submitSheet();
    setSubmitting(false);
    setSubmitConfirmOpen(false);
    if (error) {
      setResult({
        status: "error",
        title: "Submit failed",
        message: error,
      });
    } else {
      setResult({
        status: "success",
        title: "Goal sheet submitted",
        message: "Your sheet is now with your manager for approval. You'll get an email update once they review it.",
      });
    }
  };

  if (loading && !currentSheet) {
    return (
      <div className="flex items-center gap-2 text-sm text-muted-foreground">
        <Loader2 className="h-4 w-4 animate-spin" /> Loading…
      </div>
    );
  }

  if (!currentSheet) {
    return (
      <>
        <BlurFade>
          <div className="max-w-xl space-y-4">
            <h1 className="text-2xl font-semibold tracking-tight leading-tight">
              Create goal sheet
            </h1>
            <p className="text-sm text-muted-foreground max-w-2xl">
              Start your {currentCycleYear} goal sheet. You can add up to 8 goals totalling 100% weightage.
            </p>
            <Button onClick={handleCreateSheet} disabled={creating} className="rounded-sm">
              {creating && <Loader2 className="h-4 w-4 mr-1 animate-spin" />}
              {creating ? "Creating…" : "Create goal sheet"}
            </Button>
          </div>
        </BlurFade>

        <OutcomeDialog result={result} onClose={() => setResult(null)} />
      </>
    );
  }

  const atGoalCap = goals.length >= 8;
  const atWeightageCap = total >= 100;
  const addDisabled = atGoalCap || atWeightageCap;
  const addLabel = atGoalCap
    ? "Goal limit reached"
    : atWeightageCap
    ? "Weightage already at 100%"
    : "Add goal";

  const submitReady = canSubmit() && !submitting;

  return (
    <div className="space-y-5 max-w-5xl">
      <BlurFade>
        <div className="flex items-start justify-between gap-3 flex-wrap">
          <div>
            <h1 className="text-2xl font-semibold tracking-tight leading-tight">
              Goal sheet — {currentCycleYear}
            </h1>
            <p className="text-sm text-muted-foreground mt-1 max-w-2xl">
              {editable
                ? "Add or edit goals below. Total weightage must reach exactly 100%."
                : "This sheet has been submitted and is now read-only."}
            </p>
          </div>
          <StatusBadge status={currentSheet.status} />
        </div>
      </BlurFade>

      {currentSheet.status === "RETURNED" && currentSheet.manager_remark && (
        <BlurFade delay={0.04}>
          <div className="rounded-md border border-primary/40 bg-primary/[0.12] px-3 py-2 text-sm">
            <div className="font-medium text-primary">Manager feedback</div>
            <div className="text-foreground/90 mt-0.5">
              {currentSheet.manager_remark}
            </div>
          </div>
        </BlurFade>
      )}

      {editable && total > 100 && (
        <BlurFade delay={0.04}>
          <div className="rounded-md border border-destructive/40 bg-destructive/10 px-3 py-2 text-sm">
            <div className="font-medium text-destructive">
              Total weightage is {total}% (over 100%)
            </div>
            <div className="text-destructive/90 mt-0.5">
              A shared goal was added to your sheet. Reduce the weightage on your
              own goals until the total returns to exactly 100% before resubmitting.
            </div>
          </div>
        </BlurFade>
      )}

      <BlurFade delay={0.08}>
        <Card className="rounded-md border-border/60 bg-card">
          <CardContent className="pt-6">
            <WeightageBar total={total} />
          </CardContent>
        </Card>
      </BlurFade>

      {editable && (
        <BlurFade delay={0.12}>
          <Card className="rounded-md border-border/60 bg-card">
            <CardHeader className="flex flex-row items-center justify-between">
              <CardTitle className="text-base">Goals ({goals.length}/8)</CardTitle>
              {!showAddForm ? (
                <Button
                  size="sm"
                  onClick={() => setShowAddForm(true)}
                  disabled={addDisabled}
                  className="rounded-sm"
                >
                  {addLabel}
                </Button>
              ) : (
                <span className="text-xs text-muted-foreground">Filling new goal…</span>
              )}
            </CardHeader>
            <CardContent>
              {showAddForm && (
                <div className="mb-4 rounded-md border border-border/60 bg-card p-4">
                  <GoalForm
                    onSubmit={handleAddGoal}
                    onCancel={() => setShowAddForm(false)}
                  />
                </div>
              )}
              <GoalList
                goals={goals}
                sharedAssignments={sharedAssignments}
                sharerProfiles={sharerProfiles}
                editable={editable}
                onUpdate={handleUpdateGoal}
                onDelete={handleDelete}
                onUpdateSharedWeightage={handleUpdateSharedWeightage}
              />
            </CardContent>
          </Card>
        </BlurFade>
      )}

      {!editable && (
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
      )}

      {editable && (
        <div className="flex justify-end gap-2">
          <Button
            variant="outline"
            onClick={() => navigate("/employee/dashboard")}
            className="rounded-sm"
          >
            Save & exit
          </Button>
          <Button
            onClick={() => setSubmitConfirmOpen(true)}
            disabled={!submitReady}
            className="rounded-sm"
          >
            {submitting && <Loader2 className="h-4 w-4 mr-1 animate-spin" />}
            {submitting
              ? "Submitting…"
              : total === 100
              ? "Submit sheet"
              : `Reach 100% to submit (${total}%)`}
          </Button>
        </div>
      )}

      {/* -------------------- Submit confirm dialog ----------------------- */}
      <Dialog
        open={submitConfirmOpen}
        onOpenChange={(o) => {
          if (!o && !submitting) setSubmitConfirmOpen(false);
        }}
      >
        <DialogContent
          showCloseButton={false}
          className="overflow-hidden rounded-md border border-border/60 bg-card p-5 text-foreground shadow-2xl shadow-black/40 sm:max-w-md"
        >
          <DialogHeader className="text-center sm:text-center">
            <DialogTitle className="text-xl font-semibold tracking-tight leading-tight">
              Submit this goal sheet?
            </DialogTitle>
            <DialogDescription className="text-sm text-muted-foreground">
              Your manager reviews it next. The sheet locks until they approve
              or return it with feedback.
            </DialogDescription>
          </DialogHeader>

          <div className="mt-2 grid grid-cols-3 gap-1.5">
            <SummaryStat
              label="Goals"
              value={String(goals.length + sharedAssignments.length)}
            />
            <SummaryStat label="Weightage" value={`${total}%`} />
            <SummaryStat label="Cycle" value={String(currentCycleYear)} />
          </div>

          <DialogFooter className="mt-3 gap-2 sm:gap-2 sm:justify-center">
            <Button
              variant="ghost"
              className="rounded-sm"
              onClick={() => setSubmitConfirmOpen(false)}
              disabled={submitting}
            >
              Cancel
            </Button>
            <Button
              className="rounded-sm"
              onClick={handleSubmit}
              disabled={submitting}
            >
              {submitting && <Loader2 className="h-4 w-4 mr-1 animate-spin" />}
              {submitting ? "Submitting…" : "Yes, submit sheet"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <OutcomeDialog
        result={result}
        onClose={() => {
          const wasSuccess = result?.status === "success";
          const wasSubmit = result?.title === "Goal sheet submitted";
          setResult(null);
          if (wasSuccess && wasSubmit) {
            // Submission moves the sheet to read-only — kick the user back to
            // the dashboard where the new status is the headline metric.
            navigate("/employee/dashboard");
          }
        }}
      />
    </div>
  );
}

// ---------------------------------------------------------------------------
// Outcome dialog — Lottie-driven success/error following the round-7 design
// system. Mirrors SharedGoalsPage / UsersPage outcome shape but uses solid
// `bg-card` per the locked-in dialog rule.
// ---------------------------------------------------------------------------
function OutcomeDialog({
  result,
  onClose,
}: {
  result: OutcomeResult | null;
  onClose: () => void;
}) {
  return (
    <Dialog
      open={!!result}
      onOpenChange={(o) => {
        if (!o) onClose();
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
            onClick={() => {
              const wasSuccess = result?.status === "success";
              onClose();
              if (wasSuccess) {
                document
                  .querySelector("main")
                  ?.scrollTo({ top: 0, behavior: "smooth" });
              }
            }}
          >
            {result?.status === "success" ? "OK" : "Close"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

function SummaryStat({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-md border border-border/60 bg-card px-2.5 py-1.5">
      <div className="text-[0.6rem] uppercase tracking-wider text-muted-foreground">
        {label}
      </div>
      <div className="text-xs font-medium tabular-nums truncate" title={value}>
        {value}
      </div>
    </div>
  );
}
