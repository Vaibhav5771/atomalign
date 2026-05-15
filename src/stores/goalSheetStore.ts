import { create } from "zustand";
import { supabase } from "@/lib/supabase";
import type { Goal, GoalDraft, GoalSheet, SharedGoal } from "@/types";

export interface SharedAssignment {
  link: SharedGoal;
  source: Goal;
}

interface GoalSheetState {
  currentSheet: GoalSheet | null;
  goals: Goal[];
  sharedAssignments: SharedAssignment[];
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
  reset: () => void;
}

const CURRENT_CYCLE_YEAR = new Date().getFullYear();
export const currentCycleYear = CURRENT_CYCLE_YEAR;

export const useGoalSheetStore = create<GoalSheetState>((set, get) => ({
  currentSheet: null,
  goals: [],
  sharedAssignments: [],
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

    const { data: sheet, error: sheetErr } = await supabase
      .from("goal_sheets")
      .select("*")
      .eq("employee_id", employeeId)
      .eq("cycle_year", cycleYear)
      .maybeSingle();

    if (sheetErr) {
      set({ loading: false, error: sheetErr.message });
      return;
    }

    if (!sheet) {
      set({ currentSheet: null, goals: [], sharedAssignments: [], loading: false });
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
      set({ loading: false, error: goalsErr?.message ?? sharedErr?.message ?? "Load failed" });
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

    set({
      currentSheet: sheet as GoalSheet,
      goals: (goals ?? []) as Goal[],
      sharedAssignments,
      loading: false,
    });
  },

  createSheet: async (employeeId, cycleYear) => {
    set({ loading: true, error: null });
    const { data, error } = await supabase
      .from("goal_sheets")
      .insert({ employee_id: employeeId, cycle_year: cycleYear, status: "DRAFT" })
      .select()
      .single();
    if (error) {
      set({ loading: false, error: error.message });
      return null;
    }
    set({ currentSheet: data as GoalSheet, goals: [], loading: false });
    return data as GoalSheet;
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
    return { error: null };
  },

  reset: () => set({ currentSheet: null, goals: [], sharedAssignments: [], error: null }),
}));
