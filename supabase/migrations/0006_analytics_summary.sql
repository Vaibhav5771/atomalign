-- =============================================================================
-- Analytics Summary View
-- Apply via: Supabase Dashboard → SQL Editor → New query → paste → Run
-- =============================================================================
-- Single denormalised view that powers all four charts on /admin/analytics.
-- One row per (employee × goal × check_in). Goals without check-ins appear
-- as a single row with NULL quarter / actual / score / checkin_status so the
-- chart layer can still count them for distribution pies.
--
-- SECURITY: this is a SECURITY INVOKER view (the default). Callers see only
-- the data their RLS policies allow. Admin gets the full org via the existing
-- admin policies on profiles / goal_sheets / goals / check_ins.
-- =============================================================================

drop view if exists public.analytics_summary;

create view public.analytics_summary as
select
  e.id                as employee_id,
  coalesce(nullif(e.full_name, ''), e.email) as employee_name,
  e.department        as department,
  m.id                as manager_id,
  case when m.id is not null
       then coalesce(nullif(m.full_name, ''), m.email)
       else null end  as manager_name,
  g.id                as goal_id,
  g.title             as goal_title,
  g.thrust_area       as thrust_area,
  g.uom               as uom,
  g.target            as target,
  g.weightage         as weightage,
  s.status            as sheet_status,
  c.quarter           as quarter,
  c.actual            as actual,
  c.score             as score,
  c.status            as checkin_status
from public.profiles    e
left join public.profiles    m on m.id = e.manager_id
join public.goal_sheets s on s.employee_id = e.id
join public.goals       g on g.sheet_id    = s.id
left join public.check_ins c on c.goal_id  = g.id
where e.role = 'EMPLOYEE';

comment on view public.analytics_summary is
  'Denormalised summary for /admin/analytics. Read-only. RLS-aware via underlying tables.';
