# Phase 2 — P3 Analytics Module Testing Walkthrough

> Covers Sections 20 – 23. Do these IN ORDER. Each step tells you exactly what to do, what you should see, and includes a tick box to mark done.

---

## Status: ⬜ Not started

---

## Before You Start

Make sure:

- `npm run dev` is running
- App opens at `http://localhost:5173` (or 5174 if 5173 is busy)
- All migrations applied IN ORDER:
  - `0001_phase1_schema.sql`
  - `0002_phase1_test_fixes.sql`
  - `0003_admin_reopen.sql`
  - `0004_phase2_checkins.sql`
  - `0005_admin_delete_user.sql`
  - `0006_analytics_summary.sql` ← **new for P3**

### Seed data needed for meaningful charts

For the charts to actually show something:

- **At least 2 managers** with direct reports (otherwise Team Completion Rate and Manager Effectiveness are empty)
- **At least 2 departments** represented (otherwise "Per dept" mode in the QoQ chart has nothing to split)
- **At least 3 goals on APPROVED sheets** with mixed `thrust_area` and `uom` values (otherwise the distribution pies are trivial)
- **Check-ins saved across at least 2 quarters** with mixed `status` values (`NOT_STARTED`, `ON_TRACK`, `COMPLETED`) — gives the trend line shape and the status pie variety

If your DB is fresh, you'll mostly see "No data yet" placeholders — that's a valid pass for those tests (Section 23 specifically tests the empty state).

> Today's date is May 2026 → **current quarter is Q4 (Apr–Jun)**. Several charts focus on Q4 specifically.

---

## SECTION 20 — Access, Routing & View Setup

---

### 20.1 — Migration 0006 created the analytics_summary view

**What to do:**

1. Open Supabase → SQL Editor
2. Run: `select count(*) from public.analytics_summary;`

**What you should see:**

- Query succeeds (no "relation does not exist" error)
- Returns an integer ≥ 0
- View columns include: `employee_id, employee_name, department, manager_id, manager_name, goal_id, goal_title, thrust_area, uom, target, weightage, sheet_status, quarter, actual, score, checkin_status`

**Mark done when:** View exists and is queryable.

- [*] Pass / [ ] Fail — notes:

---

### 20.2 — Admin sees "Analytics" sidebar link

**What to do:**

1. Log in as `admin@demo.com`
2. Look at the sidebar

**What you should see:**

- A new **Analytics** item below "Reports", with a trending-up icon
- Hover effect works

**Mark done when:** Link appears in the admin nav.

- [*] Pass / [ ] Fail — notes:

---

### 20.3 — Clicking "Analytics" opens /admin/analytics

**What to do:**

1. Click the **Analytics** link

**What you should see:**

- URL changes to `/admin/analytics`
- Page title "Analytics Overview" with a one-line subtitle
- Snapshot stats row at the top: **Employees tracked / Goals total / Goals approved / Check-ins recorded**
- Four chart cards in a 2×2 grid below

**Mark done when:** Page renders with stats + 4 chart areas.

- [*] Pass / [ ] Fail — notes:

---

### 20.4 — Non-admin cannot access /admin/analytics

**What to do — two scenarios:**

Scenario A — Manager:

1. Log out → log in as `manager@demo.com`
2. Manually type `http://localhost:5173/admin/analytics`

Scenario B — Employee:

1. Log out → log in as `employee@demo.com`
2. Manually type `http://localhost:5173/admin/analytics`

**What you should see (both scenarios):**

- Redirect to the user's own role home
- Analytics page is NOT shown

**Mark done when:** Both scenarios redirect away.

- [*] Pass / [ ] Fail — notes:

---

## SECTION 21 — Chart 1 · QoQ Achievement Trend

---

### 21.1 — Whole-org line renders with correct shape

**What to do:**

1. On `/admin/analytics`, find the **QoQ Achievement Trend** card
2. Default mode should be "Whole org" (filled button)
3. Look at the line

**What you should see:**

- LineChart with 4 X-axis ticks: Q1, Q2, Q3, Q4
- Y-axis ranges 0–100, labelled with `%`
- A single line labelled "Org" showing the average score per quarter (only for quarters that have check-ins; gaps connected via `connectNulls`)
- Hover shows a tooltip with `Org: NN%`

**Mark done when:** Line chart renders with correct axes and at least one data point.

