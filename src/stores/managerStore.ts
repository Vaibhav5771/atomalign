import { create } from "zustand";
import { supabase } from "@/lib/supabase";
import type {
  CheckIn,
  Goal,
  GoalSheet,
  GoalSheetWithEmployee,
  GoalWithCheckIn,
  Profile,
  Quarter,
} from "@/types";

interface ManagerState {
  teamSheets: GoalSheetWithEmployee[];
  reviewSheet: GoalSheet | null;
  reviewEmployee: Profile | null;
  reviewGoals: Goal[];
  reviewReopener: Profile | null;
  selectedEmployeeCheckIns: GoalWithCheckIn[];
  checkInsLoading: boolean;
  loading: boolean;
  error: string | null;

  fetchTeamSheets: (managerId: string) => Promise<void>;
  fetchSheetForReview: (sheetId: string) => Promise<void>;
  updateGoalInline: (goalId: string, patch: Partial<Goal>) => Promise<{ error: string | null }>;
  approveSheet: (sheetId: string, managerId: string, remark: string) => Promise<{ error: string | null }>;
  returnSheet: (sheetId: string, managerId: string, remark: string) => Promise<{ error: string | null }>;
  fetchTeamCheckIns: (employeeId: string, quarter: Quarter) => Promise<void>;
  saveManagerComment: (checkInId: string, comment: string) => Promise<{ error: string | null }>;
  reset: () => void;
}

