import { Button } from "@/components/ui/button";
import { currentQuarter, QUARTER_LABELS, QUARTERS } from "@/lib/utils";
import type { Quarter } from "@/types";

interface Props {
  activeQuarter: Quarter;
  onQuarterChange: (q: Quarter) => void;
}

export function QuarterSelector({ activeQuarter, onQuarterChange }: Props) {
  const now = currentQuarter();
  return (
    <div className="inline-flex gap-1 rounded-md border border-border/60 bg-card p-1">
      {QUARTERS.map((q) => {
        const isActive = q === activeQuarter;
        const isCurrent = q === now;
        return (
          <Button
            key={q}
            type="button"
            size="sm"
            variant={isActive ? "default" : "ghost"}
            onClick={() => onQuarterChange(q)}
            title={QUARTER_LABELS[q]}
            aria-pressed={isActive}
            className="relative rounded-sm px-4"
          >
            {q}
            {isCurrent && !isActive && (
              <span className="absolute -top-0.5 -right-0.5 h-1.5 w-1.5 rounded-full bg-primary" />
            )}
          </Button>
        );
      })}
    </div>
  );
}
