import { create } from "zustand";
import { supabase } from "@/lib/supabase";
import type {
  AuditLog,
  CheckIn,
  CheckInStatus,
  Goal,
  Profile,
  Quarter,
  SheetStatus,
  UoMType,
} from "@/types";

// -----------------------------------------------------------------------------
// Row shapes
// -----------------------------------------------------------------------------
export type CompletionState = "COMPLETED" | "IN_PROGRESS" | "NOT_STARTED";

export interface CompletionRow {
  employee_id: string;
  employee_name: string;
  employee_email: string;
  department: string | null;
  manager_id: string | null;
  manager_name: string | null;
  quarters: Record<Quarter, CompletionState>;
}

export interface AchievementRow {
  employee_id: string;
  employee_name: string;
  department: string | null;
  sheet_status: SheetStatus;
  goal_id: string;
  goal_title: string;
  thrust_area: string;
  uom: UoMType;
  target: string;
  weightage: number;
  q1_actual: string | null;
  q2_actual: string | null;
  q3_actual: string | null;
  q4_actual: string | null;
  score: number | null;
}

export interface AuditRow extends AuditLog {
  changed_by_name: string | null;
  goal_title: string | null;
}

interface ReportsState {
  completion: CompletionRow[];
  achievement: AchievementRow[];
  audit: AuditRow[];
  loadingCompletion: boolean;
  loadingAchievement: boolean;
  loadingAudit: boolean;
  error: string | null;

  fetchCompletion: () => Promise<void>;
  fetchAchievement: () => Promise<void>;
  fetchAudit: () => Promise<void>;
}

const QUARTERS: Quarter[] = ["Q1", "Q2", "Q3", "Q4"];

function quarterFromCheckIns(
  checkIns: CheckIn[],
  totalGoals: number,
  quarter: Quarter,
): CompletionState {
  const forQ = checkIns.filter((c) => c.quarter === quarter);
  if (forQ.length === 0) return "NOT_STARTED";
  const completed = forQ.filter((c) => c.status === "COMPLETED").length;
  if (completed === totalGoals && totalGoals > 0) return "COMPLETED";
  return "IN_PROGRESS";
}

