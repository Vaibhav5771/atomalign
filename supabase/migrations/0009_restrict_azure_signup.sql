-- =============================================================================
-- Phase 5 (Bonus): Restrict Microsoft sign-in to admin-pre-registered emails
--
-- Closes the loop on the "Create Team" wizard: only emails that an admin has
-- already added to public.profiles (via the wizard or the single-user form)
-- can complete a Microsoft / Entra ID sign-in. Anyone else hitting the SSO
-- button is rejected by the handle_new_user trigger before their auth.users
-- row is committed.
--
-- Email/password sign-ups (the wizard path) are unaffected — they continue to
-- create a profile row exactly as before.
--
-- Apply via: Supabase Dashboard → SQL Editor → New query → paste → Run.
-- =============================================================================

create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  v_provider text := coalesce(new.raw_app_meta_data->>'provider', 'email');
  v_email_lower text := lower(new.email);
  v_existing_count int;
begin
  -- Gate: azure sign-ins must match an email that already exists in profiles
  -- (planted there by an admin via the Create Team wizard or the Users page
  -- single-user form). new.id is excluded from the lookup so the *current*
  -- inserting row is never counted against itself.
  if v_provider = 'azure' then
    select count(*) into v_existing_count
    from public.profiles
    where lower(email) = v_email_lower
      and id <> new.id;

    if v_existing_count = 0 then
      raise exception
        'Microsoft sign-in is restricted to accounts pre-registered by an admin. Please ask your admin to add you via the Create Team wizard.'
        using errcode = '42501';
    end if;
  end if;

  -- Existing profile insert (mirrors migration 0007 byte-for-byte so email/
  -- password sign-ups behave identically).
  insert into public.profiles (id, email, full_name, role, auth_provider)
  values (
    new.id,
    new.email,
    coalesce(
      new.raw_user_meta_data->>'full_name',
      new.raw_user_meta_data->>'name',
      split_part(new.email, '@', 1)
    ),
    coalesce((new.raw_user_meta_data->>'role')::user_role, 'EMPLOYEE'),
    v_provider
  );

  return new;
end;
$$;
