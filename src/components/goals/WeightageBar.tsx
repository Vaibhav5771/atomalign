import { cn } from "@/lib/utils";

export function WeightageBar({ total }: { total: number }) {
  const pct = Math.min(100, Math.max(0, total));
  const isExact = total === 100;
  const isOver = total > 100;

  return (
    <div className="space-y-1.5">
      <div className="flex items-center justify-between text-xs">
        <span className="font-medium">Total weightage</span>
        <span
          className={cn(
            "font-mono tabular-nums",
            isExact ? "text-green-700 dark:text-green-400" : "text-destructive",
          )}
        >
          {total}% / 100%
        </span>
      </div>
      <div className="h-2 w-full rounded-none bg-muted overflow-hidden">
        <div
          className={cn(
            "h-full transition-all",
            isExact ? "bg-green-600" : isOver ? "bg-destructive" : "bg-destructive/70",
          )}
          style={{ width: `${pct}%` }}
        />
      </div>
      {!isExact && (
        <p className="text-xs text-muted-foreground">
          {isOver
            ? `Over allocation by ${total - 100}% — reduce weightage to reach exactly 100%.`
            : `Need ${100 - total}% more to submit.`}
        </p>
      )}
    </div>
  );
}