- [*] Pass / [ ] Fail / [ ] Skipped (no check-ins) — notes:

---

### 21.2 — "Per dept" mode splits the line per department

**What to do:**

1. Click the **Per dept** toggle (filled when active)
2. Look at the lines

**What you should see:**

- One line per department represented in the data (e.g. Sales, Engineering)
- Legend at the bottom lists each department with its colour
- Tooltip shows `Sales: 80%`, `Engineering: 92%`, etc.
- "Per dept" button is disabled if no departments exist in the data

**Mark done when:** Multi-line view renders with one line per department.

- [*] Pass / [ ] Fail / [ ] Skipped (no multi-dept data) — notes:

---

### 21.3 — Score math is correct

**What to do:**

1. Pick a quarter and a department where you saved check-ins
2. Manually compute: average of all `score` values across all goals × all employees in that dept for that quarter
3. Compare to the value shown by the chart

**What you should see:**

- Chart value matches your manual average within ±0.1% (we round to 1 decimal)

**Mark done when:** Manual check matches the chart.

- [*] Pass / [ ] Fail — notes:

---

## SECTION 22 — Chart 2 · Goal Distribution

---

### 22.1 — Three tabs switch the pie correctly

**What to do:**

1. Find the **Goal Distribution** card
2. Click each tab in turn: **Thrust Area · UoM · Status**

**What you should see:**

- Each tab shows a different pie chart
- Active tab button is filled (default variant), others are outline
- Pie has slices for each distinct value
- Each slice is labelled `Name (count · pct%)` (e.g. `NUMERIC (5 · 62%)`)

**Mark done when:** All three tabs render their own pies.

- [*] Pass / [ ] Fail — notes:

---

### 22.2 — Pie counts match the underlying data

**What to do:**

1. **Thrust Area** tab: count distinct goals per thrust_area in your data
2. **UoM** tab: count goals per uom
3. **Status** tab: count check_ins by status

**What you should see:**

- The label values match your manual count
- Percentages sum to ~100% (rounding can yield 99–101%)

**Mark done when:** All three pies' counts are accurate.

- [*] Pass / [ ] Fail — notes:

---

### 22.3 — Hovering a slice shows the tooltip

**What to do:**

1. Hover over each slice in any of the three pies

**What you should see:**

- Tooltip shows the slice's value with its percentage in parentheses (e.g. `5 (62%)`)
- Slice highlights on hover

**Mark done when:** Tooltips render correctly.

- [*] Pass / [ ] Fail — notes:

---

## SECTION 23 — Chart 3 · Team Completion Rate

---

### 23.1 — Horizontal bar chart renders per manager

**What to do:**

1. Find the **Team Completion Rate · Q4** card (title includes current quarter)
2. Look at the bars

**What you should see:**

- Horizontal BarChart with Y-axis listing manager names
- X-axis 0–100% with `%` ticks
- One bar per manager, sorted by completion rate descending
- Bars are colour-coded: > 80% green, 50–80% amber, < 50% red

**Mark done when:** Bars render with correct colours and ordering.

- [*] Pass / [ ] Fail / [ ] Skipped (no managers with reports) — notes:

---

### 23.2 — Completion math is correct

**What to do:**

1. Pick a manager
2. Manually compute: how many of their direct reports have **every approved goal** with a `COMPLETED` check-in in **Q4**? Divide by their total trackable team size (reports with at least one approved goal). Multiply by 100.
3. Compare to the bar value (tooltip shows the exact %)

**What you should see:**

- Chart value matches your manual computation within ±0.1%

**Mark done when:** Completion rate math is accurate.

- [*] Pass / [ ] Fail — notes:

---

## SECTION 24 — Chart 4 · Manager Effectiveness Table

---

### 24.1 — Table renders with correct columns

**What to do:**

1. Scroll to the **Manager Effectiveness** card
2. Look at the table

**What you should see:**

- Columns: Manager · Team Size · Goals Approved · Avg Check-in Score · Completion Rate
- One row per manager who has at least one direct report
- Rows sorted by Completion Rate descending

**Mark done when:** Table renders with all five columns.

- [*] Pass / [ ] Fail / [ ] Skipped (no managers with reports) — notes:

---

### 24.2 — Colour bands on Avg Score and Completion Rate

**What to do:**

1. Look at the Avg Check-in Score and Completion Rate columns

**What you should see:**

