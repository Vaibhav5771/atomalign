import { clsx, type ClassValue } from "clsx"
import { twMerge } from "tailwind-merge"

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
