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
    try {
      // Phase 3 optimization: collapse the 5 sequential round-trips
      // (profiles → managers → sheets → goals → check-ins) into a single
      // RPC call. See supabase/migrations/0012_get_completion_report.sql.
      const { data, error } = await supabase.rpc("get_completion_report");
      if (error) {
        set({ error: error.message });
        return;
      }
      const rows = ((data ?? []) as CompletionRow[]).slice().sort((a, b) =>
        a.employee_name.localeCompare(b.employee_name),
      );
      set({ completion: rows });
    } catch (e) {
      set({ error: e instanceof Error ? e.message : String(e) });
    } finally {
      set({ loadingCompletion: false });
    }
  },

  // ---------------------------------------------------------------------------
  // Achievement Export — one row per (employee × goal). Quarter actuals come
  // from check_ins; score is the latest non-null quarter score.
  // Includes all sheet statuses so admins can see who is in DRAFT / SUBMITTED
  // too. Non-APPROVED sheets will have blank Q-actuals.
  // ---------------------------------------------------------------------------
  fetchAchievement: async () => {
    set({ loadingAchievement: true, error: null });
    try {
      const { data: sheets, error: sErr } = await supabase
        .from("goal_sheets")
        .select("id, status, employee_id");
      if (sErr) {
        set({ error: sErr.message });
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
        set({ error: pErr.message });
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
        set({ error: gErr.message });
        return;
      }
      const goalList = (goals ?? []) as Goal[];
      if (goalList.length === 0) {
        set({ achievement: [] });
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
      set({ achievement: rows });
    } catch (e) {
      set({ error: e instanceof Error ? e.message : String(e) });
    } finally {
      set({ loadingAchievement: false });
    }
  },

  // ---------------------------------------------------------------------------
  // Audit Trail — every audit_logs row, newest first, with changed_by name
  // and (best-effort) goal title resolution.
  // ---------------------------------------------------------------------------
  fetchAudit: async () => {
    set({ loadingAudit: true, error: null });
    try {
      const { data: logs, error } = await supabase
        .from("audit_logs")
        .select("*")
        .order("created_at", { ascending: false })
        .limit(500);
      if (error) {
        set({ error: error.message });
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

      set({ audit: rows });
    } catch (e) {
      set({ error: e instanceof Error ? e.message : String(e) });
    } finally {
      set({ loadingAudit: false });
    }
  },
}));

// Re-export for typing convenience
export type { CheckInStatus, Quarter };
