# Phase 2 — P2 Reporting & Governance Testing Walkthrough
> Covers Sections 16 – 19. Do these IN ORDER. Each step tells you exactly what to do, what you should see, and includes a tick box to mark done.

---

## Status: ✅ All P2 tests passed

---

## Before You Start

Make sure:
- `npm run dev` is running
- App opens at `http://localhost:5173` (or 5174 if 5173 is busy)
- All 3 demo users exist (`employee@demo.com`, `manager@demo.com`, `admin@demo.com` — all with `Demo@1234`)
- Migrations applied IN ORDER:
  - `0001_phase1_schema.sql`
  - `0002_phase1_test_fixes.sql`
  - `0003_admin_reopen.sql`
  - `0004_phase2_checkins.sql`
  - `0005_admin_delete_user.sql`
- **No new migration is needed for P2** — all reports are read-only against existing tables.

### Recommended seed data for meaningful results
For the dashboards to actually show something interesting, ideally you have:
- **At least 2 employees** (different departments help test the Department filter)
- **At least one APPROVED sheet** with 3+ goals
- **Check-ins saved across multiple quarters** — e.g. one goal with Q4 status `COMPLETED`, one with `ON_TRACK`, one with no check-in. This lets you see all three states (✅ / ⏳ / —) in the Completion Dashboard.
- **Some audit history** — by now you should already have rows for `APPROVE`, `RETURN`, `CHECK_IN_SAVED`, `MANAGER_COMMENT_SAVED`, and (if you've tested admin user mgmt) `ADMIN_DELETED_USER`.

---

## SECTION 16 — Reports Access & Routing

---

### 16.1 — Admin sees "Reports" sidebar link

**What to do:**
1. Log in as `admin@demo.com`
2. Look at the sidebar

**What you should see:**
- A **Reports** item below "Shared Goals", with a chart/bar icon
- Hover effect on the link works

**Mark done when:** Link is visible and behaves like other admin nav items.

- [x] Pass — notes:

---

### 16.2 — Clicking "Reports" opens /admin/reports

**What to do:**
1. Click the **Reports** link

**What you should see:**
- URL changes to `/admin/reports`
- Page title "Reports" with subtitle "Achievement export, completion dashboard, and audit trail — for HR governance."
- Three tab triggers visible: **Achievement Export · Completion Dashboard · Audit Trail**

**Mark done when:** Page renders with the three tab triggers.

- [x] Pass — notes:

---

### 16.3 — Tab switching works (shadcn Tabs fix verified)

**What to do:**
1. Click each tab in turn: Achievement Export → Completion Dashboard → Audit Trail → back to Achievement Export

**What you should see:**
- The active tab visually highlights (different background from the others)
- The content panel below changes per tab — three distinct cards
- No console errors

**Mark done when:** Active tab highlight follows your clicks and the right content shows.

- [x] Pass — notes:

---

### 16.4 — Non-admin cannot access /admin/reports

**What to do — test 2 scenarios:**

Scenario A:
1. Log out → log in as `manager@demo.com`
2. Manually type `http://localhost:5173/admin/reports` into the browser

Scenario B:
1. Log out → log in as `employee@demo.com`
2. Manually type `http://localhost:5173/admin/reports`

**What you should see (both scenarios):**
- Redirect to the user's own role home (`/manager/dashboard` or `/employee/dashboard`)
- The Reports page is NOT shown

**Mark done when:** Both scenarios redirect away from `/admin/reports`.

- [x] Pass — notes:

---

## SECTION 17 — Achievement Export Tab

---

### 17.1 — Table renders with all expected columns

**What to do:**
1. On `/admin/reports` → **Achievement Export** tab
2. Look at the table

**What you should see:**
- Columns in order: Employee · Department · Goal Title · Thrust Area · UoM · Target · Q1 · Q2 · Q3 · Q4 · Score
- One row per (employee × goal); rows sorted by employee name
- UoM appears as a small badge

**Mark done when:** Columns and rows render correctly.

- [x] Pass — notes:

---

### 17.2 — Score column is colour-coded

**What to do:**
1. Find rows where the employee has saved a check-in (Score not "—")

**What you should see:**
- Score ≥ 100% → green text (`text-emerald-600`)
- 75 ≤ Score < 100 → amber text (`text-amber-600`)
- Score < 75 → red text (`text-rose-600`)
- No score (no check-ins yet) → muted "—"

**Mark done when:** Score colours match the bands.

- [x] Pass — notes:

---

### 17.3 — Score is the LATEST non-null quarter

**What to do:**
1. Pick a goal in the table; note the score shown
2. Compare against the row's Q1/Q2/Q3/Q4 actuals

**What you should see:**
- The score corresponds to the **latest** quarter that has a saved check-in (Q4 → Q3 → Q2 → Q1, first hit)
- Example: if Q4 has an actual but Q3 doesn't, score is from Q4
- Example: if only Q2 has an actual, score is from Q2

**Mark done when:** Score matches the latest-quarter check-in.

- [x] Pass — notes:

---

### 17.4 — Department filter works

**What to do:**
1. Click the **Department** dropdown
2. Pick a specific department (e.g. "Sales" — whatever you seeded)
3. Switch back to "All departments"

**What you should see:**
- Dropdown lists only departments that exist in the data (no manually-added entries)
- When a department is selected, only goals belonging to employees in that department appear
- "All departments" returns the full list

**Mark done when:** Filter narrows and resets correctly.

- [x] Pass — notes:

---

### 17.5 — Sheet status filter works

**What to do:**
1. Open the **Sheet status** dropdown
2. Pick `APPROVED`, then `DRAFT`, then `SUBMITTED`, then `RETURNED`
3. Switch back to "All statuses"

**What you should see:**
- Each status filters rows to goals whose parent sheet has that status
- Non-APPROVED rows show blank Q1–Q4 actuals (expected — check_ins gated on APPROVED)

**Mark done when:** Filter narrows by sheet status.

- [x] Pass — notes:

---

### 17.6 — Export button downloads a valid Excel file

**What to do:**
1. Make sure both filters are "All …" so you export everything
2. Click **Export to Excel**
3. Watch the button — it should briefly show a spinner + "Exporting…"
4. A file should be downloaded by the browser

**What you should see:**
- Toast: "Export complete · N row(s) downloaded."
- File downloaded: `achievement-report-YYYY-MM-DD.xlsx` (today's date)
- Open the file in Excel / LibreOffice / Numbers
- Columns match the on-screen table: Employee · Department · Sheet Status · Goal Title · Thrust Area · UoM · Target · Weightage % · Q1 Actual · Q2 Actual · Q3 Actual · Q4 Actual · Score %

**Mark done when:** Excel file downloads and opens cleanly with the right columns.

- [x] Pass — notes:

---

### 17.7 — Export respects the current filter

**What to do:**
1. Apply Department filter = a specific department
2. Click **Export to Excel**
3. Open the file

**What you should see:**
- Only rows for the filtered department are in the Excel file
- Row count matches what's on screen

**Mark done when:** Filtered export matches the visible table.

- [x] Pass — notes:

---

### 17.8 — "Nothing to export" toast on empty filter

**What to do:**
1. Apply filters that produce **zero rows** (e.g. a department with no employees)
2. Click **Export to Excel**

**What you should see:**
- No file downloads
- Toast appears: "Nothing to export · The current view has no rows."

**Mark done when:** Empty exports are blocked with a friendly toast.

- [x] Pass — notes:

---

## SECTION 18 — Completion Dashboard Tab

---

### 18.1 — Three stat tiles render up top

**What to do:**
1. Switch to the **Completion Dashboard** tab

**What you should see:**
- Three tiles in a row: **Employees** · **Completed {Q4}** · **Pending {Q4}** (current quarter)
- Numbers are integers, not "—" (unless still loading)
- Tile values change instantly as you change the Manager filter

**Mark done when:** Stats render and update with the filter.

- [x] Pass — notes:

---

### 18.2 — Completion table shows correct three states per quarter

**What to do:**
1. Look at the table — Employee · Manager · Q1 · Q2 · Q3 · Q4 columns
2. Pick an employee. For each quarter cell, mentally verify:
   - **✅ Completed** (green) — that employee has a check_in with status `COMPLETED` for every approved goal that quarter
   - **⏳ In Progress** (amber) — some check_ins exist for that quarter but not all are `COMPLETED`
   - **— Not Started** (muted) — no check_ins for that quarter

**What you should see:**
- All three icon/colour combinations appear correctly per cell
- Employee name shows department below it as a small subline
- Manager column shows the manager's full name

**Mark done when:** All three states render correctly across at least one employee row.

- [x] Pass — notes:

---

### 18.3 — Only APPROVED sheets are tracked

**What to do:**
1. Find an employee whose sheet is `DRAFT` or `SUBMITTED` (not yet approved)
2. Look at their row

**What you should see:**
- All four quarters show "— Not Started" (because non-APPROVED sheets cannot have check_ins)
- The employee still appears in the table (we don't hide them)

**Mark done when:** Non-approved employees show all quarters as Not Started.

- [x] Pass — notes:

---

### 18.4 — Manager filter narrows the table

**What to do:**
1. Click the **Filter by manager** dropdown
2. Pick a specific manager
3. Switch back to "All managers"

**What you should see:**
- Dropdown lists all managers who have at least one direct report
- When a manager is selected, only their reports appear
- Summary line above the table updates: "X of Y employees completed Q4 check-ins" — Y reflects the filter

**Mark done when:** Filter works in both directions and the summary updates.

- [x] Pass — notes:

---

### 18.5 — Summary line is accurate

**What to do:**
1. Count manually: how many employees in your current filter have **all four quarters' goals marked COMPLETED** for Q4? (Or whatever the current quarter is.)
2. Compare to the "X of Y" summary above the table

**What you should see:**
- The numbers match what you counted
- X ≤ Y always

**Mark done when:** Summary matches the underlying data.

- [x] Pass — notes:

---

## SECTION 19 — Audit Trail Tab

---

### 19.1 — Rows load newest first

**What to do:**
1. Switch to the **Audit Trail** tab
2. Look at the Timestamp column

**What you should see:**
- Top row is the most recent audit_logs entry
- Timestamps descend as you scroll down
- Each row has Timestamp · Changed By · Action · Reference · Old Value (preview) · New Value (preview)

**Mark done when:** Rows are sorted newest first.

- [x] Pass — notes:

---

### 19.2 — Action badges are colour-coded

**What to do:**
1. Scan the Action column for different action types in your data:
   - `APPROVE` / `APPROVED` — green
   - `RETURN` / `RETURNED` / `REOPEN_BY_ADMIN` — amber
   - `CHECK_IN_SAVED` — sky blue
   - `MANAGER_COMMENT_SAVED` — secondary grey
   - `ADMIN_DELETED_USER` — destructive red
   - Anything else — outline (graceful fallback)

**What you should see:**
- Each action type is visually distinguishable at a glance
- No "raw text" badges — every action gets some badge variant

**Mark done when:** All action types in your data have appropriate colours.

- [x] Pass — notes:

---

### 19.3 — Clicking a row expands old / new JSON

**What to do:**
1. Click any row (the row body or the chevron icon)
2. Observe the chevron rotating (▶ → ▼)
3. Click again to collapse

**What you should see:**
- A new sub-row appears below with two columns: **Old value** and **New value**, both as pretty-printed monospace JSON blocks
- `null` values render as italic "null" — not as the literal string
- Second click collapses the sub-row
- You can have multiple rows expanded at once

**Mark done when:** Expand / collapse works and JSON renders cleanly.

- [x] Pass — notes:

---

### 19.4 — Reference column shows useful context

**What to do:**
1. For each visible action, look at the Reference column:
   - `CHECK_IN_SAVED` rows → should show **Goal · {goal title}**
   - `APPROVE` / `RETURN` rows → should show **Sheet · {first 8 chars of sheet ID}**
   - `ADMIN_DELETED_USER` rows → "—" (no goal/sheet anchor)

**What you should see:**
- Goal-anchored actions show a human-readable title
- Sheet-anchored actions show a short sheet ID
- Otherwise "—"

**Mark done when:** Reference column resolves correctly per action type.

- [x] Pass — notes:

---

### 19.5 — "Deleted user" label appears when changed_by no longer exists

**What to do (skip if you haven't deleted any users yet):**
1. Find an audit row whose `changed_by` user has since been deleted (the foreign key was set to NULL on delete)
2. Look at the Changed By column

**What you should see:**
- The cell shows italic muted "**deleted user**" instead of crashing or showing a UUID

**Mark done when:** Orphaned audit rows render gracefully.

- [x] Pass — notes:

---

### 19.6 — Audit trail is capped at 500 entries

**What to do (only matters if your DB has > 500 audit rows — likely skipped):**
1. Inspect the visible row count

**What you should see:**
- The page renders at most 500 rows
- A note in the tab description mentions the cap

**Mark done when:** Cap is respected (or count is far below 500 anyway).

- [x] Pass — notes:

---

## Summary Checklist

Copy this into your tracker when done.

### Section 16 — Access & Routing
- [x] 16.1 Admin sees "Reports" sidebar link
- [x] 16.2 Clicking opens `/admin/reports`
- [x] 16.3 Tab switching works (shadcn Tabs fix verified)
- [x] 16.4 Non-admin cannot access `/admin/reports`

### Section 17 — Achievement Export
- [x] 17.1 Table columns render correctly
- [x] 17.2 Score column colour-coded
- [x] 17.3 Score = latest non-null quarter
- [x] 17.4 Department filter works
- [x] 17.5 Sheet status filter works
- [x] 17.6 Excel export downloads and opens cleanly
- [x] 17.7 Export respects the current filter
- [x] 17.8 Empty export shows "Nothing to export" toast

### Section 18 — Completion Dashboard
- [x] 18.1 Three stat tiles render
- [x] 18.2 ✅ / ⏳ / — states all appear correctly
- [x] 18.3 Non-APPROVED sheets show Not Started
- [x] 18.4 Manager filter narrows the table
- [x] 18.5 Summary line is accurate

### Section 19 — Audit Trail
- [x] 19.1 Rows newest first
- [x] 19.2 Action badges colour-coded
- [x] 19.3 Click-to-expand JSON works
- [x] 19.4 Reference column resolves goal/sheet anchors
- [x] 19.5 "Deleted user" label for orphaned changed_by
- [x] 19.6 500-row cap respected
