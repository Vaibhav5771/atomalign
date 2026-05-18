import { Badge } from "@/components/ui/badge";
import { cn, QUARTER_LABELS } from "@/lib/utils";
import type { Goal, Quarter } from "@/types";

interface Props {
  goal: Pick<Goal, "uom" | "target" | "target_date">;
  quarter: Quarter;
  actual: string | null;
  actualDate: string | null;
  score: number | null;
}

function scoreClass(score: number | null) {
  if (score == null) return "text-muted-foreground";
  if (score >= 100) return "text-emerald-600";
  if (score >= 75) return "text-amber-600";
  return "text-rose-600";
}

function formatActual(uom: Goal["uom"], actual: string | null, actualDate: string | null) {
  if (uom === "TIMELINE") return actualDate ?? "—";
  return actual && actual.trim() !== "" ? actual : "—";
}

function formatTarget(goal: Pick<Goal, "uom" | "target" | "target_date">) {
  if (goal.uom === "TIMELINE") return goal.target_date ?? "—";
  return goal.target;
}

export function CheckInScoreCard({ goal, quarter, actual, actualDate, score }: Props) {
  return (
    <div className="flex items-center gap-3 rounded-md border border-border/60 bg-card px-3 py-2">
      <Badge variant="secondary">{goal.uom}</Badge>
      <span className="text-xs text-muted-foreground">{QUARTER_LABELS[quarter]}</span>
      <div className="ml-auto flex items-center gap-4 text-sm">
        <div>
          <div className="text-xs text-muted-foreground">Target</div>
          <div className="font-medium">{formatTarget(goal)}</div>
        </div>
        <div>
          <div className="text-xs text-muted-foreground">Actual</div>
          <div className="font-medium">{formatActual(goal.uom, actual, actualDate)}</div>
        </div>
        <div>
          <div className="text-xs text-muted-foreground">Score</div>
          <div className={cn("font-semibold tabular-nums", scoreClass(score))}>
            {score == null ? "—" : `${score.toFixed(1)}%`}
          </div>
        </div>
      </div>
    </div>
  );
}
