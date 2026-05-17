-- =============================================================================
-- Apply email changes immediately (bypass the confirmation flow)
--
-- Supabase's hosted Auth always treats `supabase.auth.updateUser({ email })`
-- as a security-sensitive change: it writes to `new_email` + sends a token to
-- both the old and new inbox, even when every dashboard "confirm email" toggle
-- is OFF. There is no project-level flag to disable this on hosted projects.
--
-- For the AtomAlign demo we want the Create-Team wizard's Step 0 to apply
-- the admin's new email instantly, with no inbox round-trip. This RPC does
-- exactly that for the *calling* user only — it cannot be used to change
-- someone else's email.
--
-- Apply via: Supabase Dashboard → SQL Editor → New query → paste → Run.
-- =============================================================================

create or replace function public.set_my_email_immediate(new_email text)
returns void
language plpgsql
security definer
set search_path = public, auth, extensions
as $$
declare
  v_self uuid := auth.uid();
  v_normalized text := lower(trim(new_email));
  v_taken int;
begin
  if v_self is null then
    raise exception 'Not authenticated';
  end if;

  if v_normalized is null or v_normalized = '' or position('@' in v_normalized) = 0 then
    raise exception 'Invalid email';
  end if;

  select count(*) into v_taken
  from auth.users
  where lower(email) = v_normalized and id <> v_self;
  if v_taken > 0 then
    raise exception 'Email already in use';
  end if;

  -- Apply the change immediately, clearing any pending email_change machinery
  update auth.users
  set email = v_normalized,
      email_confirmed_at = coalesce(email_confirmed_at, now()),
      email_change = '',
      email_change_token_new = '',
      email_change_token_current = '',
      email_change_confirm_status = 0,
      email_change_sent_at = null,
      updated_at = now()
  where id = v_self;

  -- Sync the email-provider identity row (auth.identities.email is a stored
  -- generated column derived from identity_data->>'email')
  update auth.identities
  set identity_data = jsonb_set(
        coalesce(identity_data, '{}'::jsonb),
        '{email}',
        to_jsonb(v_normalized),
        true
      )
  where user_id = v_self and provider = 'email';

  -- Keep the profile row in sync
  update public.profiles
  set email = v_normalized
  where id = v_self;
end;
$$;

grant execute on function public.set_my_email_immediate(text) to authenticated;
revoke execute on function public.set_my_email_immediate(text) from anon;
