import { useEffect, useState } from "react";
import { useNavigate, useParams } from "react-router-dom";
import { Loader2, AlertTriangle } from "lucide-react";
import { useAuthStore } from "@/stores/authStore";
import { useManagerStore } from "@/stores/managerStore";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { ReviewPanel } from "@/components/manager/ReviewPanel";
import { StatusBadge } from "@/components/shared/StatusBadge";
import { useToast } from "@/hooks/use-toast";

export default function ReviewGoalSheet() {
  const { sheetId } = useParams<{ sheetId: string }>();
  const navigate = useNavigate();
  const { toast } = useToast();
  const user = useAuthStore((s) => s.user);
  const {
    reviewSheet,
    reviewEmployee,
    reviewGoals,
    reviewReopener,
    loading,
    fetchSheetForReview,
    updateGoalInline,
    approveSheet,
    returnSheet,
  } = useManagerStore();

  const [remark, setRemark] = useState("");
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    if (sheetId) void fetchSheetForReview(sheetId);
  }, [sheetId, fetchSheetForReview]);

  useEffect(() => {
    if (reviewSheet?.manager_remark) setRemark(reviewSheet.manager_remark);
  }, [reviewSheet?.manager_remark]);

  if (!user || !sheetId) return null;
  if (loading || !reviewSheet) {
    return (
      <div className="flex items-center gap-2 text-sm text-muted-foreground">
        <Loader2 className="h-4 w-4 animate-spin" /> Loading sheet…
      </div>
    );
  }

  const readOnly = reviewSheet.status === "APPROVED";
  const total = reviewGoals.reduce((s, g) => s + g.weightage, 0);

  const handleApprove = async () => {
    if (total !== 100) {
      toast({
        title: "Cannot approve",
        description: "Total weightage must equal 100% before approval.",
        variant: "destructive",
      });
      return;
    }
    setBusy(true);
    const { error } = await approveSheet(sheetId, user.id, remark);
    setBusy(false);
    if (error) {
      toast({ title: "Approve failed", description: error, variant: "destructive" });
    } else {
      toast({ title: "Sheet approved", description: "Goals are now locked." });
      navigate("/manager/dashboard");
    }
  };

  const handleReturn = async () => {
    if (!remark.trim()) {
      toast({
        title: "Add a remark",
        description: "Tell the employee what to change.",
        variant: "destructive",
      });
      return;
    }
    setBusy(true);
    const { error } = await returnSheet(sheetId, user.id, remark);
    setBusy(false);
    if (error) {
      toast({ title: "Return failed", description: error, variant: "destructive" });
    } else {
      toast({ title: "Sheet returned", description: "Employee can edit and resubmit." });
      navigate("/manager/dashboard");
    }
  };

  return (
    <div className="space-y-5 max-w-5xl">
      <div className="flex items-start justify-between">
        <div>
          <h1 className="text-2xl font-semibold">
            {reviewEmployee?.full_name || reviewEmployee?.email}
          </h1>
          <p className="text-sm text-muted-foreground mt-1">
            {reviewEmployee?.department ?? "—"} · Cycle {reviewSheet.cycle_year}
          </p>
        </div>
        <StatusBadge status={reviewSheet.status} />
      </div>

      {reviewSheet.reopened_by && (
        <div className="border border-amber-300 bg-amber-50 dark:bg-amber-900/20 px-3 py-2 text-sm flex items-start gap-2">
          <AlertTriangle className="h-4 w-4 text-amber-600 mt-0.5 shrink-0" />
          <div>
            <div className="font-medium text-amber-800 dark:text-amber-200">
              Sheet reopened by admin
            </div>
            <div className="text-amber-900 dark:text-amber-100 mt-0.5">
              {reviewReopener?.full_name || reviewReopener?.email || "An admin"} reopened this sheet
              {reviewSheet.reopened_at &&
                ` on ${new Date(reviewSheet.reopened_at).toLocaleString()}`}
              {" "}to push a shared goal. All goals were unlocked so the employee could rebalance.
              Re-approve once weightages are correct.
            </div>
          </div>
        </div>
      )}

      <Card>
        <CardHeader>
          <CardTitle className="text-base">Goals</CardTitle>
        </CardHeader>
        <CardContent>
          <ReviewPanel
            goals={reviewGoals}
            readOnly={readOnly}
            onInlineUpdate={updateGoalInline}
          />
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="text-base">Manager remark</CardTitle>
        </CardHeader>
        <CardContent className="space-y-3">
          <div className="space-y-1">
            <Label htmlFor="remark">
              {reviewSheet.status === "APPROVED" ? "Remark (read-only)" : "Optional for approve · Required for return"}
            </Label>
            <Textarea
              id="remark"
              rows={3}
              value={remark}
              disabled={readOnly}
              onChange={(e) => setRemark(e.target.value)}
              placeholder="e.g. Targets look reasonable. Approved."
            />
          </div>
          {!readOnly && (
            <div className="flex justify-end gap-2">
              <Button variant="outline" disabled={busy} onClick={handleReturn}>
                {busy && <Loader2 className="h-4 w-4 mr-1 animate-spin" />}
                Return for Rework
              </Button>
              <Button disabled={busy || total !== 100} onClick={handleApprove}>
                {busy && <Loader2 className="h-4 w-4 mr-1 animate-spin" />}
                Approve
              </Button>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
