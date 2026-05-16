## Important: Phase 1 Implementation Details That Affect Phase 2

Read these before writing a single line. Phase 1 deviated from the original plan in ways that matter:

- `goals` table is **denormalised** — shared goals are rows in `goals` with `is_shared = true` and `shared_by = admin_uuid`. The `shared_goals` join table exists in schema but is NOT used. Always query `goals` where `is_shared = true`, never `shared_goals`.
- `goals.shared_by` added in migration 0002 — join to `profiles` for sharer name.
- `goal_sheets` has extra columns from migration 0003: `reopened_by`, `reopened_at`.
- `audit_logs` already has rows for actions `APPROVED` and `REOPEN_BY_ADMIN`. Phase 2 must write additional actions: `CHECK_IN_SAVED`, `MANAGER_COMMENT_SAVED`.
- Score functions already exist in `src/lib/utils.ts` — import and use, never rewrite.
- `check_ins` table already exists from migration 0001: `id, goal_id, quarter, actual, actual_date, status, manager_comment, score, created_at, updated_at`.
- Next migration must be numbered `0004`.

---

## Build Order — Strict Priority

| Priority | Group | BRD Reference |
|----------|-------|---------------|
| P1 | Quarterly check-in module | Phase 2 core — required |
| P2 | Reporting & governance | Section 4 — judges check this |
| P3 | Analytics module | Section 5.4 — bonus points |

---

## P1 — Quarterly Check-in Module

### Database

**New file: `supabase/migrations/0004_phase2_checkins.sql`**

Add RLS policies for `check_ins` (add only if missing — check first):
- Employee can INSERT check_ins for goals belonging to their own APPROVED sheet only
- Employee can UPDATE check_ins for goals belonging to their own APPROVED sheet only
- Manager can SELECT check_ins for goals belonging to their team's sheets
- Manager can UPDATE only the `manager_comment` field on any check_in
- Admin can SELECT all check_ins
- Admin can UPDATE all check_ins

No new tables needed.

---

### Zustand Store Updates

**`src/stores/goalSheetStore.ts` — new state and actions to add:**

New state:
- `checkIns` — map keyed by `goal_id`, value is array of CheckIn objects across all quarters

New actions:
- `fetchCheckIns(sheetId)` — load all check_ins for all goals in the current approved sheet, populate the map
- `saveCheckIn(goalId, quarter, actual, actualDate, status)` — upsert into check_ins (insert if no row for that goal+quarter, update if exists). Compute score using utils.ts and store it in `check_ins.score`. Write an audit_log row with action `CHECK_IN_SAVED`.

**`src/stores/managerStore.ts` — new state and actions to add:**

New state:
- `selectedEmployeeCheckIns` — goals with their check_ins for the employee currently being reviewed

New actions:
- `fetchTeamCheckIns(employeeId, quarter)` — load all APPROVED goals for an employee joined with their check_ins for the given quarter
- `saveManagerComment(checkInId, comment)` — update `manager_comment` on a check_in. Write audit_log row with action `MANAGER_COMMENT_SAVED`.

---

### New Components

**`src/components/goals/QuarterSelector.tsx`**
- Tab or segmented button: Q1 / Q2 / Q3 / Q4
- Quarter mapping: Q1 = Jul–Sep, Q2 = Oct–Dec, Q3 = Jan–Mar, Q4 = Apr–Jun
- Auto-highlights current quarter based on today's month
- All quarters remain selectable — do not hard-block any for demo
- Props: `activeQuarter`, `onQuarterChange(quarter)`

**`src/components/goals/CheckInForm.tsx`**
- One row per goal
- Input type driven by `goal.uom`:
  - NUMERIC or PERCENT → number input, label "Actual Value"
  - TIMELINE → date picker, label "Completion Date"
  - ZERO → number input, label "Incident Count (0 = success)"
- Status dropdown: Not Started / On Track / Completed
- Score preview updates in real time as user types (call utils.ts score functions)
- Individual Save button per row
- Entire row disabled if sheet is not APPROVED

**`src/components/goals/CheckInScoreCard.tsx`**
- Shows for one goal: Planned Target | Actual | Score %
- Score colour coding: ≥ 100% → green, 75–99% → amber, < 75% → red
- UoM shown as a small badge
- Quarter label shown

