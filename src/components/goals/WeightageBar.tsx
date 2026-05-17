import { cn } from "@/lib/utils";

export function WeightageBar({ total }: { total: number }) {
  const pct = Math.min(100, Math.max(0, total));
  const isExact = total === 100;
  const isOver = total > 100;

  // Color the fill solidly so even small percentages are clearly visible:
  //   over 100  -> red (over-allocated)
  //   100       -> green (ready to submit)
  //   1..99     -> amber (in progress)
  //   0         -> empty
  const fillClass = isOver
    ? "bg-rose-600"
    : isExact
      ? "bg-emerald-600"
      : "bg-amber-500";

  const labelClass = isOver || (!isExact && total > 0)
    ? "text-amber-700 dark:text-amber-400"
    : isExact
      ? "text-emerald-700 dark:text-emerald-400"
      : "text-muted-foreground";

  return (
    <div className="space-y-1.5">
      <div className="flex items-center justify-between text-xs">
        <span className="font-medium">Total weightage</span>
        <span className={cn("font-mono tabular-nums font-semibold", labelClass)}>
          {total}% / 100%
        </span>
      </div>
      <div className="relative h-3 w-full rounded-full bg-muted overflow-hidden border border-border">
        <div
          className={cn("h-full transition-all", fillClass)}
          style={{ width: `${pct}%` }}
        />
      </div>
      {!isExact && (
        <p className={cn("text-xs", isOver ? "text-destructive" : "text-muted-foreground")}>
          {isOver
            ? `Over-allocated by ${total - 100}% — reduce a goal's weightage to reach exactly 100%.`
            : total === 0
              ? "No goals added yet."
              : `Need ${100 - total}% more before you can submit.`}
        </p>
      )}
      {isExact && (
        <p className="text-xs text-emerald-700 dark:text-emerald-400">
          Ready to submit.
        </p>
      )}
    </div>
  );
}