- Avg Score colours: ≥ 100% green, 75–99% amber, < 75% red, missing "—" muted
- Completion Rate colours: > 80% green, 50–80% amber, < 50% red

**Mark done when:** Colour coding is correct in both columns.

- [*] Pass / [ ] Fail — notes:

---

### 24.3 — Numbers match the underlying data

**What to do:**

1. Pick one manager
2. Team Size = count their direct reports (employees whose `manager_id` is this manager's id)
3. Goals Approved = distinct goal_ids on APPROVED sheets across their team
4. Avg Check-in Score = mean of all `score` values across their team's check_ins (every quarter)
5. Completion Rate matches Chart 3's bar
6. Compare to the table

**What you should see:**

- All four numbers match your manual computation

**Mark done when:** Numbers are accurate.

- [*] Pass / [ ] Fail — notes:

---

## SECTION 25 — Empty States & Resilience

---

### 25.1 — Each chart shows "No data yet" gracefully when its data is empty

**What to do (try one of these scenarios):**

Scenario A — fresh DB:

1. On a fresh DB with no approved sheets and no check-ins, visit `/admin/analytics`

Scenario B — partial data:

1. With some goals but zero check-ins, visit the page

**What you should see:**

- QoQ chart shows "No data yet — no check-ins recorded across any quarter." (when no check-ins)
- Goal Distribution shows "No data yet — no goals match this view." (when no goals)
- Team Completion shows "No data yet — no managers have direct reports with approved goals." (when no manager has reports)
- Manager Effectiveness table shows "No data yet — no managers have direct reports."
- No console crashes, no infinite loaders

**Mark done when:** All empty placeholders render cleanly.

- [*] Pass / [ ] Fail / [ ] Skipped — notes:

---

### 25.2 — Loading skeletons appear briefly on first load

**What to do:**

1. Hard refresh `/admin/analytics` (Ctrl+Shift+R)
2. Watch each chart card in the first second

**What you should see:**

- For a moment, each chart area shows a pulsing muted-grey skeleton block (`animate-pulse bg-muted/40`)
- Skeletons are replaced by real charts as soon as the analytics_summary fetch resolves

**Mark done when:** Skeletons appear, then disappear after data arrives.

- [*] Pass / [ ] Fail — notes:

---

### 25.3 — RLS denies analytics_summary to non-admins

**What to do:**

1. Sign in as `employee@demo.com`
2. Open DevTools → Console:
   ```js
   const { supabase } = await import("/src/lib/supabase.ts");
   const { data, error } = await supabase.from("analytics_summary").select("*");
   console.log({ rowCount: (data ?? []).length, error });
   ```

**What you should see:**

- Either `error` is non-null (RLS denied) OR `rowCount` is limited to just the employee's own data (because the view is SECURITY INVOKER and underlying RLS only lets them see their own profile/goals/check_ins)
- The employee does NOT see other employees' rows

**Mark done when:** Non-admin cannot read the full org view.

- [*] Pass / [ ] Fail — notes:

---

## Summary Checklist

Copy this into your tracker when done.

### Section 20 — Access, Routing & View Setup

- [*] 20.1 `analytics_summary` view created and queryable
- [*] 20.2 "Analytics" sidebar link visible to admin
- [*] 20.3 Page loads with stats + 4 chart areas
- [*] 20.4 Non-admin cannot access `/admin/analytics`

### Section 21 — QoQ Achievement Trend

- [*] 21.1 Whole-org line renders
- [*] 21.2 Per-dept mode splits into multiple lines
- [*] 21.3 Score averaging math is correct

### Section 22 — Goal Distribution

- [*] 22.1 Three tabs (Thrust / UoM / Status) switch correctly
- [*] 22.2 Counts match underlying data
- [*] 22.3 Tooltips render correctly

### Section 23 — Team Completion Rate

- [*] 23.1 Horizontal bar chart with correct colours
- [*] 23.2 Completion math correct (Q4 focused)

### Section 24 — Manager Effectiveness Table

- [*] 24.1 Table renders with all 5 columns
- [*] 24.2 Colour bands on Avg Score and Completion Rate
- [*] 24.3 Underlying numbers accurate

### Section 25 — Empty States & Resilience

- [*] 25.1 "No data yet" placeholders render gracefully
- [*] 25.2 Loading skeletons appear briefly on first load
- [*] 25.3 RLS denies analytics_summary to non-admins
