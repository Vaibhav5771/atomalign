import { useEffect, useMemo, useState } from "react";
import { Loader2 } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { CheckInScoreCard } from "@/components/goals/CheckInScoreCard";
import { computeGoalScore } from "@/lib/utils";
import type { CheckIn, CheckInStatus, Goal, Quarter } from "@/types";

interface Props {
  goal: Goal;
  quarter: Quarter;
  checkIn: CheckIn | null;
  disabled?: boolean;
  disabledReason?: string;
  onSave: (
    goalId: string,
    quarter: Quarter,
    actual: string | null,
    actualDate: string | null,
    status: CheckInStatus,
  ) => Promise<{ error: string | null }>;
}

const STATUS_LABEL: Record<CheckInStatus, string> = {
  NOT_STARTED: "Not Started",
  ON_TRACK: "On Track",
  COMPLETED: "Completed",
};

function actualLabel(uom: Goal["uom"]) {
  switch (uom) {
    case "TIMELINE":
      return "Completion Date";
    case "ZERO":
      return "Incident Count (0 = success)";
    case "PERCENT":
      return "Actual Value (%)";
    default:
      return "Actual Value";
  }
}

export function CheckInForm({
  goal,
  quarter,
  checkIn,
  disabled,
  disabledReason,
  onSave,
}: Props) {
  const [actual, setActual] = useState<string>(checkIn?.actual ?? "");
  const [actualDate, setActualDate] = useState<string>(checkIn?.actual_date ?? "");
  const [status, setStatus] = useState<CheckInStatus>(checkIn?.status ?? "NOT_STARTED");
  const [saving, setSaving] = useState(false);

  // Reset local state when the underlying check_in changes (e.g. quarter switch).
  useEffect(() => {
    setActual(checkIn?.actual ?? "");
    setActualDate(checkIn?.actual_date ?? "");
    setStatus(checkIn?.status ?? "NOT_STARTED");
  }, [checkIn?.id, checkIn?.quarter, quarter, goal.id]);

  const previewScore = useMemo(
    () =>
      computeGoalScore(
        goal,
        goal.uom === "TIMELINE" ? null : actual,
        goal.uom === "TIMELINE" ? actualDate || null : null,
      ),
    [goal, actual, actualDate],
  );

  const canSave = (() => {
    if (disabled || saving) return false;
    if (goal.uom === "TIMELINE") return actualDate.trim() !== "";
    if (actual.trim() === "") return false;
    const n = Number(actual);
    if (Number.isNaN(n)) return false;
    // Actuals can never be negative — applies to NUMERIC, PERCENT, and ZERO.
    if (n < 0) return false;
    if (goal.uom === "ZERO" && !Number.isInteger(n)) return false;
    return true;
  })();

  const handleSave = async () => {
    if (!canSave) return;
    setSaving(true);
    await onSave(
      goal.id,
      quarter,
      goal.uom === "TIMELINE" ? null : actual.trim(),
      goal.uom === "TIMELINE" ? actualDate : null,
      status,
    );
    // Outcome (success / error Lottie) is surfaced by the parent CheckInsPage.
    setSaving(false);
  };

  return (
    <div className="rounded-md border border-border/60 bg-card p-4 space-y-3">
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <div className="text-sm font-semibold truncate">{goal.title}</div>
          <div className="text-xs text-muted-foreground mt-0.5">
            {goal.thrust_area} · Target {goal.uom === "TIMELINE" ? goal.target_date : goal.target}
            {goal.uom !== "TIMELINE" && goal.uom !== "ZERO" && (
              <> · {goal.direction === "LOWER" ? "Lower is better" : "Higher is better"}</>
            )}
          </div>
        </div>
        {goal.is_shared && <Badge variant="outline">Shared</Badge>}
      </div>

      {goal.uom === "TIMELINE" && (
        <div className="rounded-md border border-primary/30 bg-primary/[0.08] px-3 py-2 text-xs text-foreground/90">
          <span className="font-medium text-primary">Timeline goal:</span> set the actual
          completion date in the quarter you finished. The score compares it
          against the deadline ({goal.target_date ?? "—"}) — same value across
          quarters once set. Quarters where work was not yet done can stay empty.
        </div>
      )}
      {goal.uom === "ZERO" && (
        <div className="rounded-md border border-destructive/30 bg-destructive/[0.08] px-3 py-2 text-xs text-foreground/90">
          <span className="font-medium text-destructive">Zero-based goal:</span> enter the count
          of incidents/defects that occurred during this quarter. Score is 100%
          only if the count is exactly 0.
        </div>
      )}

      <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
        <div className="space-y-1">
          <Label htmlFor={`actual-${goal.id}`}>{actualLabel(goal.uom)}</Label>
          {goal.uom === "TIMELINE" ? (
            <Input
              id={`actual-${goal.id}`}
              type="date"
              value={actualDate}
              onChange={(e) => setActualDate(e.target.value)}
              disabled={disabled}
            />
          ) : (
            <Input
              id={`actual-${goal.id}`}
              type="number"
              step={goal.uom === "ZERO" ? 1 : "any"}
              min={0}
              inputMode={goal.uom === "ZERO" ? "numeric" : "decimal"}
              value={actual}
              onChange={(e) => setActual(e.target.value)}
              placeholder={goal.uom === "ZERO" ? "0" : "Enter actual"}
              disabled={disabled}
            />
          )}
        </div>

        <div className="space-y-1">
          <Label htmlFor={`status-${goal.id}`}>Status</Label>
          <Select
            value={status}
            onValueChange={(v) => setStatus(v as CheckInStatus)}
            disabled={disabled}
          >
            <SelectTrigger id={`status-${goal.id}`}>
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="NOT_STARTED">{STATUS_LABEL.NOT_STARTED}</SelectItem>
              <SelectItem value="ON_TRACK">{STATUS_LABEL.ON_TRACK}</SelectItem>
              <SelectItem value="COMPLETED">{STATUS_LABEL.COMPLETED}</SelectItem>
            </SelectContent>
          </Select>
        </div>

        <div className="flex items-end">
          <Button
            type="button"
            onClick={handleSave}
            disabled={!canSave}
            className="w-full rounded-sm"
          >
            {saving && <Loader2 className="h-4 w-4 mr-1 animate-spin" />}
            {saving ? "Saving…" : checkIn ? "Update" : "Save"}
          </Button>
        </div>
      </div>

      <CheckInScoreCard
        goal={goal}
        quarter={quarter}
        actual={goal.uom === "TIMELINE" ? null : actual}
        actualDate={goal.uom === "TIMELINE" ? actualDate || null : null}
        score={previewScore}
      />

      {checkIn?.manager_comment && (
        <div className="rounded-md border border-border/60 bg-muted/50 px-3 py-2">
          <div className="text-xs font-medium text-muted-foreground mb-0.5">Manager comment</div>
          <div className="text-sm whitespace-pre-wrap">{checkIn.manager_comment}</div>
        </div>
      )}

      {disabled && disabledReason && (
        <p className="text-xs text-muted-foreground">{disabledReason}</p>
      )}
    </div>
  );
}
