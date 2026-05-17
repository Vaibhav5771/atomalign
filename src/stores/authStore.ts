import { create } from "zustand";
import { createClient, type Session } from "@supabase/supabase-js";
import { supabase } from "@/lib/supabase";
import { syncProfileFromGraph } from "@/lib/graph";
import type { Profile, UserRole } from "@/types";

export interface AdminCreateUserArgs {
  email: string;
  password: string;
  full_name: string;
  role: UserRole;
  manager_id?: string | null;
  department?: string | null;
}

export interface AdminUpdateUserArgs {
  full_name?: string;
  role?: UserRole;
  manager_id?: string | null;
  department?: string | null;
}

export interface UpdateMyAccountArgs {
  full_name: string;
  email?: string;
  password?: string;
}

interface AuthState {
  user: Profile | null;
  session: Session | null;
  loading: boolean;
  initialized: boolean;
  syncing: boolean;
  init: () => Promise<void>;
  signIn: (email: string, password: string) => Promise<{ error: string | null }>;
  signInWithMicrosoft: () => Promise<{ error: string | null }>;
  signOut: () => Promise<void>;
  refreshProfile: () => Promise<void>;
  adminCreateUser: (
    args: AdminCreateUserArgs,
  ) => Promise<{ error: string | null; userId?: string }>;
  adminUpdateUser: (
    userId: string,
    patch: AdminUpdateUserArgs,
  ) => Promise<{ error: string | null }>;
  adminDeleteUser: (userId: string) => Promise<{ error: string | null }>;
  updateMyAccount: (args: UpdateMyAccountArgs) => Promise<{ error: string | null }>;
  workspaceManagers: Profile[] | null;
  fetchWorkspaceManagers: (force?: boolean) => Promise<Profile[]>;
  workspaceEmployees: Profile[] | null;
  fetchWorkspaceEmployees: (force?: boolean) => Promise<Profile[]>;
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
  syncing: false,
  workspaceManagers: null,

  fetchWorkspaceManagers: async (force = false) => {
    if (!force && get().workspaceManagers !== null) {
      return get().workspaceManagers!;
    }
    const { data } = await supabase
      .from("profiles")
      .select("*")
      .eq("role", "MANAGER")
      .order("full_name", { ascending: true });
    
    const list = (data ?? []) as Profile[];
    set({ workspaceManagers: list });
    return list;
  },

  workspaceEmployees: null,

  fetchWorkspaceEmployees: async (force = false) => {
    if (!force && get().workspaceEmployees !== null) {
      return get().workspaceEmployees!;
    }
    const { data } = await supabase
      .from("profiles")
      .select("*")
      .eq("role", "EMPLOYEE")
      .order("full_name", { ascending: true });
    
    const list = (data ?? []) as Profile[];
    set({ workspaceEmployees: list });
    return list;
  },

