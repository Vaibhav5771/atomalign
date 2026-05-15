import { create } from "zustand";
import type { Session } from "@supabase/supabase-js";
import { supabase } from "@/lib/supabase";
import type { Profile } from "@/types";

interface AuthState {
  user: Profile | null;
  session: Session | null;
  loading: boolean;
  initialized: boolean;
  init: () => Promise<void>;
  signIn: (email: string, password: string) => Promise<{ error: string | null }>;
  signOut: () => Promise<void>;
  refreshProfile: () => Promise<void>;
}

async function fetchProfile(userId: string): Promise<Profile | null> {
  const { data, error } = await supabase
    .from("profiles")
    .select("*")
    .eq("id", userId)
    .single();
  if (error) {
    console.error("[authStore] fetchProfile error", error);
    return null;
  }
  return data as Profile;
}

export const useAuthStore = create<AuthState>((set, get) => ({
  user: null,
  session: null,
  loading: true,
  initialized: false,

  init: async () => {
    if (get().initialized) return;
    const { data } = await supabase.auth.getSession();
    const session = data.session;
    let profile: Profile | null = null;
    if (session?.user) {
      profile = await fetchProfile(session.user.id);
    }
    set({ session, user: profile, loading: false, initialized: true });

    supabase.auth.onAuthStateChange(async (_event, newSession) => {
      if (newSession?.user) {
        const p = await fetchProfile(newSession.user.id);
        set({ session: newSession, user: p });
      } else {
        set({ session: null, user: null });
      }
    });
  },

  signIn: async (email, password) => {
    set({ loading: true });
    const { data, error } = await supabase.auth.signInWithPassword({ email, password });
    if (error) {
      set({ loading: false });
      return { error: error.message };
    }
    let profile: Profile | null = null;
    if (data.session?.user) {
      profile = await fetchProfile(data.session.user.id);
    }
    set({ session: data.session, user: profile, loading: false });
    return { error: null };
  },

  signOut: async () => {
    // Clear local state immediately so the UI reacts instantly,
    // then fire-and-forget the remote sign-out.
    set({ user: null, session: null });
    try {
      await supabase.auth.signOut();
    } catch (e) {
      console.error("[authStore] signOut error", e);
    }
    // Belt-and-braces: ensure persisted Supabase tokens are cleared even if
    // the SDK call failed mid-request.
    try {
      const projectRef = (import.meta.env.VITE_SUPABASE_URL as string)?.match(
        /https?:\/\/([^.]+)\./,
      )?.[1];
      if (projectRef) {
        window.localStorage.removeItem(`sb-${projectRef}-auth-token`);
      }
    } catch {
      /* noop */
    }
  },

  refreshProfile: async () => {
    const id = get().session?.user.id;
    if (!id) return;
    const p = await fetchProfile(id);
    set({ user: p });
  },
}));
