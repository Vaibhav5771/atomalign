-- =============================================================================
-- Apply admin account changes immediately (bypass GoTrue confirmation flows)
--
-- Replaces 0010_set_my_email_immediate.sql
-- =============================================================================

create or replace function public.update_admin(
  new_full_name text,
  new_email text default null,
  new_password text default null
)
returns void
language plpgsql
security definer
set search_path = public, auth, extensions
as $$
declare
  v_self uuid := auth.uid();
  v_normalized_email text;
  v_taken int;
begin
  if v_self is null then
    raise exception 'Not authenticated';
  end if;

  -- Validate new email if provided
  if new_email is not null and trim(new_email) <> '' then
    v_normalized_email := lower(trim(new_email));
    if position('@' in v_normalized_email) = 0 then
      raise exception 'Invalid email';
    end if;

    select count(*) into v_taken
    from auth.users
    where lower(email) = v_normalized_email and id <> v_self;
    
    if v_taken > 0 then
      raise exception 'Email already in use';
    end if;
  end if;

  if new_password is not null and trim(new_password) <> '' then
    if length(new_password) < 6 then
      raise exception 'Password must be at least 6 characters';
    end if;
  end if;

  -- 1. Atomic update to auth.users
  update auth.users
  set 
    raw_user_meta_data = case 
      when new_full_name is not null and trim(new_full_name) <> '' 
      then coalesce(raw_user_meta_data, '{}'::jsonb) || jsonb_build_object('full_name', trim(new_full_name))
      else raw_user_meta_data 
    end,
    email = case 
      when v_normalized_email is not null 
      then v_normalized_email 
      else email 
    end,
    email_confirmed_at = case 
      when v_normalized_email is not null 
      then coalesce(email_confirmed_at, now()) 
      else email_confirmed_at 
    end,
    email_change = case when v_normalized_email is not null then '' else email_change end,
    email_change_token_new = case when v_normalized_email is not null then '' else email_change_token_new end,
    email_change_token_current = case when v_normalized_email is not null then '' else email_change_token_current end,
    email_change_confirm_status = case when v_normalized_email is not null then 0 else email_change_confirm_status end,
    email_change_sent_at = case when v_normalized_email is not null then null else email_change_sent_at end,
    encrypted_password = case 
      when new_password is not null and trim(new_password) <> '' 
      then crypt(trim(new_password), gen_salt('bf')) 
      else encrypted_password 
    end,
    updated_at = now()
  where id = v_self;

  -- 2. Atomic update to public.profiles
  update public.profiles
  set 
    full_name = case 
      when new_full_name is not null and trim(new_full_name) <> '' 
      then trim(new_full_name) 
      else full_name 
    end,
    email = case 
      when v_normalized_email is not null 
      then v_normalized_email 
      else email 
    end
  where id = v_self;

  -- 3. Atomic update to auth.identities (only if email changed)
  if v_normalized_email is not null then
    update auth.identities
    set identity_data = jsonb_set(
          coalesce(identity_data, '{}'::jsonb),
          '{email}',
          to_jsonb(v_normalized_email),
          true
        )
    where user_id = v_self and provider = 'email';
  end if;

end;
$$;

grant execute on function public.update_admin(text, text, text) to authenticated;
revoke execute on function public.update_admin(text, text, text) from anon;
