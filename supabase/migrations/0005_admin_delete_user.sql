-- =============================================================================
-- Admin User Deletion
-- Apply via: Supabase Dashboard → SQL Editor → New query → paste → Run
-- =============================================================================
-- The anon/authenticated client cannot delete from auth.users directly. This
-- SECURITY DEFINER function lets an authenticated ADMIN remove a user (and,
-- via cascade, all their goal sheets, goals, check-ins, and shared-goal links).
-- audit_logs entries survive because changed_by is ON DELETE SET NULL.
-- Idempotent: drop-and-recreate.
-- =============================================================================

create or replace function public.admin_delete_user(target_user_id uuid)
returns void
language plpgsql
security definer
set search_path = public, auth
as $$
declare
  caller_role public.user_role;
  target_email text;
  target_name  text;
begin
  -- 1. Caller must be ADMIN
  select role into caller_role
    from public.profiles
    where id = auth.uid();
  if caller_role is null or caller_role <> 'ADMIN' then
    raise exception 'Only admins can delete users';
  end if;

  -- 2. Prevent self-deletion (avoid orphaning the admin role)
  if target_user_id = auth.uid() then
    raise exception 'You cannot delete your own account';
  end if;

  -- 3. Look up target so we can record context in the audit log
  select email, full_name
    into target_email, target_name
    from public.profiles
    where id = target_user_id;
  if target_email is null then
    raise exception 'Target user not found';
  end if;

  -- 4. Write audit row BEFORE delete so changed_by reference still resolves
  insert into public.audit_logs (changed_by, action, new_value)
  values (
    auth.uid(),
    'ADMIN_DELETED_USER',
    jsonb_build_object(
      'user_id', target_user_id,
      'email', target_email,
      'full_name', target_name
    )
  );

  -- 5. Delete from auth.users; cascades to profiles → goal_sheets → goals →
  --    check_ins → shared_goals. audit_logs.changed_by set to null.
  delete from auth.users where id = target_user_id;
end;
$$;

-- Allow any authenticated user to call it; the function itself enforces the
-- ADMIN check internally (defence in depth).
grant execute on function public.admin_delete_user(uuid) to authenticated;

-- Revoke from anon explicitly (no anonymous deletes)
revoke execute on function public.admin_delete_user(uuid) from anon;
