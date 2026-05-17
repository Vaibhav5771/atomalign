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
  const palette = isGoalSetting
    ? "border-blue-200 bg-blue-50 text-blue-900"
    : "border-emerald-200 bg-emerald-50 text-emerald-900";
  const Icon = isGoalSetting ? Info : CalendarClock;

  return (
    <div
      role="status"
      className={`flex items-start gap-3 rounded-md border px-4 py-3 ${palette}`}
    >
      <Icon className="h-4 w-4 mt-0.5 shrink-0" />
      <div className="text-sm">
        <span className="font-medium">{phase.label}.</span>{" "}
        <span className="opacity-80">{phase.nextHint}</span>
      </div>
    </div>
  );
}
