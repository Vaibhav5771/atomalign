-- =============================================================================
-- Phase 5 (Bonus): Microsoft / Entra ID integration support
-- Apply via: Supabase Dashboard → SQL Editor → New query → paste → Run
--
-- This migration is ADDITIVE. Existing email/password auth keeps working
-- unchanged; we only:
--   1. Add nullable columns to profiles so Graph-synced metadata has a home.
--   2. Patch handle_new_user() to fall back to Azure's `name` claim when
--      `full_name` is absent in raw_user_meta_data (OAuth users).
-- =============================================================================

-- -----------------------------------------------------------------------------
-- profiles: Azure object id + provider tag (both nullable, defaults preserved)
-- -----------------------------------------------------------------------------
alter table public.profiles
  add column if not exists azure_oid text,
  add column if not exists auth_provider text;

create unique index if not exists profiles_azure_oid_uidx
  on public.profiles(azure_oid)
  where azure_oid is not null;

-- -----------------------------------------------------------------------------
-- handle_new_user: accept Azure's `name` claim as a full_name fallback.
-- Order: explicit `full_name` (set by adminCreateUser) → Azure `name` claim →
-- email local-part. Role still defaults to EMPLOYEE for OAuth users; admins
-- promote via the existing Users page.
-- -----------------------------------------------------------------------------
create or replace function public.handle_new_user()
returns trigger language plpgsql security definer set search_path = public as $$
begin
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
    coalesce(new.raw_app_meta_data->>'provider', 'email')
  );
  return new;
end;
$$;
