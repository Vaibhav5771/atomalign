-- =============================================================================
-- Phase 2: Quarterly Check-ins
-- Apply via: Supabase Dashboard → SQL Editor → New query → paste → Run
-- =============================================================================
-- Idempotent: safe to re-run.
-- =============================================================================

-- -----------------------------------------------------------------------------
-- Score direction on goals: HIGHER = bigger actual is better (revenue),
-- LOWER = smaller actual is better (TAT, cost, defects).
-- Default 'HIGHER' so existing rows have a sensible value.
-- -----------------------------------------------------------------------------
do $$ begin
  if not exists (select 1 from pg_type where typname = 'score_direction') then
    create type score_direction as enum ('HIGHER', 'LOWER');
  end if;
end $$;

alter table public.goals
  add column if not exists direction score_direction not null default 'HIGHER';

-- -----------------------------------------------------------------------------
-- check_in_status enum
-- -----------------------------------------------------------------------------
do $$ begin
  if not exists (select 1 from pg_type where typname = 'check_in_status') then
    create type check_in_status as enum ('NOT_STARTED', 'ON_TRACK', 'COMPLETED');
  end if;
end $$;

-- -----------------------------------------------------------------------------
-- check_ins: one row per (goal, quarter)
-- -----------------------------------------------------------------------------
create table if not exists public.check_ins (
  id              uuid primary key default gen_random_uuid(),
  goal_id         uuid not null references public.goals(id) on delete cascade,
  quarter         text not null check (quarter in ('Q1','Q2','Q3','Q4')),
  actual          text,
  actual_date     date,
  status          check_in_status not null default 'NOT_STARTED',
  manager_comment text,
  score           numeric(5,1),
  created_at      timestamptz not null default now(),
  updated_at      timestamptz not null default now(),
  unique (goal_id, quarter)
);

create index if not exists check_ins_goal_id_idx on public.check_ins(goal_id);
create index if not exists check_ins_quarter_idx on public.check_ins(quarter);

-- touch updated_at on update
drop trigger if exists check_ins_updated_at on public.check_ins;
create trigger check_ins_updated_at
  before update on public.check_ins
  for each row execute function public.touch_updated_at();

-- -----------------------------------------------------------------------------
-- Field-scope trigger: enforce who can change what on check_ins
-- Employees: cannot set manager_comment.
-- Managers:  can only change manager_comment.
-- Admins:    unrestricted.
-- -----------------------------------------------------------------------------
create or replace function public.enforce_check_in_field_scope()
returns trigger language plpgsql security definer set search_path = public as $$
declare
  caller_role user_role;
begin
  select role into caller_role from public.profiles where id = auth.uid();

  if caller_role = 'EMPLOYEE' then
    if new.manager_comment is distinct from old.manager_comment then
      raise exception 'Employees cannot edit manager comments';
    end if;
  elsif caller_role = 'MANAGER' then
    if new.goal_id        is distinct from old.goal_id        then raise exception 'Managers cannot change goal_id'; end if;
    if new.quarter        is distinct from old.quarter        then raise exception 'Managers cannot change quarter'; end if;
    if new.actual         is distinct from old.actual         then raise exception 'Managers cannot edit actual value'; end if;
    if new.actual_date    is distinct from old.actual_date    then raise exception 'Managers cannot edit actual date'; end if;
    if new.status         is distinct from old.status         then raise exception 'Managers cannot edit check-in status'; end if;
    if new.score          is distinct from old.score          then raise exception 'Managers cannot edit score'; end if;
  end if;
  return new;
end;
$$;

drop trigger if exists check_ins_field_scope on public.check_ins;
create trigger check_ins_field_scope
  before update on public.check_ins
  for each row execute function public.enforce_check_in_field_scope();

-- -----------------------------------------------------------------------------
-- Row Level Security
-- -----------------------------------------------------------------------------
alter table public.check_ins enable row level security;

-- ---- SELECT ------------------------------------------------------------------
-- Employee: own check_ins (any sheet status — they may want to look back)
drop policy if exists check_ins_select_employee on public.check_ins;
create policy check_ins_select_employee on public.check_ins
  for select to authenticated using (
    exists (
      select 1
      from public.goals g
      join public.goal_sheets s on s.id = g.sheet_id
      where g.id = check_ins.goal_id
        and s.employee_id = auth.uid()
    )
  );

-- Manager: check_ins for any of their reports' goals
drop policy if exists check_ins_select_manager on public.check_ins;
create policy check_ins_select_manager on public.check_ins
  for select to authenticated using (
    exists (
      select 1
      from public.goals g
      join public.goal_sheets s on s.id = g.sheet_id
      join public.profiles p on p.id = s.employee_id
      where g.id = check_ins.goal_id
        and p.manager_id = auth.uid()
    )
  );

-- Admin: all check_ins
drop policy if exists check_ins_select_admin on public.check_ins;
create policy check_ins_select_admin on public.check_ins
  for select to authenticated using (public.current_role() = 'ADMIN');

-- ---- INSERT ------------------------------------------------------------------
-- Employee: insert check_ins for their own APPROVED sheet's goals
drop policy if exists check_ins_insert_employee on public.check_ins;
create policy check_ins_insert_employee on public.check_ins
  for insert to authenticated with check (
    exists (
      select 1
      from public.goals g
      join public.goal_sheets s on s.id = g.sheet_id
      where g.id = check_ins.goal_id
        and s.employee_id = auth.uid()
        and s.status = 'APPROVED'
    )
  );

-- Admin: insert any (escape hatch)
drop policy if exists check_ins_insert_admin on public.check_ins;
create policy check_ins_insert_admin on public.check_ins
  for insert to authenticated with check (public.current_role() = 'ADMIN');

-- ---- UPDATE ------------------------------------------------------------------
-- Employee: update own check_ins (only when sheet is APPROVED).
-- Field-scope trigger ensures they cannot touch manager_comment.
drop policy if exists check_ins_update_employee on public.check_ins;
create policy check_ins_update_employee on public.check_ins
  for update to authenticated
  using (
    exists (
      select 1
      from public.goals g
      join public.goal_sheets s on s.id = g.sheet_id
      where g.id = check_ins.goal_id
        and s.employee_id = auth.uid()
        and s.status = 'APPROVED'
    )
  );

-- Manager: update check_ins for their team's goals.
-- Field-scope trigger restricts them to manager_comment only.
drop policy if exists check_ins_update_manager on public.check_ins;
create policy check_ins_update_manager on public.check_ins
  for update to authenticated
  using (
    exists (
      select 1
      from public.goals g
      join public.goal_sheets s on s.id = g.sheet_id
      join public.profiles p on p.id = s.employee_id
      where g.id = check_ins.goal_id
        and p.manager_id = auth.uid()
    )
  );

-- Admin: update any
drop policy if exists check_ins_update_admin on public.check_ins;
create policy check_ins_update_admin on public.check_ins
  for update to authenticated using (public.current_role() = 'ADMIN');
