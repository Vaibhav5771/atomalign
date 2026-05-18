import { create } from "zustand";
import { supabase } from "@/lib/supabase";
import { notify } from "@/lib/notify";
import { computeGoalScore } from "@/lib/utils";
import type {
  CheckIn,
  CheckInStatus,
  Goal,
  GoalDraft,
  GoalSheet,
  Quarter,
  SharedByProfile,
  SharedGoal,
} from "@/types";

export interface SharedAssignment {
  link: SharedGoal;
  source: Goal;
}

interface GoalSheetState {
  currentSheet: GoalSheet | null;
  goals: Goal[];
  sharedAssignments: SharedAssignment[];
  sharerProfiles: Record<string, SharedByProfile>;
  checkIns: Record<string, CheckIn[]>; // keyed by goal_id, array across quarters
  checkInsLoading: boolean;
  loading: boolean;
  error: string | null;

  // computed via selectors
  totalWeightage: () => number;
  canSubmit: () => boolean;

  fetchMySheet: (employeeId: string, cycleYear: number) => Promise<void>;
  createSheet: (employeeId: string, cycleYear: number) => Promise<GoalSheet | null>;
  addGoal: (draft: GoalDraft) => Promise<{ error: string | null }>;
  updateGoal: (id: string, patch: Partial<Goal>) => Promise<{ error: string | null }>;
  deleteGoal: (id: string) => Promise<{ error: string | null }>;
  updateSharedWeightage: (linkId: string, weightage: number) => Promise<{ error: string | null }>;
  submitSheet: () => Promise<{ error: string | null }>;

  fetchCheckIns: (sheetId: string) => Promise<void>;
  saveCheckIn: (
    goalId: string,
    quarter: Quarter,
    actual: string | null,
    actualDate: string | null,
    status: CheckInStatus,
  ) => Promise<{ error: string | null }>;

  reset: () => void;
}

const CURRENT_CYCLE_YEAR = new Date().getFullYear();
export const currentCycleYear = CURRENT_CYCLE_YEAR;

