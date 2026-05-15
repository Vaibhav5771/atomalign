export type UserRole = "EMPLOYEE" | "MANAGER" | "ADMIN";

export type SheetStatus = "DRAFT" | "SUBMITTED" | "APPROVED" | "RETURNED";

export type UoMType = "NUMERIC" | "PERCENT" | "TIMELINE" | "ZERO";

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
  created_at: string;
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
