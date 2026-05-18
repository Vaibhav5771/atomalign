-- =============================================================================
-- get_completion_report() — Phase 3 perf optimization
--
-- Collapses 5 sequential client round-trips into one server-side query:
--   client/before: profiles → managers → approved sheets → goals → check_ins
--   client/after:  rpc('get_completion_report') (single round-trip)
--
-- Returns: jsonb array of CompletionRow shaped like the existing client type:
--   {
--     employee_id, employee_name, employee_email, department,
--     manager_id, manager_name,
--     quarters: { Q1, Q2, Q3, Q4 }   -- 'NOT_STARTED' | 'IN_PROGRESS' | 'COMPLETED'
--   }
--
-- Authorization: admin-only. SECURITY DEFINER bypasses RLS for the
-- aggregation (which crosses profiles + goal_sheets + goals + check_ins);
-- a role check up front ensures non-admins cannot call it.
-- =============================================================================

create or replace function public.get_completion_report()
returns jsonb
language plpgsql
stable
security definer
set search_path = public
as $$
declare
  v_role text;
  v_result jsonb;
begin
  -- Authorize
  select role into v_role from public.profiles where id = auth.uid();
  if v_role is null then
    raise exception 'Not authenticated';
  end if;
  if v_role <> 'ADMIN' then
    raise exception 'Only admins can fetch completion report';
  end if;

  -- Build the report in one CTE pipeline. The four LEFT JOINs to
  -- quarter_counts are intentional: they preserve the "NOT_STARTED" state
  -- for employees / quarters with zero check-ins.
  with
    employees as (
      select id, full_name, email, department, manager_id
      from public.profiles
      where role = 'EMPLOYEE'
    ),
    approved_sheets as (
      select id as sheet_id, employee_id
      from public.goal_sheets
      where status = 'APPROVED'
    ),
    emp_goals as (
      select g.id as goal_id, s.employee_id
      from public.goals g
      join approved_sheets s on s.sheet_id = g.sheet_id
    ),
    totals as (
      select employee_id, count(*)::int as total_goals
      from emp_goals
      group by employee_id
    ),
    quarter_counts as (
      select
        eg.employee_id,
        ci.quarter,
        count(*)::int as ci_count,
        (count(*) filter (where ci.status = 'COMPLETED'))::int as done_count
      from emp_goals eg
      join public.check_ins ci on ci.goal_id = eg.goal_id
      group by eg.employee_id, ci.quarter
    )
  select coalesce(jsonb_agg(
    jsonb_build_object(
      'employee_id',    e.id,
      'employee_name',  coalesce(nullif(e.full_name, ''), e.email),
      'employee_email', e.email,
      'department',     e.department,
      'manager_id',     e.manager_id,
      'manager_name',   coalesce(nullif(m.full_name, ''), m.email),
      'quarters', jsonb_build_object(
        'Q1', case
          when coalesce(q1.ci_count, 0) = 0 then 'NOT_STARTED'
          when coalesce(q1.done_count, 0) = coalesce(t.total_goals, 0)
               and coalesce(t.total_goals, 0) > 0 then 'COMPLETED'
          else 'IN_PROGRESS'
        end,
        'Q2', case
          when coalesce(q2.ci_count, 0) = 0 then 'NOT_STARTED'
          when coalesce(q2.done_count, 0) = coalesce(t.total_goals, 0)
               and coalesce(t.total_goals, 0) > 0 then 'COMPLETED'
          else 'IN_PROGRESS'
        end,
        'Q3', case
          when coalesce(q3.ci_count, 0) = 0 then 'NOT_STARTED'
          when coalesce(q3.done_count, 0) = coalesce(t.total_goals, 0)
               and coalesce(t.total_goals, 0) > 0 then 'COMPLETED'
          else 'IN_PROGRESS'
        end,
        'Q4', case
          when coalesce(q4.ci_count, 0) = 0 then 'NOT_STARTED'
          when coalesce(q4.done_count, 0) = coalesce(t.total_goals, 0)
               and coalesce(t.total_goals, 0) > 0 then 'COMPLETED'
          else 'IN_PROGRESS'
        end
      )
    )
    order by coalesce(nullif(e.full_name, ''), e.email)
  ), '[]'::jsonb) into v_result
  from employees e
  left join public.profiles    m  on m.id = e.manager_id
  left join totals             t  on t.employee_id = e.id
  left join quarter_counts q1 on q1.employee_id = e.id and q1.quarter = 'Q1'
  left join quarter_counts q2 on q2.employee_id = e.id and q2.quarter = 'Q2'
  left join quarter_counts q3 on q3.employee_id = e.id and q3.quarter = 'Q3'
  left join quarter_counts q4 on q4.employee_id = e.id and q4.quarter = 'Q4';

  return v_result;
end;
$$;

grant execute on function public.get_completion_report() to authenticated;

-- =============================================================================
-- Verification (psql):
--   select jsonb_array_length(public.get_completion_report()) as employee_count;
--   -- should equal `select count(*) from profiles where role = 'EMPLOYEE'`.
-- =============================================================================
