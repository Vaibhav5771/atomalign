import { supabase } from "@/lib/supabase";

interface GraphMe {
  id: string;
  displayName?: string;
  mail?: string | null;
  userPrincipalName?: string;
  department?: string | null;
  jobTitle?: string | null;
  manager?: {
    id: string;
    displayName?: string;
    mail?: string | null;
    userPrincipalName?: string;
  } | null;
}

async function fetchMe(token: string): Promise<GraphMe | null> {
  const res = await fetch(
    "https://graph.microsoft.com/v1.0/me?$select=id,displayName,mail,userPrincipalName,department,jobTitle&$expand=manager($select=id,displayName,mail,userPrincipalName)",
    { headers: { Authorization: `Bearer ${token}` } },
  );
  if (!res.ok) {
    console.warn("[graph] /me failed", res.status, await res.text());
    return null;
  }
  return (await res.json()) as GraphMe;
}

// Sync the signed-in user's Azure profile into public.profiles.
// Safe to call multiple times — uses upsert semantics on the profile row that
// already exists (the handle_new_user trigger created it). Returns true if any
// field was updated, false otherwise.
export async function syncProfileFromGraph(
  userId: string,
  providerToken: string,
): Promise<boolean> {
  const me = await fetchMe(providerToken);
  if (!me) return false;

  const fullName = me.displayName?.trim() || null;
  const email = (me.mail || me.userPrincipalName || "").toLowerCase() || null;

  // Try to resolve the manager's profile by matching their email.
  let managerId: string | null = null;
  const managerEmail = (me.manager?.mail || me.manager?.userPrincipalName || "")
    .toLowerCase();
  if (managerEmail) {
    const { data: managerProfile } = await supabase
      .from("profiles")
      .select("id")
      .ilike("email", managerEmail)
      .maybeSingle();
    if (managerProfile) managerId = managerProfile.id as string;
  }

  const patch: Record<string, unknown> = { azure_oid: me.id };
  if (fullName) patch.full_name = fullName;
  if (email) patch.email = email;
  if (me.department) patch.department = me.department;
  if (managerId) patch.manager_id = managerId;

  const { error } = await supabase
    .from("profiles")
    .update(patch)
    .eq("id", userId);
  if (error) {
    console.warn("[graph] profile update failed", error);
    return false;
  }
  return true;
}
