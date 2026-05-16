-- =============================================================================
-- Phase 1 Schema: AtomAlign
-- Apply via: Supabase Dashboard → SQL Editor → New query → paste → Run
-- =============================================================================

-- -----------------------------------------------------------------------------
-- Enums
-- -----------------------------------------------------------------------------
create type user_role as enum ('EMPLOYEE', 'MANAGER', 'ADMIN');
create type sheet_status as enum ('DRAFT', 'SUBMITTED', 'APPROVED', 'RETURNED');
create type uom_type as enum ('NUMERIC', 'PERCENT', 'TIMELINE', 'ZERO');

-- -----------------------------------------------------------------------------
-- profiles: extends auth.users with role + manager linkage
-- -----------------------------------------------------------------------------
create table public.profiles (
  id          uuid primary key references auth.users(id) on delete cascade,
  full_name   text not null default '',
  email       text not null,
  role        user_role not null default 'EMPLOYEE',
  manager_id  uuid references public.profiles(id) on delete set null,
  department  text,
  created_at  timestamptz not null default now()
);

create index profiles_manager_id_idx on public.profiles(manager_id);
create index profiles_role_idx on public.profiles(role);

-- -----------------------------------------------------------------------------
-- goal_sheets: one per employee per cycle_year
-- -----------------------------------------------------------------------------
create table public.goal_sheets (
  id              uuid primary key default gen_random_uuid(),
  employee_id     uuid not null references public.profiles(id) on delete cascade,
  cycle_year      int  not null,
  status          sheet_status not null default 'DRAFT',
  submitted_at    timestamptz,
  approved_at     timestamptz,
  manager_remark  text,
  created_at      timestamptz not null default now(),
  updated_at      timestamptz not null default now(),
  unique (employee_id, cycle_year)
);

create index goal_sheets_employee_id_idx on public.goal_sheets(employee_id);
create index goal_sheets_status_idx on public.goal_sheets(status);

-- -----------------------------------------------------------------------------
-- goals: up to 8 per sheet, with weightage and lock flag
-- -----------------------------------------------------------------------------
create table public.goals (
  id            uuid primary key default gen_random_uuid(),
  sheet_id      uuid not null references public.goal_sheets(id) on delete cascade,
  thrust_area   text not null,
  title         text not null,
  description   text,
  uom           uom_type not null,
  target        text not null,
  target_date   date,
  weightage     int  not null check (weightage >= 10 and weightage <= 100),
  is_shared     boolean not null default false,
  is_locked     boolean not null default false,
  created_at    timestamptz not null default now()
);

create index goals_sheet_id_idx on public.goals(sheet_id);

-- Cap goals at 8 per sheet (enforced via trigger)
create or replace function public.enforce_goal_cap()
returns trigger language plpgsql as $$
declare
  goal_count int;
begin
  select count(*) into goal_count from public.goals where sheet_id = new.sheet_id;
  if goal_count >= 8 then
    raise exception 'A goal sheet cannot have more than 8 goals';
  end if;
  return new;
end;
$$;

create trigger goals_cap_trigger
  before insert on public.goals
  for each row execute function public.enforce_goal_cap();

-- -----------------------------------------------------------------------------
-- shared_goals: admin-pushed goals linked to specific employees
-- -----------------------------------------------------------------------------
create table public.shared_goals (
  id              uuid primary key default gen_random_uuid(),
  source_goal_id  uuid not null references public.goals(id) on delete cascade,
  employee_id     uuid not null references public.profiles(id) on delete cascade,
  weightage       int  not null check (weightage >= 10 and weightage <= 100),
  created_at      timestamptz not null default now(),
  unique (source_goal_id, employee_id)
);

create index shared_goals_employee_id_idx on public.shared_goals(employee_id);

-- -----------------------------------------------------------------------------
-- audit_logs: tracks changes after lock
-- -----------------------------------------------------------------------------
create table public.audit_logs (
  id          uuid primary key default gen_random_uuid(),
  goal_id     uuid references public.goals(id) on delete set null,
  sheet_id    uuid references public.goal_sheets(id) on delete set null,
  changed_by  uuid references public.profiles(id) on delete set null,
  action      text not null,
  old_value   jsonb,
  new_value   jsonb,
  created_at  timestamptz not null default now()
);

create index audit_logs_sheet_id_idx on public.audit_logs(sheet_id);
create index audit_logs_goal_id_idx on public.audit_logs(goal_id);

-- -----------------------------------------------------------------------------
-- Auth trigger: create profile row on user signup
-- -----------------------------------------------------------------------------
create or replace function public.handle_new_user()
returns trigger language plpgsql security definer set search_path = public as $$
begin
  insert into public.profiles (id, email, full_name, role)
  values (
    new.id,
    new.email,
    coalesce(new.raw_user_meta_data->>'full_name', split_part(new.email, '@', 1)),
    coalesce((new.raw_user_meta_data->>'role')::user_role, 'EMPLOYEE')
  );
  return new;
end;
$$;

create trigger on_auth_user_created
  after insert on auth.users
  for each row execute function public.handle_new_user();

-- -----------------------------------------------------------------------------
-- updated_at touch trigger for goal_sheets
-- -----------------------------------------------------------------------------
create or replace function public.touch_updated_at()
returns trigger language plpgsql as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

create trigger goal_sheets_updated_at
  before update on public.goal_sheets
  for each row execute function public.touch_updated_at();

-- =============================================================================
-- Row Level Security
-- =============================================================================

alter table public.profiles      enable row level security;
alter table public.goal_sheets   enable row level security;
alter table public.goals         enable row level security;
alter table public.shared_goals  enable row level security;
alter table public.audit_logs    enable row level security;

