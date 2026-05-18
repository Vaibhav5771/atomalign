import { create } from "zustand";
import { supabase } from "@/lib/supabase";
import type {
  Escalation,
  EscalationRule,
  EscalationRuleDraft,
  EscalationWithPeople,
  RunEscalationsResult,
} from "@/types";

interface EscalationsState {
  rules: EscalationRule[];
  log: EscalationWithPeople[];
  running: boolean;
  loading: boolean;
  error: string | null;

  fetchRules: () => Promise<void>;
  createRule: (input: EscalationRuleDraft) => Promise<{ error: string | null }>;
  updateRule: (
    id: string,
    patch: Partial<EscalationRuleDraft>,
  ) => Promise<{ error: string | null }>;
  deleteRule: (id: string) => Promise<{ error: string | null }>;
  clearAllRules: () => Promise<{ error: string | null; cleared: number }>;
  fetchLog: () => Promise<void>;
  runNow: () => Promise<RunEscalationsResult>;
  resolve: (escalationId: string) => Promise<{ error: string | null }>;
  reset: () => void;
}

export const useEscalationsStore = create<EscalationsState>((set, get) => ({
  rules: [],
  log: [],
  running: false,
  loading: false,
  error: null,

  fetchRules: async () => {
    set({ loading: true, error: null });
    try {
      const { data, error } = await supabase
        .from("escalation_rules")
        .select("*")
        .order("created_at", { ascending: true });
      if (error) {
        set({ error: error.message });
        return;
      }
      set({ rules: (data ?? []) as EscalationRule[] });
    } catch (e) {
      set({ error: e instanceof Error ? e.message : String(e) });
    } finally {
      set({ loading: false });
    }
  },

  createRule: async (input) => {
    const { error } = await supabase.from("escalation_rules").insert(input);
    if (error) return { error: error.message };
    await get().fetchRules();
    return { error: null };
  },

  updateRule: async (id, patch) => {
    const { error } = await supabase
      .from("escalation_rules")
      .update(patch)
      .eq("id", id);
    if (error) return { error: error.message };
    set({
      rules: get().rules.map((r) => (r.id === id ? { ...r, ...patch } : r)),
    });
    return { error: null };
  },

  deleteRule: async (id) => {
    const { error } = await supabase
      .from("escalation_rules")
      .delete()
      .eq("id", id);
    if (error) return { error: error.message };
    set({ rules: get().rules.filter((r) => r.id !== id) });
    return { error: null };
  },

  clearAllRules: async () => {
    const ids = get().rules.map((r) => r.id);
    if (ids.length === 0) return { error: null, cleared: 0 };
    const { error } = await supabase
      .from("escalation_rules")
      .delete()
      .in("id", ids);
    if (error) return { error: error.message, cleared: 0 };
    set({ rules: [] });
    // Past log rows keep their hydrated rule_name labels in memory; refresh so
    // the Log tab reflects the ON DELETE SET NULL fallout.
    await get().fetchLog();
    return { error: null, cleared: ids.length };
  },

  fetchLog: async () => {
    set({ loading: true, error: null });
    try {
      const { data: rows, error } = await supabase
        .from("escalations")
        .select("*")
        .order("fired_at", { ascending: false })
        .limit(200);

      if (error) {
        set({ error: error.message });
        return;
      }

      const escalations = (rows ?? []) as Escalation[];

      // Hydrate subject + recipient names and rule names in one batch.
      const userIds = Array.from(
        new Set(
          escalations.flatMap((e) =>
            [e.subject_user_id, e.recipient_user_id].filter(
              (id): id is string => !!id,
            ),
          ),
        ),
      );
      const ruleIds = Array.from(
        new Set(escalations.map((e) => e.rule_id).filter((id): id is string => !!id)),
      );

      const [profilesRes, rulesRes] = await Promise.all([
        userIds.length
          ? supabase
              .from("profiles")
              .select("id, full_name, email")
              .in("id", userIds)
          : Promise.resolve({ data: [] as any[] }),
        ruleIds.length
          ? supabase.from("escalation_rules").select("id, name").in("id", ruleIds)
          : Promise.resolve({ data: [] as any[] }),
      ]);

      const profileMap = new Map<string, { id: string; full_name: string; email: string }>(
        ((profilesRes as any).data ?? []).map((p: any) => [p.id, p]),
      );
      const ruleMap = new Map<string, string>(
        ((rulesRes as any).data ?? []).map((r: any) => [r.id, r.name]),
      );

      const hydrated: EscalationWithPeople[] = escalations.map((e) => ({
        ...e,
        subject: profileMap.get(e.subject_user_id) ?? null,
        recipient: e.recipient_user_id
          ? profileMap.get(e.recipient_user_id) ?? null
          : null,
        rule_name: e.rule_id ? ruleMap.get(e.rule_id) ?? null : null,
      }));

      set({ log: hydrated });
    } catch (e) {
      set({ error: e instanceof Error ? e.message : String(e) });
    } finally {
      set({ loading: false });
    }
  },

  runNow: async () => {
    set({ running: true });
    try {
      const { data, error } = await supabase.functions.invoke(
        "evaluate-escalations",
        { body: {} },
      );
      if (error) {
        return {
          ok: false,
          evaluated_rules: 0,
          fired: 0,
          skipped_duplicates: 0,
          error: error.message,
        };
      }
      // Refresh log to show any new rows
      await get().fetchLog();
      return (data as RunEscalationsResult) ?? {
        ok: true,
        evaluated_rules: 0,
        fired: 0,
        skipped_duplicates: 0,
      };
    } finally {
      set({ running: false });
    }
  },

  resolve: async (escalationId) => {
    const { error } = await supabase
      .from("escalations")
      .update({ resolved_at: new Date().toISOString() })
      .eq("id", escalationId);
    if (error) return { error: error.message };
    set({
      log: get().log.map((e) =>
        e.id === escalationId
          ? { ...e, resolved_at: new Date().toISOString() }
          : e,
      ),
    });
    return { error: null };
  },

  reset: () => set({ rules: [], log: [], error: null }),
}));