**`src/components/manager/ManagerCheckInView.tsx`**
- Table columns: Goal Title | Thrust Area | UoM | Target | Actual | Score | Status | Manager Comment
- All columns read-only except Manager Comment
- Manager Comment: click cell → inline textarea opens with Save button
- Score column uses same colour coding as CheckInScoreCard
- QuarterSelector shown at top of this component

---

### New Pages

**`src/pages/employee/CheckInsPage.tsx`**
- QuarterSelector at top
- List of all goals from employee's APPROVED sheet, each rendered as CheckInForm
- If sheet not APPROVED → message: "Your goal sheet must be approved before logging check-ins"
- If no goals → empty state illustration

**`src/pages/manager/ManagerCheckInsPage.tsx`**
- Dropdown to select team member
- QuarterSelector below
- ManagerCheckInView for selected employee + quarter
- If selected employee has no APPROVED sheet → "No approved sheet for this employee"

---

### Routing & Navigation

`src/App.tsx` — add routes:
- `/employee/checkins` → CheckInsPage (EMPLOYEE, ProtectedRoute)
- `/manager/checkins` → ManagerCheckInsPage (MANAGER, ProtectedRoute)

`src/components/layout/Sidebar.tsx` — add links:
- Employee section: "My Check-ins" → `/employee/checkins`
- Manager section: "Team Check-ins" → `/manager/checkins`

---

### P1 Validation Rules
- Cannot save check-in if goal's sheet status ≠ APPROVED
- Actual value required — no empty saves
- ZERO UoM: actual must be non-negative integer
- TIMELINE UoM: actual_date cannot be null
- Score must be computed and stored in `check_ins.score` at save time

---

## P2 — Reporting & Governance

### Database
No new tables. All reports are read-only queries on existing data.

---

### New Components

**`src/components/shared/ExportButton.tsx`** (replace existing placeholder)
- Props: `data[]`, `filename: string`, `label: string`
- Uses xlsx: `XLSX.utils.json_to_sheet(data)` → `XLSX.writeFile`
- Loading spinner on click
- Output filename: `{filename}-{YYYY-MM-DD}.xlsx`

**`src/components/admin/CompletionTable.tsx`**
- Table: Employee Name | Manager Name | Q1 | Q2 | Q3 | Q4
- Quarter cell values:
  - ✅ Completed — all goals have a check_in with status COMPLETED for that quarter
  - ⏳ In Progress — some check_ins exist but not all COMPLETED
  - — Not Started — no check_ins for that quarter
- Summary line above table: "X of Y employees completed Q{n} check-ins"
- Filter: dropdown by Manager name

**`src/components/admin/AuditTable.tsx`**
- Table: Timestamp | Changed By | Action | Reference | Old Value | New Value
- Sorted newest first
- Action badge colours: APPROVED → green, REOPEN_BY_ADMIN → amber, CHECK_IN_SAVED → blue, MANAGER_COMMENT_SAVED → gray
- Old/New Value: truncated text, click row to expand full JSON in monospace font
- Changed By: `full_name` from profiles join on `changed_by`

---

### New Pages

**`src/pages/admin/ReportsPage.tsx`**
- Three tabs using shadcn Tabs: Achievement Export | Completion Dashboard | Audit Trail

Tab 1 — Achievement Export:
- Table: Employee Name | Department | Goal Title | Thrust Area | UoM | Target | Q1 Actual | Q2 Actual | Q3 Actual | Q4 Actual | Score
- Filters: Department (dropdown), Status (dropdown)
- ExportButton top-right — exports current filtered table as Excel
- Score cells colour coded

Tab 2 — Completion Dashboard:
- CompletionTable component
- Summary stats above: total employees, completed this quarter, still pending

Tab 3 — Audit Trail:
- AuditTable component

---

### Routing & Navigation

`src/App.tsx` — add route:
- `/admin/reports` → ReportsPage (ADMIN, ProtectedRoute)

`src/components/layout/Sidebar.tsx` — add link:
- Admin section: "Reports" → `/admin/reports`

---

## P3 — Analytics Module (Bonus)

### Database

**Add to migration 0004 or new `0005_analytics_view.sql`**

Create Supabase view `analytics_summary` joining:
- `profiles` (employee) + `goal_sheets` + `goals` + `check_ins` + `profiles` again (manager via `manager_id`)

Columns to expose:
- `employee_id`, `employee_name`, `department`
- `manager_id`, `manager_name`
- `goal_id`, `goal_title`, `thrust_area`, `uom`, `target`, `weightage`
- `sheet_status`
- `quarter`, `actual`, `score`, `checkin_status`