-- Helper: current user's role
create or replace function public.current_role()
returns user_role language sql stable security definer set search_path = public as $$
  select role from public.profiles where id = auth.uid()
$$;

-- ---- profiles -----------------------------------------------------------------
-- Everyone authenticated can read profiles (needed for manager dropdowns, employee select)
create policy profiles_select_authenticated on public.profiles
  for select to authenticated using (true);

-- Users can update their own profile (basic fields only — role change handled by admin SQL)
create policy profiles_update_self on public.profiles
  for update to authenticated using (id = auth.uid()) with check (id = auth.uid());

-- Admin can update any profile (for role/manager assignment)
create policy profiles_update_admin on public.profiles
  for update to authenticated using (public.current_role() = 'ADMIN');

-- ---- goal_sheets --------------------------------------------------------------
-- Employee sees own sheet; manager sees sheets of their reports; admin sees all
create policy goal_sheets_select on public.goal_sheets
  for select to authenticated using (
    employee_id = auth.uid()
    or exists (
      select 1 from public.profiles p
      where p.id = goal_sheets.employee_id
        and p.manager_id = auth.uid()
    )
    or public.current_role() = 'ADMIN'
  );

-- Employee creates own sheet
create policy goal_sheets_insert_employee on public.goal_sheets
  for insert to authenticated with check (employee_id = auth.uid());

-- Admin can create sheets on behalf of any employee (used when pushing shared goals)
create policy goal_sheets_insert_admin on public.goal_sheets
  for insert to authenticated with check (public.current_role() = 'ADMIN');

-- Employee updates own sheet only when DRAFT or RETURNED
create policy goal_sheets_update_employee on public.goal_sheets
  for update to authenticated
  using (employee_id = auth.uid() and status in ('DRAFT', 'RETURNED'))
  with check (employee_id = auth.uid());

-- Manager updates sheets of their reports (status transitions, remark)
create policy goal_sheets_update_manager on public.goal_sheets
  for update to authenticated
  using (
    exists (
      select 1 from public.profiles p
      where p.id = goal_sheets.employee_id and p.manager_id = auth.uid()
    )
  );

-- ---- goals --------------------------------------------------------------------
-- Same visibility as their sheet
create policy goals_select on public.goals
  for select to authenticated using (
    exists (
      select 1 from public.goal_sheets s
      where s.id = goals.sheet_id
        and (
          s.employee_id = auth.uid()
          or exists (
            select 1 from public.profiles p
            where p.id = s.employee_id and p.manager_id = auth.uid()
          )
          or public.current_role() = 'ADMIN'
        )
    )
  );

-- Insert: only into a sheet owned by the user AND status is DRAFT/RETURNED
create policy goals_insert_employee on public.goals
  for insert to authenticated with check (
    exists (
      select 1 from public.goal_sheets s
      where s.id = goals.sheet_id
        and s.employee_id = auth.uid()
        and s.status in ('DRAFT', 'RETURNED')
    )
  );

-- Admin can insert goals into any sheet (used for pushing shared goals)
create policy goals_insert_admin on public.goals
  for insert to authenticated with check (public.current_role() = 'ADMIN');

-- Update: employee can update own goals only when not locked AND sheet is editable
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
  );

-- Update: manager can update goals on reports' sheets (even when locked = inline edit during review)
create policy goals_update_manager on public.goals
  for update to authenticated
  using (
    exists (
      select 1 from public.goal_sheets s
      join public.profiles p on p.id = s.employee_id
      where s.id = goals.sheet_id and p.manager_id = auth.uid()
    )
  );

-- Delete: employee can delete own goals only when sheet is DRAFT/RETURNED and not locked
create policy goals_delete_employee on public.goals
  for delete to authenticated using (
    is_locked = false
    and exists (
      select 1 from public.goal_sheets s
      where s.id = goals.sheet_id
        and s.employee_id = auth.uid()
        and s.status in ('DRAFT', 'RETURNED')
    )
  );

-- ---- shared_goals -------------------------------------------------------------
-- Employees see their own assignments; admins see all
create policy shared_goals_select on public.shared_goals
  for select to authenticated using (
    employee_id = auth.uid() or public.current_role() = 'ADMIN'
  );

-- Only admins create shared goal links
create policy shared_goals_insert_admin on public.shared_goals
  for insert to authenticated with check (public.current_role() = 'ADMIN');

-- Employee can update weightage on their own assignment
create policy shared_goals_update_employee on public.shared_goals
  for update to authenticated using (employee_id = auth.uid()) with check (employee_id = auth.uid());

-- Admins can delete a pushed assignment
create policy shared_goals_delete_admin on public.shared_goals
  for delete to authenticated using (public.current_role() = 'ADMIN');

-- ---- audit_logs ---------------------------------------------------------------
-- All authenticated users can insert audit entries (e.g. manager approval action)
create policy audit_logs_insert_authenticated on public.audit_logs
  for insert to authenticated with check (changed_by = auth.uid());

-- Only admins can read audit logs
create policy audit_logs_select_admin on public.audit_logs
  for select to authenticated using (public.current_role() = 'ADMIN');

-- =============================================================================
-- POST-USER-CREATION SETUP (run AFTER creating demo users in Auth dashboard)
-- =============================================================================
-- After creating the 3 demo users (employee@demo.com, manager@demo.com,
-- admin@demo.com) in Supabase Auth → Add User, uncomment and run the block
-- below to assign roles and link the employee to the manager.
-- =============================================================================

-- update public.profiles set role = 'MANAGER' where email = 'manager@demo.com';
-- update public.profiles set role = 'ADMIN'   where email = 'admin@demo.com';
-- update public.profiles
--   set manager_id = (select id from public.profiles where email = 'manager@demo.com')
--   where email = 'employee@demo.com';
