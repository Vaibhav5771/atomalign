-- =============================================================================
-- Admin reopen support
-- Apply via: Supabase Dashboard → SQL Editor → New query → paste → Run
-- =============================================================================

-- 1. Track who reopened a sheet and when
alter table public.goal_sheets
  add column if not exists reopened_by uuid references public.profiles(id) on delete set null,
  add column if not exists reopened_at timestamptz;

create index if not exists goal_sheets_reopened_by_idx on public.goal_sheets(reopened_by);

-- 2. Admin RLS policies for the reopen flow.
--    Without these, supabase.update() silently affects 0 rows because RLS
--    treats blocked rows as non-existent (no error returned).

-- Admin can update any goal_sheet (used to flip status back to RETURNED on reopen)
drop policy if exists goal_sheets_update_admin on public.goal_sheets;

create policy goal_sheets_update_admin on public.goal_sheets
  for update to authenticated
  using (public.current_role() = 'ADMIN')
  with check (public.current_role() = 'ADMIN');

-- Admin can update any goal (used to unlock goals on reopen)
drop policy if exists goals_update_admin on public.goals;

create policy goals_update_admin on public.goals
  for update to authenticated
  using (public.current_role() = 'ADMIN')
  with check (public.current_role() = 'ADMIN');
