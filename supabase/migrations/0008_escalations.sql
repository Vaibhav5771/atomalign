-- =============================================================================
-- Phase 5.3 (Bonus): Rule-Based Escalation Module
-- Apply via: Supabase Dashboard → SQL Editor → New query → paste → Run
--
-- Adds two tables (escalation_rules + escalations log), supporting enums, RLS,
-- a unique partial index to make daily evaluator runs idempotent, and three
-- seed rules that demonstrate the L1 → L2 → L3 escalation chain.
-- =============================================================================
-- Idempotent: safe to re-run.
-- =============================================================================

-- -----------------------------------------------------------------------------
-- Enums
-- -----------------------------------------------------------------------------
do $$ begin
  if not exists (select 1 from pg_type where typname = 'trigger_type') then
    create type trigger_type as enum (
      'SUBMIT_OVERDUE',
      'APPROVE_OVERDUE',
      'CHECKIN_OVERDUE'
    );
  end if;
end $$;

do $$ begin
  if not exists (select 1 from pg_type where typname = 'escalate_target') then
    create type escalate_target as enum (
      'EMPLOYEE',
      'MANAGER',
      'SKIP_LEVEL',
      'HR'
    );
  end if;
end $$;

-- -----------------------------------------------------------------------------
-- escalation_rules: admin-configured triggers
-- -----------------------------------------------------------------------------
create table if not exists public.escalation_rules (
  id              uuid primary key default gen_random_uuid(),
  name            text not null,
  trigger_type    trigger_type not null,
  threshold_days  int not null check (threshold_days > 0),
  escalate_to     escalate_target not null,
  is_active       boolean not null default true,
  created_at      timestamptz not null default now()
);

create index if not exists escalation_rules_active_idx
  on public.escalation_rules(is_active) where is_active;

-- -----------------------------------------------------------------------------
-- escalations: the log
-- fire_date is a generated column used by the dedupe index — prevents the same
-- rule firing for the same subject more than once per day.
-- -----------------------------------------------------------------------------
create table if not exists public.escalations (
  id                uuid primary key default gen_random_uuid(),
  rule_id           uuid references public.escalation_rules(id) on delete set null,
  subject_user_id   uuid not null references public.profiles(id) on delete cascade,
  recipient_user_id uuid references public.profiles(id) on delete set null,
  trigger_type      trigger_type not null,
  sheet_id          uuid references public.goal_sheets(id) on delete set null,
  reason_text       text not null,
  fired_at          timestamptz not null default now(),
  resolved_at       timestamptz,
  fire_date         date generated always as ((fired_at at time zone 'UTC')::date) stored
);

create index if not exists escalations_subject_idx on public.escalations(subject_user_id);
create index if not exists escalations_fired_at_idx on public.escalations(fired_at desc);
create unique index if not exists escalations_dedupe_idx
  on public.escalations(rule_id, subject_user_id, fire_date)
  where rule_id is not null;

-- -----------------------------------------------------------------------------
-- RLS
-- -----------------------------------------------------------------------------
alter table public.escalation_rules enable row level security;
alter table public.escalations enable row level security;

-- Rules: admin-only on all operations
drop policy if exists "rules_admin_all" on public.escalation_rules;
create policy "rules_admin_all" on public.escalation_rules
  for all
  using (
    exists (select 1 from public.profiles where id = auth.uid() and role = 'ADMIN')
  )
  with check (
    exists (select 1 from public.profiles where id = auth.uid() and role = 'ADMIN')
  );

-- Log SELECT:
--   admin → all
--   manager → escalations where subject is one of their direct reports
--   employee → their own escalations
drop policy if exists "escalations_select" on public.escalations;
create policy "escalations_select" on public.escalations
  for select
  using (
    exists (select 1 from public.profiles where id = auth.uid() and role = 'ADMIN')
    or subject_user_id = auth.uid()
    or exists (
      select 1 from public.profiles
      where id = escalations.subject_user_id
        and manager_id = auth.uid()
    )
  );

-- Log UPDATE: admin only (used to set resolved_at).
drop policy if exists "escalations_update_admin" on public.escalations;
create policy "escalations_update_admin" on public.escalations
  for update
  using (
    exists (select 1 from public.profiles where id = auth.uid() and role = 'ADMIN')
  )
  with check (
    exists (select 1 from public.profiles where id = auth.uid() and role = 'ADMIN')
  );

-- INSERT is service-role only (Edge Function uses SUPABASE_SERVICE_ROLE_KEY which
-- bypasses RLS) — no policy needed for the regular roles.

-- -----------------------------------------------------------------------------
-- Seed rules: L1 → L2 → L3 chain for SUBMIT_OVERDUE plus single rules for the
-- other two trigger types. Admins can clone the chain pattern for the others
-- via the UI later.
-- -----------------------------------------------------------------------------
insert into public.escalation_rules (name, trigger_type, threshold_days, escalate_to)
values
  ('Goal-setting overdue L1 (employee reminder)', 'SUBMIT_OVERDUE',  7,  'EMPLOYEE'),
  ('Goal-setting overdue L2 (manager nudge)',     'SUBMIT_OVERDUE',  14, 'MANAGER'),
  ('Goal-setting overdue L3 (HR escalation)',     'SUBMIT_OVERDUE',  21, 'HR'),
  ('Approval overdue (manager)',                  'APPROVE_OVERDUE', 5,  'MANAGER'),
  ('Check-in overdue (employee)',                 'CHECKIN_OVERDUE', 14, 'EMPLOYEE')
on conflict do nothing;