export const useGoalSheetStore = create<GoalSheetState>((set, get) => ({
  currentSheet: null,
  goals: [],
  sharedAssignments: [],
  sharerProfiles: {},
  checkIns: {},
  checkInsLoading: false,
  loading: false,
  error: null,

  totalWeightage: () => {
    const { goals, sharedAssignments } = get();
    const own = goals.reduce((sum, g) => sum + (g.weightage || 0), 0);
    const shared = sharedAssignments.reduce((sum, s) => sum + (s.link.weightage || 0), 0);
    return own + shared;
  },

  canSubmit: () => {
    const { currentSheet, goals, sharedAssignments } = get();
    if (!currentSheet) return false;
    if (currentSheet.status !== "DRAFT" && currentSheet.status !== "RETURNED") return false;
    const total = get().totalWeightage();
    return total === 100 && goals.length + sharedAssignments.length > 0;
  },

  fetchMySheet: async (employeeId, cycleYear) => {
    set({ loading: true, error: null });
    try {
      const { data: sheet, error: sheetErr } = await supabase
        .from("goal_sheets")
        .select("*")
        .eq("employee_id", employeeId)
        .eq("cycle_year", cycleYear)
        .maybeSingle();

      if (sheetErr) {
        set({ error: sheetErr.message });
        return;
      }

      if (!sheet) {
        set({
          currentSheet: null,
          goals: [],
          sharedAssignments: [],
          sharerProfiles: {},
        });
        return;
      }

      const [{ data: goals, error: goalsErr }, { data: shared, error: sharedErr }] =
        await Promise.all([
          supabase
            .from("goals")
            .select("*")
            .eq("sheet_id", sheet.id)
            .order("created_at", { ascending: true }),
          supabase
            .from("shared_goals")
            .select("*, source:goals!source_goal_id(*)")
            .eq("employee_id", employeeId),
        ]);

      if (goalsErr || sharedErr) {
        set({ error: goalsErr?.message ?? sharedErr?.message ?? "Load failed" });
        return;
      }

      const sharedAssignments: SharedAssignment[] = (shared ?? []).map((row: any) => ({
        link: {
          id: row.id,
          source_goal_id: row.source_goal_id,
          employee_id: row.employee_id,
          weightage: row.weightage,
          created_at: row.created_at,
        },
        source: row.source as Goal,
      }));

      const sharerIds = Array.from(
        new Set(
          (goals ?? [])
            .map((g: any) => g.shared_by as string | null)
            .filter((id: string | null): id is string => !!id),
        ),
      );

      const sharerProfiles: Record<string, SharedByProfile> = {};
      if (sharerIds.length > 0) {
        const { data: sharers } = await supabase
          .from("profiles")
          .select("id, full_name, email, role")
          .in("id", sharerIds);
        for (const p of sharers ?? []) {
          sharerProfiles[p.id] = p as SharedByProfile;
        }
      }

      set({
        currentSheet: sheet as GoalSheet,
        goals: (goals ?? []) as Goal[],
        sharedAssignments,
        sharerProfiles,
      });
    } catch (e) {
      set({ error: e instanceof Error ? e.message : String(e) });
    } finally {
      set({ loading: false });
    }
  },

  createSheet: async (employeeId, cycleYear) => {
    set({ loading: true, error: null });
    try {
      const { data, error } = await supabase
        .from("goal_sheets")
        .insert({ employee_id: employeeId, cycle_year: cycleYear, status: "DRAFT" })
        .select()
        .single();
      if (error) {
        set({ error: error.message });
        return null;
      }
      set({ currentSheet: data as GoalSheet, goals: [] });
      return data as GoalSheet;
    } catch (e) {
      set({ error: e instanceof Error ? e.message : String(e) });
      return null;
    } finally {
      set({ loading: false });
    }
  },

  addGoal: async (draft) => {
    const sheet = get().currentSheet;
    if (!sheet) return { error: "No active sheet" };
    if (get().goals.length >= 8) return { error: "Maximum 8 goals per sheet" };

    const { data, error } = await supabase
      .from("goals")
      .insert({ ...draft, sheet_id: sheet.id, is_locked: false })
      .select()
      .single();
    if (error) return { error: error.message };
    set({ goals: [...get().goals, data as Goal] });
    return { error: null };
  },

  updateGoal: async (id, patch) => {
    const { data, error } = await supabase
      .from("goals")
      .update(patch)
      .eq("id", id)
      .select()
      .single();
    if (error) return { error: error.message };
    set({
      goals: get().goals.map((g) => (g.id === id ? (data as Goal) : g)),
    });
    return { error: null };
  },

  deleteGoal: async (id) => {
    const { error } = await supabase.from("goals").delete().eq("id", id);
    if (error) return { error: error.message };
    set({ goals: get().goals.filter((g) => g.id !== id) });
    return { error: null };
  },

  updateSharedWeightage: async (linkId, weightage) => {
    const { error } = await supabase
      .from("shared_goals")
      .update({ weightage })
      .eq("id", linkId);
    if (error) return { error: error.message };
    set({
      sharedAssignments: get().sharedAssignments.map((s) =>
        s.link.id === linkId ? { ...s, link: { ...s.link, weightage } } : s,
      ),
    });
    return { error: null };
  },

  submitSheet: async () => {
    const sheet = get().currentSheet;
    if (!sheet) return { error: "No sheet to submit" };
    if (get().totalWeightage() !== 100) return { error: "Total weightage must equal 100%" };

    const { data, error } = await supabase
      .from("goal_sheets")
      .update({ status: "SUBMITTED", submitted_at: new Date().toISOString() })
      .eq("id", sheet.id)
      .select()
      .single();
    if (error) return { error: error.message };
    set({ currentSheet: data as GoalSheet });

    notify({ event: "submitted", sheetId: sheet.id, actorId: sheet.employee_id });
    return { error: null };
  },

  fetchCheckIns: async (sheetId) => {
    set({ checkInsLoading: true });
    try {
      // First get the goals on this sheet so the IN filter is bounded
      const { data: goals, error: gErr } = await supabase
        .from("goals")
        .select("id")
        .eq("sheet_id", sheetId);

      if (gErr) {
        set({ error: gErr.message });
        return;
      }

      const goalIds = (goals ?? []).map((g) => g.id);
      if (goalIds.length === 0) {
        set({ checkIns: {} });
        return;
      }

      const { data, error } = await supabase
        .from("check_ins")
        .select("*")
        .in("goal_id", goalIds);

      if (error) {
        set({ error: error.message });
        return;
      }

      const map: Record<string, CheckIn[]> = {};
      for (const row of (data ?? []) as CheckIn[]) {
        (map[row.goal_id] ??= []).push(row);
      }
      set({ checkIns: map });
    } catch (e) {
      set({ error: e instanceof Error ? e.message : String(e) });
    } finally {
      set({ checkInsLoading: false });
    }
  },

  saveCheckIn: async (goalId, quarter, actual, actualDate, status) => {
    const sheet = get().currentSheet;
    if (!sheet) return { error: "No active sheet" };
    if (sheet.status !== "APPROVED") {
      return { error: "Goal sheet must be approved before logging check-ins" };
    }

    const goal = get().goals.find((g) => g.id === goalId);
    if (!goal) return { error: "Goal not found" };

    const score = computeGoalScore(goal, actual, actualDate);

    const { data: userData } = await supabase.auth.getUser();
    const uid = userData.user?.id;
    if (!uid) return { error: "Not signed in" };

    const payload = {
      goal_id: goalId,
      quarter,
      actual,
      actual_date: actualDate,
      status,
      score,
    };

    const { data, error } = await supabase
      .from("check_ins")
      .upsert(payload, { onConflict: "goal_id,quarter" })
      .select()
      .single();

    if (error) return { error: error.message };

    const row = data as CheckIn;

    // Audit log — best-effort, do not fail the save if logging fails.
    await supabase.from("audit_logs").insert({
      goal_id: goalId,
      sheet_id: sheet.id,
      changed_by: uid,
      action: "CHECK_IN_SAVED",
      new_value: { quarter, actual, actual_date: actualDate, status, score },
    });

    const prev = get().checkIns[goalId] ?? [];
    const nextForGoal = (() => {
      const filtered = prev.filter((c) => c.quarter !== quarter);
      return [...filtered, row];
    })();
    set({ checkIns: { ...get().checkIns, [goalId]: nextForGoal } });

    notify({
      event: "checkin_saved",
      sheetId: sheet.id,
      actorId: uid,
      quarter,
    });
    return { error: null };
  },

  reset: () =>
    set({
      currentSheet: null,
      goals: [],
      sharedAssignments: [],
      sharerProfiles: {},
      checkIns: {},
      error: null,
    }),
}));
