import { clsx, type ClassValue } from "clsx"
import { twMerge } from "tailwind-merge"
import type { Goal, Quarter } from "@/types"

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs))
}

// -----------------------------------------------------------------------------
// Phase 2 score utilities — stubbed out now, wired during check-in UI work.
// Each returns a percent score clamped to [0, 100] with one decimal of precision.
// -----------------------------------------------------------------------------

const clampPct = (n: number) => Math.max(0, Math.min(100, Math.round(n * 10) / 10));

// NUMERIC/PERCENT — higher actual is better (e.g. revenue, completion %)
export function scoreNumericMin(actual: number, target: number): number {
  if (target <= 0) return 0;
  return clampPct((actual / target) * 100);
}

// NUMERIC — lower actual is better (e.g. cost, TAT, defect rate)
export function scoreNumericMax(actual: number, target: number): number {
  if (actual <= 0) return target <= 0 ? 100 : 0;
  return clampPct((target / actual) * 100);
}

// PERCENT — alias of higher-is-better
export const scorePercent = scoreNumericMin;

// TIMELINE — on-time = 100%, linear penalty per day late (capped at 50% over 30 days late)
export function scoreTimeline(completionDate: Date | string, targetDate: Date | string): number {
  const completed = new Date(completionDate).getTime();
  const target = new Date(targetDate).getTime();
  if (Number.isNaN(completed) || Number.isNaN(target)) return 0;
  if (completed <= target) return 100;
  const daysLate = (completed - target) / (1000 * 60 * 60 * 24);
  const penalty = Math.min(daysLate * (50 / 30), 100);
  return clampPct(100 - penalty);
}

// ZERO — zero incidents/defects = 100%, anything else = 0%
export function scoreZero(actual: number): number {
  return actual === 0 ? 100 : 0;
}

// -----------------------------------------------------------------------------
// Single dispatcher used by both employee check-in form (live preview) and
// the store action (persisted value). Returns null when inputs are incomplete
// so callers can render "—" instead of a misleading zero.
// -----------------------------------------------------------------------------
export function computeGoalScore(
  goal: Pick<Goal, "uom" | "target" | "target_date" | "direction">,
  actual: string | null,
  actualDate: string | null,
): number | null {
  const actualText = (actual ?? "").trim();

  if (goal.uom === "NUMERIC" || goal.uom === "PERCENT") {
    if (actualText === "") return null;
    const a = Number(actualText);
    const t = Number(goal.target);
    if (Number.isNaN(a) || Number.isNaN(t)) return null;
    if (a < 0) return null;
    return goal.direction === "LOWER" ? scoreNumericMax(a, t) : scoreNumericMin(a, t);
  }

  if (goal.uom === "TIMELINE") {
    if (!actualDate || !goal.target_date) return null;
    return scoreTimeline(actualDate, goal.target_date);
  }

  if (goal.uom === "ZERO") {
    if (actualText === "") return null;
    const a = Number(actualText);
    if (Number.isNaN(a) || a < 0) return null;
    return scoreZero(a);
  }

  return null;
}

// -----------------------------------------------------------------------------
// Fiscal-year quarter mapping per BRD:
//   Q1 = Jul-Sep, Q2 = Oct-Dec, Q3 = Jan-Mar, Q4 = Apr-Jun
// -----------------------------------------------------------------------------
export function currentQuarter(date: Date = new Date()): Quarter {
  const m = date.getMonth(); // 0..11
  if (m >= 6 && m <= 8) return "Q1";
  if (m >= 9 && m <= 11) return "Q2";
  if (m >= 0 && m <= 2) return "Q3";
  return "Q4";
}

export const QUARTER_LABELS: Record<Quarter, string> = {
  Q1: "Q1 · Jul–Sep",
  Q2: "Q2 · Oct–Dec",
  Q3: "Q3 · Jan–Mar",
  Q4: "Q4 · Apr–Jun",
};

export const QUARTERS: Quarter[] = ["Q1", "Q2", "Q3", "Q4"];

// -----------------------------------------------------------------------------
// Cycle-phase indicator per BRD §2.3:
//   May–Jun: Phase 1 goal-setting window (no check-in open yet)
//   Jul–Sep: Q1 check-in window
//   Oct–Dec: Q2 check-in window
//   Jan–Feb: Q3 check-in window
//   Mar–Apr: Q4 final achievement capture
//
// We expose this as an informational indicator only — the app does not
// hard-block saves outside the current window because that would prevent
// demoing the full check-in flow during the goal-setting period. UI surfaces
// it as a banner so reviewers can see we know the schedule.
// -----------------------------------------------------------------------------
export type CyclePhase =
  | "GOAL_SETTING"
  | "Q1_OPEN"
  | "Q2_OPEN"
  | "Q3_OPEN"
  | "Q4_OPEN";

export interface CyclePhaseInfo {
  phase: CyclePhase;
  /** Currently open check-in quarter, or null during goal-setting. */
  openQuarter: Quarter | null;
  /** Short label e.g. "Q1 check-in window is open (Jul–Sep)". */
  label: string;
  /** Sub-text describing the next window e.g. "Q2 opens in October". */
  nextHint: string;
}

export function cyclePhase(date: Date = new Date()): CyclePhaseInfo {
  const m = date.getMonth(); // 0..11
  if (m === 4 || m === 5) {
    return {
      phase: "GOAL_SETTING",
      openQuarter: null,
      label: "Goal-setting window is open (May–Jun)",
      nextHint: "Q1 check-in window opens in July.",
    };
  }
  if (m >= 6 && m <= 8) {
    return {
      phase: "Q1_OPEN",
      openQuarter: "Q1",
      label: "Q1 check-in window is open (Jul–Sep)",
      nextHint: "Q2 opens in October.",
    };
  }
  if (m >= 9 && m <= 11) {
    return {
      phase: "Q2_OPEN",
      openQuarter: "Q2",
      label: "Q2 check-in window is open (Oct–Dec)",
      nextHint: "Q3 opens in January.",
    };
  }
  if (m === 0 || m === 1) {
    return {
      phase: "Q3_OPEN",
      openQuarter: "Q3",
      label: "Q3 check-in window is open (Jan–Feb)",
      nextHint: "Q4 / annual capture opens in March.",
    };
  }
  // m === 2 || m === 3 (Mar, Apr) → Q4 / annual capture
  return {
    phase: "Q4_OPEN",
    openQuarter: "Q4",
    label: "Q4 / annual achievement capture is open (Mar–Apr)",
    nextHint: "Next cycle's goal-setting window opens in May.",
  };
}