export const useManagerStore = create<ManagerState>((set, get) => ({
  teamSheets: [],
  reviewSheet: null,
  reviewEmployee: null,
  reviewGoals: [],
  reviewReopener: null,
  selectedEmployeeCheckIns: [],
  checkInsLoading: false,
  loading: false,
  error: null,

  fetchTeamSheets: async (managerId) => {
    set({ loading: true, error: null });

    const { data: reports, error: rErr } = await supabase
      .from("profiles")
      .select("*")
      .eq("manager_id", managerId);

    if (rErr) {
      set({ loading: false, error: rErr.message });
      return;
    }

    const reportIds = (reports ?? []).map((r) => r.id);
    if (reportIds.length === 0) {
      set({ teamSheets: [], loading: false });
      return;
    }

    const { data: sheets, error: sErr } = await supabase
      .from("goal_sheets")
      .select("*")
      .in("employee_id", reportIds)
      .order("updated_at", { ascending: false });

    if (sErr) {
      set({ loading: false, error: sErr.message });
      return;
    }

    const empById = new Map((reports ?? []).map((r) => [r.id, r as Profile]));
    const teamSheets: GoalSheetWithEmployee[] = (sheets ?? []).map((s: any) => {
      const e = empById.get(s.employee_id);
      return {
        ...(s as GoalSheet),
        employee: {
          id: e?.id ?? s.employee_id,
          full_name: e?.full_name ?? "",
          email: e?.email ?? "",
          department: e?.department ?? null,
        },
      };
    });

    // Also include reports with NO sheet yet (status displayed as "Not started")
    const sheetEmployeeIds = new Set(teamSheets.map((t) => t.employee_id));
    for (const r of reports ?? []) {
      if (!sheetEmployeeIds.has(r.id)) {
        teamSheets.push({
          id: "",
          employee_id: r.id,
          cycle_year: new Date().getFullYear(),
          status: "DRAFT",
          submitted_at: null,
          approved_at: null,
          manager_remark: null,
          reopened_by: null,
          reopened_at: null,
          created_at: "",
          updated_at: "",
          employee: {
            id: r.id,
            full_name: r.full_name,
            email: r.email,
            department: r.department,
          },
        });
      }
    }

    set({ teamSheets, loading: false });
  },

  fetchSheetForReview: async (sheetId) => {
    set({ loading: true, error: null });

    const { data: sheet, error: sErr } = await supabase
      .from("goal_sheets")
      .select("*")
      .eq("id", sheetId)
      .single();
    if (sErr) {
      set({ loading: false, error: sErr.message });
      return;
    }

    const [{ data: employee }, { data: goals, error: gErr }] = await Promise.all([
      supabase.from("profiles").select("*").eq("id", sheet.employee_id).single(),
      supabase
        .from("goals")
        .select("*")
        .eq("sheet_id", sheetId)
        .order("created_at", { ascending: true }),
    ]);

    if (gErr) {
      set({ loading: false, error: gErr.message });
      return;
    }

    let reopener: Profile | null = null;
    if (sheet.reopened_by) {
      const { data: rData } = await supabase
        .from("profiles")
        .select("*")
        .eq("id", sheet.reopened_by)
        .maybeSingle();
      reopener = (rData as Profile) ?? null;
    }

    set({
      reviewSheet: sheet as GoalSheet,
      reviewEmployee: (employee as Profile) ?? null,
      reviewGoals: (goals ?? []) as Goal[],
      reviewReopener: reopener,
      loading: false,
    });
  },

  updateGoalInline: async (goalId, patch) => {
    const { data, error } = await supabase
      .from("goals")
      .update(patch)
      .eq("id", goalId)
      .select()
      .single();
    if (error) return { error: error.message };
    set({
      reviewGoals: get().reviewGoals.map((g) => (g.id === goalId ? (data as Goal) : g)),
    });
    return { error: null };
  },

  approveSheet: async (sheetId, managerId, remark) => {
    const now = new Date().toISOString();

    // 1. Lock all goals on this sheet
    const { error: lockErr } = await supabase
      .from("goals")
      .update({ is_locked: true })
      .eq("sheet_id", sheetId);
    if (lockErr) return { error: lockErr.message };

    // 2. Transition the sheet. Clearing reopened_by/at signals the reopen
    //    has been resolved by this re-approval.
    const { data: sheet, error: sErr } = await supabase
      .from("goal_sheets")
      .update({
        status: "APPROVED",
        approved_at: now,
        manager_remark: remark || null,
        reopened_by: null,
        reopened_at: null,
      })
      .eq("id", sheetId)
      .select()
      .single();
    if (sErr) return { error: sErr.message };

    // 3. Audit log
    await supabase.from("audit_logs").insert({
      sheet_id: sheetId,
      changed_by: managerId,
      action: "APPROVE",
      new_value: { status: "APPROVED", remark },
    });

    set({ reviewSheet: sheet as GoalSheet });
    return { error: null };
  },

  returnSheet: async (sheetId, managerId, remark) => {
    const { data: sheet, error } = await supabase
      .from("goal_sheets")
      .update({ status: "RETURNED", manager_remark: remark || null, submitted_at: null })
      .eq("id", sheetId)
      .select()
      .single();
    if (error) return { error: error.message };

    await supabase.from("audit_logs").insert({
      sheet_id: sheetId,
      changed_by: managerId,
      action: "RETURN",
      new_value: { status: "RETURNED", remark },
    });

    set({ reviewSheet: sheet as GoalSheet });
    return { error: null };
  },

  fetchTeamCheckIns: async (employeeId, quarter) => {
    set({ checkInsLoading: true, selectedEmployeeCheckIns: [], error: null });

    // 1. Find the employee's APPROVED sheet
    const { data: sheet, error: sErr } = await supabase
      .from("goal_sheets")
      .select("id, status")
      .eq("employee_id", employeeId)
      .eq("status", "APPROVED")
      .maybeSingle();

    if (sErr) {
      set({ checkInsLoading: false, error: sErr.message });
      return;
    }
    if (!sheet) {
      set({ checkInsLoading: false, selectedEmployeeCheckIns: [] });
      return;
    }

    // 2. Goals on that sheet
    const { data: goals, error: gErr } = await supabase
      .from("goals")
      .select("*")
      .eq("sheet_id", sheet.id)
      .order("created_at", { ascending: true });

    if (gErr) {
      set({ checkInsLoading: false, error: gErr.message });
      return;
    }

    const goalList = (goals ?? []) as Goal[];
    if (goalList.length === 0) {
      set({ checkInsLoading: false, selectedEmployeeCheckIns: [] });
      return;
    }

    // 3. Check-ins for that quarter for those goals
    const { data: cis, error: cErr } = await supabase
      .from("check_ins")
      .select("*")
      .in(
        "goal_id",
        goalList.map((g) => g.id),
      )
      .eq("quarter", quarter);

    if (cErr) {
      set({ checkInsLoading: false, error: cErr.message });
      return;
    }

    const ciByGoal = new Map<string, CheckIn>();
    for (const ci of (cis ?? []) as CheckIn[]) ciByGoal.set(ci.goal_id, ci);

    const rows: GoalWithCheckIn[] = goalList.map((g) => ({
      goal: g,
      checkIn: ciByGoal.get(g.id) ?? null,
    }));

    set({ selectedEmployeeCheckIns: rows, checkInsLoading: false });
  },

  saveManagerComment: async (checkInId, comment) => {
    const { data: userData } = await supabase.auth.getUser();
    const uid = userData.user?.id;
    if (!uid) return { error: "Not signed in" };

    const trimmed = comment.trim();
    const value = trimmed === "" ? null : trimmed;

    const { data, error } = await supabase
      .from("check_ins")
      .update({ manager_comment: value })
      .eq("id", checkInId)
      .select()
      .single();
    if (error) return { error: error.message };

    const updated = data as CheckIn;

    await supabase.from("audit_logs").insert({
      goal_id: updated.goal_id,
      changed_by: uid,
      action: "MANAGER_COMMENT_SAVED",
      new_value: { check_in_id: checkInId, comment: value },
    });

    set({
      selectedEmployeeCheckIns: get().selectedEmployeeCheckIns.map((row) =>
        row.checkIn?.id === checkInId
          ? { ...row, checkIn: { ...row.checkIn, manager_comment: value } }
          : row,
      ),
    });
    return { error: null };
  },

  reset: () =>
    set({
      teamSheets: [],
      reviewSheet: null,
      reviewEmployee: null,
      reviewGoals: [],
      reviewReopener: null,
      selectedEmployeeCheckIns: [],
      error: null,
    }),
}));
