-- =============================================================================
-- Phase 1 Test Fixes
-- Apply via: Supabase Dashboard → SQL Editor → New query → paste → Run
-- =============================================================================

-- Add shared_by column to goals: tracks the admin/manager who pushed a shared goal.
-- Null for goals created by the employee themselves.
alter table public.goals
  add column if not exists shared_by uuid references public.profiles(id) on delete set null;

create index if not exists goals_shared_by_idx on public.goals(shared_by);

-- Allow employees to read the profiles of those who shared goals to them
-- (existing profiles_select_authenticated policy already covers this).

-- Tighten employee update policy on goals so that shared goals (is_shared = true)
-- can ONLY have their weightage changed by the employee. All other fields are
-- frozen. Locked goals remain non-editable as before.
drop policy if exists goals_update_employee on public.goals;

create policy goals_update_employee on public.goals
  for update to authenticated
  using (
    is_locked = false
    and exists (
      select 1 from public.goal_sheets s
      where s.id = goals.sheet_id
        and s.employee_id = auth.uid()
        and s.status in ('DRAFT', 'RETURNED')
    )
  )
  with check (
    -- For shared goals, only weightage can change. Other columns must match the
    -- existing row. We enforce this via a trigger below so policies stay simple.
    is_locked = false
    and exists (
      select 1 from public.goal_sheets s
      where s.id = goals.sheet_id
        and s.employee_id = auth.uid()
        and s.status in ('DRAFT', 'RETURNED')
    )
  );

-- Trigger: prevent employees from modifying title/target/uom/thrust_area/description
-- on a shared goal. Only weightage is allowed to change.
create or replace function public.enforce_shared_goal_lock()
returns trigger language plpgsql security definer set search_path = public as $$
declare
  caller_role user_role;
begin
  select role into caller_role from public.profiles where id = auth.uid();

  if old.is_shared and caller_role = 'EMPLOYEE' then
    if new.title         is distinct from old.title         then raise exception 'Shared goal title is read-only'; end if;
    if new.target        is distinct from old.target        then raise exception 'Shared goal target is read-only'; end if;
    if new.uom           is distinct from old.uom           then raise exception 'Shared goal UoM is read-only'; end if;
    if new.thrust_area   is distinct from old.thrust_area   then raise exception 'Shared goal thrust area is read-only'; end if;
    if new.description   is distinct from old.description   then raise exception 'Shared goal description is read-only'; end if;
    if new.target_date   is distinct from old.target_date   then raise exception 'Shared goal target date is read-only'; end if;
    if new.is_shared     is distinct from old.is_shared     then raise exception 'Cannot change shared flag'; end if;
    if new.shared_by     is distinct from old.shared_by     then raise exception 'Cannot change shared_by'; end if;
  end if;
  return new;
end;
$$;

drop trigger if exists goals_shared_lock_trigger on public.goals;

create trigger goals_shared_lock_trigger
  before update on public.goals
  for each row execute function public.enforce_shared_goal_lock();
