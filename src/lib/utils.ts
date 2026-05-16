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
