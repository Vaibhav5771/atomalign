export type UserRole = "EMPLOYEE" | "MANAGER" | "ADMIN";

export type SheetStatus = "DRAFT" | "SUBMITTED" | "APPROVED" | "RETURNED";

export type UoMType = "NUMERIC" | "PERCENT" | "TIMELINE" | "ZERO";

export type ScoreDirection = "HIGHER" | "LOWER";

export type Quarter = "Q1" | "Q2" | "Q3" | "Q4";

export type CheckInStatus = "NOT_STARTED" | "ON_TRACK" | "COMPLETED";

export interface Profile {
  id: string;
  full_name: string;
  email: string;
  role: UserRole;
  manager_id: string | null;
  department: string | null;
  created_at: string;
}

export interface GoalSheet {
  id: string;
  employee_id: string;
  cycle_year: number;
  status: SheetStatus;
  submitted_at: string | null;
  approved_at: string | null;
  manager_remark: string | null;
  reopened_by: string | null;
  reopened_at: string | null;
  created_at: string;
  updated_at: string;
}

export interface Goal {
  id: string;
  sheet_id: string;
  thrust_area: string;
  title: string;
  description: string | null;
  uom: UoMType;
  target: string;
  target_date: string | null;
  weightage: number;
  is_shared: boolean;
  is_locked: boolean;
  shared_by: string | null;
  direction: ScoreDirection;
  created_at: string;
}

export interface CheckIn {
  id: string;
  goal_id: string;
  quarter: Quarter;
  actual: string | null;
  actual_date: string | null;
  status: CheckInStatus;
  manager_comment: string | null;
  score: number | null;
  created_at: string;
  updated_at: string;
}

export interface GoalWithCheckIn {
  goal: Goal;
  checkIn: CheckIn | null;
}

export interface AnalyticsRow {
  employee_id: string;
  employee_name: string;
  department: string | null;
  manager_id: string | null;
  manager_name: string | null;
  goal_id: string;
  goal_title: string;
  thrust_area: string;
  uom: UoMType;
  target: string;
  weightage: number;
  sheet_status: SheetStatus;
  quarter: Quarter | null;
  actual: string | null;
  score: number | null;
  checkin_status: CheckInStatus | null;
}

export interface SharedByProfile {
  id: string;
  full_name: string;
  email: string;
  role: UserRole;
}

export interface SharedGoal {
  id: string;
  source_goal_id: string;
  employee_id: string;
  weightage: number;
  created_at: string;
}

export interface AuditLog {
  id: string;
  goal_id: string | null;
  sheet_id: string | null;
  changed_by: string | null;
  action: string;
  old_value: Record<string, unknown> | null;
  new_value: Record<string, unknown> | null;
  created_at: string;
}

export interface GoalSheetWithEmployee extends GoalSheet {
  employee: Pick<Profile, "id" | "full_name" | "email" | "department">;
}

export type GoalDraft = Omit<Goal, "id" | "sheet_id" | "is_locked" | "created_at">;
