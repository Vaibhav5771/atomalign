import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { Loader2 } from "lucide-react";
import { useAuthStore } from "@/stores/authStore";
import { useGoalSheetStore, currentCycleYear } from "@/stores/goalSheetStore";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { GoalForm } from "@/components/goals/GoalForm";
import { GoalList } from "@/components/goals/GoalList";
import { WeightageBar } from "@/components/goals/WeightageBar";
import { StatusBadge } from "@/components/shared/StatusBadge";
import { useToast } from "@/hooks/use-toast";
import type { Goal, GoalDraft } from "@/types";

export default function NewGoalSheetPage() {
  const user = useAuthStore((s) => s.user);
  const navigate = useNavigate();
  const { toast } = useToast();
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

  useEffect(() => {
    if (user) void fetchMySheet(user.id, currentCycleYear);
  }, [user, fetchMySheet]);

  if (!user) return null;

  const total = totalWeightage();
  const editable =
    !currentSheet ||
    currentSheet.status === "DRAFT" ||
    currentSheet.status === "RETURNED";

  const handleCreateSheet = async () => {
    setCreating(true);
    const sheet = await createSheet(user.id, currentCycleYear);
    setCreating(false);
    if (sheet) toast({ title: "Goal sheet created" });
  };

  const handleAddGoal = async (draft: GoalDraft) => {
    const projectedTotal = totalWeightage() + draft.weightage;
    if (projectedTotal > 100) {
      toast({
        title: "Over-allocation",
        description: `Adding this goal would total ${projectedTotal}%. Reduce existing weightages first.`,
        variant: "destructive",
      });
      return;
    }
    const { error } = await addGoal(draft);
    if (error) {
      toast({ title: "Could not add goal", description: error, variant: "destructive" });
    } else {
      toast({ title: "Goal added" });
      setShowAddForm(false);
    }
  };

  const handleUpdateGoal = async (id: string, patch: Partial<Goal>) => {
    if (typeof patch.weightage === "number") {
      const current = goals.find((g) => g.id === id);
      const delta = patch.weightage - (current?.weightage ?? 0);
      const projectedTotal = totalWeightage() + delta;
      if (projectedTotal > 100 && delta > 0) {
        toast({
          title: "Over-allocation",
          description: `That change would push the total to ${projectedTotal}%. Reduce other goals first.`,
          variant: "destructive",
        });
        return { error: "Total weightage cannot exceed 100%" };
      }
    }
    const { error } = await updateGoal(id, patch);
    if (error) {
      toast({ title: "Update failed", description: error, variant: "destructive" });
    }
    return { error };
  };

  const handleUpdateSharedWeightage = async (linkId: string, weightage: number) => {
    const current = sharedAssignments.find((s) => s.link.id === linkId);
    const delta = weightage - (current?.link.weightage ?? 0);
    const projectedTotal = totalWeightage() + delta;
    if (projectedTotal > 100 && delta > 0) {
      toast({
        title: "Over-allocation",
        description: `That change would push the total to ${projectedTotal}%. Reduce other goals first.`,
        variant: "destructive",
      });
      return { error: "Total weightage cannot exceed 100%" };
    }
    const { error } = await updateSharedWeightage(linkId, weightage);
    if (error) {
      toast({ title: "Update failed", description: error, variant: "destructive" });
    }
    return { error };
  };

  const handleDelete = async (id: string) => {
    const { error } = await deleteGoal(id);
    if (error) {
      toast({ title: "Delete failed", description: error, variant: "destructive" });
    }
    return { error };
  };

  const handleSubmit = async () => {
    setSubmitting(true);
    const { error } = await submitSheet();
    setSubmitting(false);
    if (error) {
      toast({ title: "Submit failed", description: error, variant: "destructive" });
    } else {
      toast({ title: "Goal sheet submitted" });
      navigate("/employee/dashboard");
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
      <div className="max-w-xl space-y-4">
        <h1 className="text-2xl font-semibold">Create goal sheet</h1>
        <p className="text-sm text-muted-foreground">
          Start your {currentCycleYear} goal sheet. You can add up to 8 goals totalling 100% weightage.
        </p>
        <Button onClick={handleCreateSheet} disabled={creating}>
          {creating && <Loader2 className="h-4 w-4 mr-1 animate-spin" />}
          {creating ? "Creating…" : "Create goal sheet"}
        </Button>
      </div>
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

  return (
    <div className="space-y-5 max-w-5xl">
      <div className="flex items-start justify-between">
        <div>
          <h1 className="text-2xl font-semibold">Goal sheet — {currentCycleYear}</h1>
          <p className="text-sm text-muted-foreground mt-1">
            {editable
              ? "Add or edit goals below. Total weightage must reach exactly 100%."
              : "This sheet has been submitted and is now read-only."}
          </p>
        </div>
        <StatusBadge status={currentSheet.status} />
      </div>

      {currentSheet.status === "RETURNED" && currentSheet.manager_remark && (
        <div className="border border-amber-300 bg-amber-50 dark:bg-amber-900/20 px-3 py-2 text-sm">
          <div className="font-medium text-amber-800 dark:text-amber-200">Manager feedback</div>
          <div className="text-amber-900 dark:text-amber-100 mt-0.5">
            {currentSheet.manager_remark}
          </div>
        </div>
      )}

      {editable && total > 100 && (
        <div className="border border-destructive/40 bg-destructive/10 px-3 py-2 text-sm">
          <div className="font-medium text-destructive">
            Total weightage is {total}% (over 100%)
          </div>
          <div className="text-destructive/90 mt-0.5">
            A shared goal was added to your sheet. Reduce the weightage on your
            own goals until the total returns to exactly 100% before resubmitting.
          </div>
        </div>
      )}

      <Card>
        <CardContent className="pt-6">
          <WeightageBar total={total} />
        </CardContent>
      </Card>

      {editable && (
        <Card>
          <CardHeader className="flex flex-row items-center justify-between">
            <CardTitle className="text-base">Goals ({goals.length}/8)</CardTitle>
            {!showAddForm ? (
              <Button
                size="sm"
                onClick={() => setShowAddForm(true)}
                disabled={addDisabled}
              >
                {addLabel}
              </Button>
            ) : (
              <span className="text-xs text-muted-foreground">Filling new goal…</span>
            )}
          </CardHeader>
          <CardContent>
            {showAddForm && (
              <div className="mb-4 border border-border p-4 bg-muted/30">
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
      )}

      {!editable && (
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
      )}

      {editable && (
        <div className="flex justify-end gap-2">
          <Button variant="outline" onClick={() => navigate("/employee/dashboard")}>
            Save & exit
          </Button>
          <Button onClick={handleSubmit} disabled={!canSubmit() || submitting}>
            {submitting && <Loader2 className="h-4 w-4 mr-1 animate-spin" />}
            {submitting
              ? "Submitting…"
              : total === 100
              ? "Submit sheet"
              : `Reach 100% to submit (${total}%)`}
          </Button>
        </div>
      )}
    </div>
  );
}