// -----------------------------------------------------------------------------
// Store
// -----------------------------------------------------------------------------
export const useReportsStore = create<ReportsState>((set) => ({
  completion: [],
  achievement: [],
  audit: [],
  loadingCompletion: false,
  loadingAchievement: false,
  loadingAudit: false,
  error: null,

  // ---------------------------------------------------------------------------
  // Completion Dashboard — per-employee × per-quarter status pill.
  // Only considers APPROVED sheets (employees without approval have no check-in
  // surface to track).
  // ---------------------------------------------------------------------------
  fetchCompletion: async () => {
    set({ loadingCompletion: true, error: null });

    // Pull every employee profile up-front so the table includes people with
    // zero APPROVED sheets too (status NOT_STARTED across the board).
    const { data: profiles, error: pErr } = await supabase
      .from("profiles")
      .select("*")
      .eq("role", "EMPLOYEE");
    if (pErr) {
      set({ loadingCompletion: false, error: pErr.message });
      return;
    }

    const { data: managers } = await supabase
      .from("profiles")
      .select("id, full_name, email")
      .eq("role", "MANAGER");
    const managerById = new Map<string, { full_name: string; email: string }>();
    for (const m of managers ?? []) {
      managerById.set(m.id, { full_name: m.full_name, email: m.email });
    }

    const employees = (profiles ?? []) as Profile[];
    if (employees.length === 0) {
      set({ completion: [], loadingCompletion: false });
      return;
    }

    // Approved sheets only — completion is meaningless on non-approved sheets.
    const { data: sheets, error: sErr } = await supabase
      .from("goal_sheets")
      .select("id, employee_id")
      .eq("status", "APPROVED")
      .in(
        "employee_id",
        employees.map((e) => e.id),
      );
    if (sErr) {
      set({ loadingCompletion: false, error: sErr.message });
      return;
    }

    const sheetIds = (sheets ?? []).map((s) => s.id);
    const sheetByEmployee = new Map<string, string>();
    for (const s of sheets ?? []) sheetByEmployee.set(s.employee_id, s.id);

    // Goals on approved sheets
    let goalsBySheet: Map<string, Goal[]> = new Map();
    let checkInsByGoal: Map<string, CheckIn[]> = new Map();
    if (sheetIds.length > 0) {
      const { data: goals } = await supabase
        .from("goals")
        .select("*")
        .in("sheet_id", sheetIds);
      for (const g of (goals ?? []) as Goal[]) {
        const list = goalsBySheet.get(g.sheet_id) ?? [];
        list.push(g);
        goalsBySheet.set(g.sheet_id, list);
      }

      const goalIds = (goals ?? []).map((g) => g.id);
      if (goalIds.length > 0) {
        const { data: cis } = await supabase
          .from("check_ins")
          .select("*")
          .in("goal_id", goalIds);
        for (const c of (cis ?? []) as CheckIn[]) {
          const list = checkInsByGoal.get(c.goal_id) ?? [];
          list.push(c);
          checkInsByGoal.set(c.goal_id, list);
        }
      }
    }

    const rows: CompletionRow[] = employees.map((e) => {
      const sheetId = sheetByEmployee.get(e.id);
      const myGoals = sheetId ? goalsBySheet.get(sheetId) ?? [] : [];
      const myCheckIns = myGoals.flatMap((g) => checkInsByGoal.get(g.id) ?? []);
      const quarterMap: Record<Quarter, CompletionState> = {
        Q1: "NOT_STARTED",
        Q2: "NOT_STARTED",
        Q3: "NOT_STARTED",
        Q4: "NOT_STARTED",
      };
      for (const q of QUARTERS) {
        quarterMap[q] = quarterFromCheckIns(myCheckIns, myGoals.length, q);
      }
      const manager = e.manager_id ? managerById.get(e.manager_id) : null;
      return {
        employee_id: e.id,
        employee_name: e.full_name || e.email,
        employee_email: e.email,
        department: e.department,
        manager_id: e.manager_id,
        manager_name: manager ? manager.full_name || manager.email : null,
        quarters: quarterMap,
      };
    });

    rows.sort((a, b) => a.employee_name.localeCompare(b.employee_name));
    set({ completion: rows, loadingCompletion: false });
  },

  // ---------------------------------------------------------------------------
  // Achievement Export — one row per (employee × goal). Quarter actuals come
  // from check_ins; score is the latest non-null quarter score.
  // Includes all sheet statuses so admins can see who is in DRAFT / SUBMITTED
  // too. Non-APPROVED sheets will have blank Q-actuals.
  // ---------------------------------------------------------------------------
  fetchAchievement: async () => {
    set({ loadingAchievement: true, error: null });

    const { data: sheets, error: sErr } = await supabase
      .from("goal_sheets")
      .select("id, status, employee_id");
    if (sErr) {
      set({ loadingAchievement: false, error: sErr.message });
      return;
    }
    const sheetById = new Map<string, { status: SheetStatus; employee_id: string }>();
    for (const s of sheets ?? []) {
      sheetById.set(s.id, {
        status: s.status as SheetStatus,
        employee_id: s.employee_id,
      });
    }

    const { data: profiles, error: pErr } = await supabase
      .from("profiles")
      .select("id, full_name, email, department");
    if (pErr) {
      set({ loadingAchievement: false, error: pErr.message });
      return;
    }
    const profileById = new Map<string, Profile>();
    for (const p of profiles ?? []) {
      profileById.set(p.id, p as Profile);
    }

    const { data: goals, error: gErr } = await supabase
      .from("goals")
      .select("*");
    if (gErr) {
      set({ loadingAchievement: false, error: gErr.message });
      return;
    }
    const goalList = (goals ?? []) as Goal[];
    if (goalList.length === 0) {
      set({ achievement: [], loadingAchievement: false });
      return;
    }

    const { data: cis } = await supabase.from("check_ins").select("*");
    const checkInsByGoal = new Map<string, CheckIn[]>();
    for (const c of (cis ?? []) as CheckIn[]) {
      const list = checkInsByGoal.get(c.goal_id) ?? [];
      list.push(c);
      checkInsByGoal.set(c.goal_id, list);
    }

    const rows: AchievementRow[] = goalList.flatMap((g) => {
      const sheet = sheetById.get(g.sheet_id);
      if (!sheet) return [];
      const employee = profileById.get(sheet.employee_id);
      if (!employee) return [];
      const my = checkInsByGoal.get(g.id) ?? [];
      const byQ = new Map<Quarter, CheckIn>(my.map((c) => [c.quarter, c]));

      const pickActual = (q: Quarter): string | null => {
        const c = byQ.get(q);
        if (!c) return null;
        return g.uom === "TIMELINE" ? c.actual_date : c.actual;
      };

      // Latest non-null score from Q4 → Q1
      let latestScore: number | null = null;
      for (const q of ["Q4", "Q3", "Q2", "Q1"] as Quarter[]) {
        const s = byQ.get(q)?.score;
        if (s != null) {
          latestScore = Number(s);
          break;
        }
      }

      return [
        {
          employee_id: employee.id,
          employee_name: employee.full_name || employee.email,
          department: employee.department,
          sheet_status: sheet.status,
          goal_id: g.id,
          goal_title: g.title,
          thrust_area: g.thrust_area,
          uom: g.uom,
          target: g.uom === "TIMELINE" ? g.target_date ?? g.target : g.target,
          weightage: g.weightage,
          q1_actual: pickActual("Q1"),
          q2_actual: pickActual("Q2"),
          q3_actual: pickActual("Q3"),
          q4_actual: pickActual("Q4"),
          score: latestScore,
        },
      ];
    });

    rows.sort((a, b) => a.employee_name.localeCompare(b.employee_name));
    set({ achievement: rows, loadingAchievement: false });
  },

  // ---------------------------------------------------------------------------
  // Audit Trail — every audit_logs row, newest first, with changed_by name
  // and (best-effort) goal title resolution.
  // ---------------------------------------------------------------------------
  fetchAudit: async () => {
    set({ loadingAudit: true, error: null });

    const { data: logs, error } = await supabase
      .from("audit_logs")
      .select("*")
      .order("created_at", { ascending: false })
      .limit(500);
    if (error) {
      set({ loadingAudit: false, error: error.message });
      return;
    }

    const logList = (logs ?? []) as AuditLog[];
    const userIds = Array.from(
      new Set(logList.map((l) => l.changed_by).filter((x): x is string => !!x)),
    );
    const goalIds = Array.from(
      new Set(logList.map((l) => l.goal_id).filter((x): x is string => !!x)),
    );

    const [userResp, goalResp] = await Promise.all([
      userIds.length > 0
        ? supabase
            .from("profiles")
            .select("id, full_name, email")
            .in("id", userIds)
        : Promise.resolve({ data: [] as { id: string; full_name: string; email: string }[] }),
      goalIds.length > 0
        ? supabase.from("goals").select("id, title").in("id", goalIds)
        : Promise.resolve({ data: [] as { id: string; title: string }[] }),
    ]);

    const userById = new Map<string, string>();
    for (const u of userResp.data ?? []) {
      userById.set(u.id, u.full_name || u.email);
    }
    const goalById = new Map<string, string>();
    for (const g of goalResp.data ?? []) {
      goalById.set(g.id, g.title);
    }

    const rows: AuditRow[] = logList.map((l) => ({
      ...l,
      changed_by_name: l.changed_by ? userById.get(l.changed_by) ?? null : null,
      goal_title: l.goal_id ? goalById.get(l.goal_id) ?? null : null,
    }));

    set({ audit: rows, loadingAudit: false });
  },
}));

// Re-export for typing convenience
export type { CheckInStatus, Quarter };