This single view powers all 4 charts. Query it from the store like any normal table.

---

### New Zustand Store

**`src/stores/analyticsStore.ts`**

State: `summary[]` (rows from analytics_summary view), `loading`

Actions:
- `fetchAnalytics()` — load all rows from analytics_summary view

---

### New Components

**`src/components/admin/AnalyticsDashboard.tsx`**

Contains all 4 charts. Each in a shadcn Card with title and one-line description. Loading skeletons while fetching. All charts show "No data yet" placeholder when empty — never crash.

Chart 1 — QoQ Achievement Trend:
- Recharts LineChart
- X axis: Q1, Q2, Q3, Q4
- Y axis: average score % (0–100)
- Toggle: whole org vs per-department lines
- Data source: average of `score` grouped by quarter from analytics_summary

Chart 2 — Goal Distribution:
- Recharts PieChart (three small pies or tabbed single pie)
- Pie A: goals by Thrust Area
- Pie B: goals by UoM type
- Pie C: goals by check-in status
- Each slice labeled with count and %

Chart 3 — Team Completion Rate:
- Recharts BarChart (horizontal)
- Y axis: manager names
- X axis: completion % (0–100)
- Bar colour: > 80% green, 50–80% amber, < 50% red
- Data: % of each manager's team with COMPLETED check-ins for current quarter

Chart 4 — Manager Effectiveness:
- shadcn Table (not a chart)
- Columns: Manager Name | Team Size | Goals Approved | Avg Check-in Score | Completion Rate
- Sorted by Completion Rate descending
- Avg Score and Completion Rate cells colour coded

---

### New Pages

**`src/pages/admin/AnalyticsPage.tsx`**
- Calls `analyticsStore.fetchAnalytics()` on mount
- Renders AnalyticsDashboard
- Page title: "Analytics Overview"

---

### Routing & Navigation

`src/App.tsx` — add route:
- `/admin/analytics` → AnalyticsPage (ADMIN, ProtectedRoute)

`src/components/layout/Sidebar.tsx` — add link:
- Admin section: "Analytics" → `/admin/analytics`

---

## Files to Create — In Order

### P1 — Check-ins (build and test fully before moving to P2)
1. `supabase/migrations/0004_phase2_checkins.sql`
2. `src/components/goals/QuarterSelector.tsx`
3. `src/components/goals/CheckInForm.tsx`
4. `src/components/goals/CheckInScoreCard.tsx`
5. `src/components/manager/ManagerCheckInView.tsx`
6. `src/pages/employee/CheckInsPage.tsx`
7. `src/pages/manager/ManagerCheckInsPage.tsx`
8. Update `src/stores/goalSheetStore.ts`
9. Update `src/stores/managerStore.ts`
10. Update `src/components/layout/Sidebar.tsx`
11. Update `src/App.tsx`

### P2 — Reporting (build and test fully before moving to P3)
12. `src/components/shared/ExportButton.tsx`
13. `src/components/admin/CompletionTable.tsx`
14. `src/components/admin/AuditTable.tsx`
15. `src/pages/admin/ReportsPage.tsx`
16. Update `src/components/layout/Sidebar.tsx`
17. Update `src/App.tsx`

### P3 — Analytics (build last)
18. `analytics_summary` view — create in Supabase SQL Editor
19. `src/stores/analyticsStore.ts`
20. `src/components/admin/AnalyticsDashboard.tsx`
21. `src/pages/admin/AnalyticsPage.tsx`
22. Update `src/components/layout/Sidebar.tsx`
23. Update `src/App.tsx`

---

## Notes for Claude Code

- Do NOT query `shared_goals` table — it is unused. Query `goals` where `is_shared = true`.
- Score functions are in `src/lib/utils.ts` — import them, never rewrite.
- `check_ins` table already exists — only add RLS in migration 0004, do not recreate.
- Next migration must be numbered `0004`.
- Recharts is already installed — use LineChart, BarChart, PieChart from recharts.
- xlsx is already installed — use `XLSX.utils.json_to_sheet` + `XLSX.writeFile`.
- All Supabase queries go inside Zustand store actions — never directly in components.
- Keep same AppShell + Sidebar + ProtectedRoute pattern from Phase 1.
- Write audit_log entries for CHECK_IN_SAVED and MANAGER_COMMENT_SAVED inside store actions.
- Quarter selector must not hard-block any quarter — all selectable for demo.
- All charts must handle zero rows gracefully — placeholder, never crash.