  init: async () => {
    if (get().initialized) return;
    const { data } = await supabase.auth.getSession();
    const session = data.session;
    let profile: Profile | null = null;
    if (session?.user) {
      profile = await fetchProfile(session.user.id);
    }
    set({ session, user: profile, loading: false, initialized: true });

    supabase.auth.onAuthStateChange(async (event, newSession) => {
      if (newSession?.user) {
        const isAzureSignIn =
          event === "SIGNED_IN" &&
          newSession.user.app_metadata?.provider === "azure" &&
          !!newSession.provider_token;

        if (isAzureSignIn) {
          set({ syncing: true });
          try {
            await syncProfileFromGraph(newSession.user.id, newSession.provider_token!);
          } catch (e) {
            console.warn("[authStore] graph sync error", e);
          }
        }

        const p = await fetchProfile(newSession.user.id);
        set({ session: newSession, user: p, syncing: false });
      } else {
        set({ session: null, user: null, syncing: false });
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

  signInWithMicrosoft: async () => {
    const redirectTo = `${window.location.origin}/auth/callback`;
    const { error } = await supabase.auth.signInWithOAuth({
      provider: "azure",
      options: {
        redirectTo,
        scopes: "openid email profile User.Read offline_access",
      },
    });
    if (error) return { error: error.message };
    // Browser redirects to Microsoft; the resolved promise above just confirms
    // the redirect URL was generated. No further action needed here.
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

  // Admin creates a new user. Uses an isolated Supabase client so the new
  // user's sign-up session does NOT clobber the admin's persisted session.
  // Profile row is created by the `handle_new_user` trigger; manager_id /
  // department are patched afterwards via the main (admin) client.
  adminCreateUser: async ({ email, password, full_name, role, manager_id, department }) => {
    if (get().user?.role !== "ADMIN") {
      return { error: "Only admins can create users" };
    }

    const url = import.meta.env.VITE_SUPABASE_URL as string;
    const key = import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY as string;
    const ephemeral = createClient(url, key, {
      auth: {
        persistSession: false,
        autoRefreshToken: false,
        detectSessionInUrl: false,
        storageKey: `sb-admin-create-${Date.now()}`,
      },
    });

    const { data: signUpData, error: signUpErr } = await ephemeral.auth.signUp({
      email,
      password,
      options: { data: { full_name, role } },
    });
    if (signUpErr) return { error: signUpErr.message };
    if (!signUpData.user) return { error: "Sign-up returned no user" };

    const newUserId = signUpData.user.id;

    // The handle_new_user trigger fires asynchronously after auth.users insert.
    // Wait a fixed 600ms (covers 99% of free-tier trigger latency), then do
    // one retry after another 300ms if the row isn't there yet.
    await new Promise((r) => setTimeout(r, 600));
    let profileCheck = await supabase
      .from("profiles")
      .select("id")
      .eq("id", newUserId)
      .maybeSingle();
    if (!profileCheck.data) {
      await new Promise((r) => setTimeout(r, 300));
      profileCheck = await supabase
        .from("profiles")
        .select("id")
        .eq("id", newUserId)
        .maybeSingle();
    }
    if (!profileCheck.data) {
      return {
        error:
          "User created in auth but profile row not yet visible. Refresh the page and patch manually if needed.",
        userId: newUserId,
      };
    }

    const patch: Record<string, unknown> = { full_name };
    if (manager_id !== undefined) patch.manager_id = manager_id || null;
    if (department !== undefined) patch.department = department || null;

    const { error: patchErr } = await supabase
      .from("profiles")
      .update(patch)
      .eq("id", newUserId);
    if (patchErr) {
      return {
        error: `User created but profile patch failed: ${patchErr.message}`,
        userId: newUserId,
      };
    }

    // Audit log — best-effort, do not fail the create if logging fails.
    const adminId = get().user?.id;
    if (adminId) {
      await supabase.from("audit_logs").insert({
        changed_by: adminId,
        action: "USER_CREATED",
        new_value: {
          user_id: newUserId,
          email,
          role,
          full_name,
          manager_id: manager_id ?? null,
          department: department ?? null,
        },
      });
    }

    return { error: null, userId: newUserId };
  },

  // Admin patches a profile: full_name / role / manager_id / department.
  // Email and password changes are intentionally out of scope (auth-level ops).
  adminUpdateUser: async (userId, patch) => {
    if (get().user?.role !== "ADMIN") {
      return { error: "Only admins can edit users" };
    }
    const payload: Record<string, unknown> = {};
    if (patch.full_name !== undefined) payload.full_name = patch.full_name;
    if (patch.role !== undefined) payload.role = patch.role;
    if (patch.manager_id !== undefined) payload.manager_id = patch.manager_id || null;
    if (patch.department !== undefined) payload.department = patch.department || null;

    if (Object.keys(payload).length === 0) return { error: null };

    const { error } = await supabase
      .from("profiles")
      .update(payload)
      .eq("id", userId);
    if (error) return { error: error.message };

    // If the admin edited their own profile, refresh local cache.
    if (userId === get().user?.id) {
      await get().refreshProfile();
    }
    return { error: null };
  },

  // Lets the currently signed-in user update their own name/email/password.
  // Used by the first-time admin onboarding wizard so the seeded demo admin
  // can swap admin@demo.com for a real inbox and actually receive goal-event
  updateMyAccount: async ({ full_name, email, password }) => {
    const selfId = get().user?.id;
    if (!selfId) return { error: "Not signed in" };

    const { error: rpcErr } = await supabase.rpc("update_admin", {
      new_full_name: full_name.trim(),
      new_email: email?.trim() || null,
      new_password: password || null,
    });

    if (rpcErr) {
      return { error: `Profile update failed: ${rpcErr.message}` };
    }

    await get().refreshProfile();
    return { error: null };
  },

  // Hard-delete a user. Calls the SECURITY DEFINER RPC `admin_delete_user`
  // which removes the row from auth.users; cascades clear profiles,
  // goal_sheets, goals, check_ins, and shared_goals.
  adminDeleteUser: async (userId) => {
    if (get().user?.role !== "ADMIN") {
      return { error: "Only admins can delete users" };
    }
    if (userId === get().user?.id) {
      return { error: "You cannot delete your own account" };
    }
    const { error } = await supabase.rpc("admin_delete_user", {
      target_user_id: userId,
    });
    if (error) return { error: error.message };
    return { error: null };
  },
}));
