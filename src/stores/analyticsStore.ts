import { create } from "zustand";
import { supabase } from "@/lib/supabase";
import type { AnalyticsRow } from "@/types";

interface AnalyticsState {
  summary: AnalyticsRow[];
  loading: boolean;
  error: string | null;
  fetchAnalytics: () => Promise<void>;
  reset: () => void;
}

export const useAnalyticsStore = create<AnalyticsState>((set) => ({
  summary: [],
  loading: false,
  error: null,

  fetchAnalytics: async () => {
    set({ loading: true, error: null });
    const { data, error } = await supabase
      .from("analytics_summary")
      .select("*");
    if (error) {
      set({ loading: false, error: error.message });
      return;
    }
    // Score arrives as numeric — coerce to number so chart math is safe.
    const rows = (data ?? []).map((r) => ({
      ...r,
      score: r.score == null ? null : Number(r.score),
    })) as AnalyticsRow[];
    set({ summary: rows, loading: false });
  },

  reset: () => set({ summary: [], loading: false, error: null }),
}));
