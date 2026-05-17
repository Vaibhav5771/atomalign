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
  azure_oid?: string | null;
  auth_provider?: string | null;
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

// -- Phase 5.3: Escalation ---------------------------------------------------

export type TriggerType = "SUBMIT_OVERDUE" | "APPROVE_OVERDUE" | "CHECKIN_OVERDUE";
export type EscalateTarget = "EMPLOYEE" | "MANAGER" | "SKIP_LEVEL" | "HR";

export interface EscalationRule {
  id: string;
  name: string;
  trigger_type: TriggerType;
  threshold_days: number;
  escalate_to: EscalateTarget;
  is_active: boolean;
  created_at: string;
}

export type EscalationRuleDraft = Omit<EscalationRule, "id" | "created_at">;

export interface Escalation {
  id: string;
  rule_id: string | null;
  subject_user_id: string;
  recipient_user_id: string | null;
  trigger_type: TriggerType;
  sheet_id: string | null;
  reason_text: string;
  fired_at: string;
  resolved_at: string | null;
}

export interface EscalationWithPeople extends Escalation {
  subject: Pick<Profile, "id" | "full_name" | "email"> | null;
  recipient: Pick<Profile, "id" | "full_name" | "email"> | null;
  rule_name: string | null;
}

export interface RunEscalationsResult {
  ok: boolean;
  evaluated_rules: number;
  fired: number;
  skipped_duplicates: number;
  error?: string;
}
