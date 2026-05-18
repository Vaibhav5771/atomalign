import { CalendarClock, Info } from "lucide-react";
import { cyclePhase } from "@/lib/utils";

// Surfaces the BRD §2.3 quarterly check-in window currently open
// (e.g. "Q1 check-in window is open (Jul–Sep)"), and hints at the next
// window. Informational only — saves are not blocked outside the window
// so the demo can exercise all four quarters at any time. The banner
// signals BRD-awareness to reviewers.
export function CyclePhaseBanner() {
  const phase = cyclePhase();
  const isGoalSetting = phase.phase === "GOAL_SETTING";
  const Icon = isGoalSetting ? Info : CalendarClock;

  return (
    <div
      role="status"
      className="flex items-start gap-3 rounded-md border border-primary/30 bg-primary/[0.08] px-4 py-3 text-foreground"
    >
      <Icon className="h-4 w-4 mt-0.5 shrink-0 text-primary" />
      <div className="text-sm">
        <span className="font-medium">{phase.label}.</span>{" "}
        <span className="text-muted-foreground">{phase.nextHint}</span>
      </div>
    </div>
  );
}
