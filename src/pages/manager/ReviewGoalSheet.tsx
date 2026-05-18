import { useEffect, useState } from "react";
import { useNavigate, useParams } from "react-router-dom";
import { Loader2, AlertTriangle } from "lucide-react";
import { DotLottieReact } from "@lottiefiles/dotlottie-react";
import { useFocusRefresh } from "@/lib/use-focus-refresh";
import { useAuthStore } from "@/stores/authStore";
import { useManagerStore } from "@/stores/managerStore";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { BlurFade } from "@/components/ui/magicui/blur-fade";
import { ReviewPanel } from "@/components/manager/ReviewPanel";
import { StatusBadge } from "@/components/shared/StatusBadge";

type OutcomeResult = {
  status: "success" | "error";
  title: string;
  message: string;
  // Whether to nav back to /manager/dashboard once the user closes the success
  // outcome. False for plain validation errors that the user should be able to
  // fix in-place (weightage off, empty remark on return).
  navAway: boolean;
};

type ConfirmMode = "approve" | "return" | null;

export default function ReviewGoalSheet() {
  const { sheetId } = useParams<{ sheetId: string }>();
  const navigate = useNavigate();
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
  const [confirmMode, setConfirmMode] = useState<ConfirmMode>(null);
  const [result, setResult] = useState<OutcomeResult | null>(null);

  useEffect(() => {
    if (sheetId) void fetchSheetForReview(sheetId);
  }, [sheetId, fetchSheetForReview]);

  useFocusRefresh(() => {
    if (sheetId) void fetchSheetForReview(sheetId);
  });

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

  // ------------------------- Approve / Return ---------------------------
  // Both are state-transitioning writes. Approve locks every goal until an
  // admin reopens the sheet; Return bounces it to DRAFT/RETURNED for the
  // employee. They get the confirm-step treatment from round-7 design
  // tokens — inline-cell weightage/target edits in the panel stay silent.

  const handleApproveClick = () => {
    if (total !== 100) {
      setResult({
        status: "error",
        title: "Cannot approve",
        message: `Total weightage must equal 100% before approval (currently ${total}%).`,
        navAway: false,
      });
      return;
    }
    setConfirmMode("approve");
  };

  const handleReturnClick = () => {
    if (!remark.trim()) {
      setResult({
        status: "error",
        title: "Add a remark first",
        message: "Tell the employee what to change before sending the sheet back.",
        navAway: false,
      });
      return;
    }
    setConfirmMode("return");
  };

  const executeApprove = async () => {
    setBusy(true);
    const { error } = await approveSheet(sheetId, user.id, remark);
    setBusy(false);
    setConfirmMode(null);
    if (error) {
      setResult({
        status: "error",
        title: "Approve failed",
        message: error,
        navAway: false,
      });
    } else {
      setResult({
        status: "success",
        title: "Sheet approved",
        message: `${reviewEmployee?.full_name || reviewEmployee?.email}'s goals are now locked for the cycle.`,
        navAway: true,
      });
    }
  };

  const executeReturn = async () => {
    setBusy(true);
    const { error } = await returnSheet(sheetId, user.id, remark);
    setBusy(false);
    setConfirmMode(null);
    if (error) {
      setResult({
        status: "error",
        title: "Return failed",
        message: error,
        navAway: false,
      });
    } else {
      setResult({
        status: "success",
        title: "Sheet returned",
        message: `${reviewEmployee?.full_name || reviewEmployee?.email} can now edit and resubmit.`,
        navAway: true,
      });
    }
  };

  return (
    <div className="space-y-5 max-w-5xl">
      <BlurFade>
        <div className="flex items-start justify-between gap-3 flex-wrap">
          <div>
            <h1 className="text-2xl font-semibold tracking-tight leading-tight">
              {reviewEmployee?.full_name || reviewEmployee?.email}
            </h1>
            <p className="text-sm text-muted-foreground mt-1 max-w-2xl">
              {reviewEmployee?.department ?? "—"} · Cycle {reviewSheet.cycle_year}
            </p>
          </div>
          <StatusBadge status={reviewSheet.status} />
        </div>
      </BlurFade>

      {reviewSheet.reopened_by && (
        <BlurFade delay={0.04}>
          <div className="flex items-start gap-2 rounded-md border border-destructive/40 bg-destructive/[0.08] px-3 py-2 text-sm">
            <AlertTriangle className="h-4 w-4 text-destructive mt-0.5 shrink-0" />
            <div>
              <div className="font-medium text-destructive">Sheet reopened by admin</div>
              <div className="text-foreground/90 mt-0.5">
                {reviewReopener?.full_name || reviewReopener?.email || "An admin"} reopened this sheet
                {reviewSheet.reopened_at &&
                  ` on ${new Date(reviewSheet.reopened_at).toLocaleString()}`}
                {" "}to push a shared goal. All goals were unlocked so the employee could rebalance.
                Re-approve once weightages are correct.
              </div>
            </div>
          </div>
        </BlurFade>
      )}

      <BlurFade delay={0.08}>
        <Card className="rounded-md border-border/60 bg-card">
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
      </BlurFade>

      <BlurFade delay={0.12}>
        <Card className="rounded-md border-border/60 bg-card">
          <CardHeader>
            <CardTitle className="text-base">Manager remark</CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
            <div className="space-y-1">
              <Label htmlFor="remark">
                {reviewSheet.status === "APPROVED"
                  ? "Remark (read-only)"
                  : "Optional for approve · Required for return"}
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
                <Button
                  variant="outline"
                  disabled={busy}
                  onClick={handleReturnClick}
                  className="rounded-sm"
                >
                  Return for Rework
                </Button>
                <Button
                  disabled={busy || total !== 100}
                  onClick={handleApproveClick}
                  className="rounded-sm"
                >
                  Approve
                </Button>
              </div>
            )}
          </CardContent>
        </Card>
      </BlurFade>

      {/* -------------------- Confirm dialog (approve / return) ------------ */}
      <Dialog
        open={confirmMode !== null}
        onOpenChange={(o) => {
          if (!o && !busy) setConfirmMode(null);
        }}
      >
        <DialogContent
          showCloseButton={false}
          className="overflow-hidden rounded-md border border-border/60 bg-card p-5 text-foreground shadow-2xl shadow-black/40 sm:max-w-md"
        >
          <DialogHeader className="text-center sm:text-center">
            <DialogTitle className="text-xl font-semibold tracking-tight leading-tight">
              {confirmMode === "approve" ? "Approve this sheet?" : "Return this sheet?"}
            </DialogTitle>
            <DialogDescription className="text-sm text-muted-foreground">
              {confirmMode === "approve"
                ? "Goals lock for the cycle. Only an admin can reopen the sheet (e.g. to push a shared goal)."
                : "The employee gets the sheet back as RETURNED and must rebalance before resubmitting."}
            </DialogDescription>
          </DialogHeader>

          <div className="mt-2 grid grid-cols-3 gap-1.5">
            <SummaryStat
              label="Employee"
              value={reviewEmployee?.full_name || reviewEmployee?.email || "—"}
            />
            <SummaryStat label="Weightage" value={`${total}%`} />
            <SummaryStat label="Goals" value={String(reviewGoals.length)} />
          </div>

          {confirmMode === "return" && remark.trim() && (
            <div className="mt-2 rounded-md border border-border/60 bg-card px-3 py-2">
              <div className="text-[0.6rem] uppercase tracking-wider text-muted-foreground">
                Remark
              </div>
              <div className="mt-0.5 text-xs whitespace-pre-wrap text-foreground/90">
                {remark}
              </div>
            </div>
          )}

          <DialogFooter className="mt-3 gap-2 sm:gap-2 sm:justify-center">
            <Button
              variant="ghost"
              className="rounded-sm"
              onClick={() => setConfirmMode(null)}
              disabled={busy}
            >
              Cancel
            </Button>
            {confirmMode === "approve" ? (
              <Button className="rounded-sm" onClick={executeApprove} disabled={busy}>
                {busy && <Loader2 className="h-4 w-4 mr-1 animate-spin" />}
                {busy ? "Approving…" : "Yes, approve"}
              </Button>
            ) : (
              <Button
                variant="destructive"
                className="rounded-sm"
                onClick={executeReturn}
                disabled={busy}
              >
                {busy && <Loader2 className="h-4 w-4 mr-1 animate-spin" />}
                {busy ? "Returning…" : "Yes, return sheet"}
              </Button>
            )}
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* -------------------- Outcome dialog (success / error) ------------ */}
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
              onClick={() => {
                const navAway = result?.navAway && result?.status === "success";
                setResult(null);
                if (navAway) navigate("/manager/dashboard");
              }}
            >
              {result?.status === "success" ? "OK" : "Close"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}

function SummaryStat({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-md border border-border/60 bg-card px-2.5 py-1.5">
      <div className="text-[0.6rem] uppercase tracking-wider text-muted-foreground">
        {label}
      </div>
      <div className="text-xs font-medium truncate" title={value}>
        {value}
      </div>
    </div>
  );
}
