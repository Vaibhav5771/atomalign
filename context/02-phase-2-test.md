# Phase 2 — P1 Quarterly Check-in Testing Walkthrough
> Covers Sections 12 – 15. Do these IN ORDER. Each step tells you exactly what to do, what you should see, and includes a tick box to mark done.

---

## Status: ✅ All P1 tests passed

---

## Before You Start

Make sure:
- `npm run dev` is running
- App opens at `http://localhost:5173` (or 5174 if 5173 is busy)
- All 3 demo users exist in Supabase (employee@demo.com, manager@demo.com, admin@demo.com — all with `Demo@1234`)
- Migrations applied IN ORDER:
  - `0001_phase1_schema.sql`
  - `0002_phase1_test_fixes.sql`
  - `0003_admin_reopen.sql`
  - `0004_phase2_checkins.sql` ← **new for Phase 2**
- manager_id linkage SQL has been run
- Employee@demo.com has at least one **APPROVED** goal sheet with a mix of UoM types — ideally:
  - 1× NUMERIC (Higher is better) — e.g. Revenue, target 100
  - 1× NUMERIC (Lower is better) — e.g. TAT, target 24
  - 1× PERCENT — e.g. NPS, target 80, Higher
  - 1× TIMELINE — e.g. Launch project, target date sometime this month
  - 1× ZERO — e.g. Safety incidents, target 0
  - Total weightage = 100%, sheet APPROVED by manager

Open the app in browser. Keep Supabase dashboard open in another tab (Table Editor → `goals` / `check_ins` / `audit_logs`) so you can verify DB changes.

> **Today is May 2026 → current fiscal quarter is Q4 (Apr–Jun).** The QuarterSelector should auto-mark Q4 with a small green dot.

---

## SECTION 12 — Employee Check-in Flow

---

### 12.1 — "My Check-ins" link appears in sidebar for employee

**What to do:**
1. Log in as `employee@demo.com`
2. Look at the sidebar

**What you should see:**
- A new sidebar item labelled **My Check-ins** with a clipboard icon, between **My Goals** and the bottom of the nav
- Clicking it navigates to `/employee/checkins`

**Mark done when:** Sidebar shows the link and it routes correctly.

- [x] Pass — notes:

---

### 12.2 — Employee sees their approved goals on the check-ins page

**What to do:**
1. As employee, click **My Check-ins**
2. Look at the page

**What you should see:**
- Page title "My Check-ins"
- QuarterSelector with Q1 / Q2 / Q3 / Q4 tabs (Q4 highlighted as current)
- All goals from the employee's APPROVED sheet appear as cards — one per goal
- Each card shows: goal title, thrust area, target, scoring direction hint (for NUMERIC/PERCENT)
- Shared goals show a "Shared" badge in the top-right of the card

**Mark done when:** Every approved goal is visible as a CheckInForm card.

- [x] Pass — notes:

---

### 12.3 — Check-ins page blocks employees without an APPROVED sheet

**What to do (do this only if you have a second test employee whose sheet is DRAFT/SUBMITTED/RETURNED, otherwise skip):**
1. Log in as a user whose sheet is NOT yet APPROVED
2. Go to `/employee/checkins`

**What you should see:**
- A card titled "Awaiting manager approval" with descriptive text
- Current status of the sheet is shown
- NO check-in forms are rendered

**Mark done when:** Non-approved users cannot log check-ins.

- [x] Pass — notes:

---

### 12.4 — Employee can select any quarter (none blocked)

**What to do:**
1. On the check-ins page, click each tab: Q1, then Q2, then Q3, then Q4

**What you should see:**
- All four tabs are clickable (none disabled)
- Active tab visibly highlighted
- The check-in cards swap their saved values when the quarter changes (an empty quarter shows blank inputs)

**Mark done when:** All four quarters are reachable.


- [x] Pass — notes:

---

### 12.5 — NUMERIC / PERCENT goals show a number input labelled "Actual Value"

**What to do:**
1. On the check-ins page, find a NUMERIC goal
2. Look at the input field

**What you should see:**
- Label says "Actual Value" (PERCENT goals say "Actual Value (%)")
- Input is `type="number"` (mobile shows numeric keypad)
- Placeholder reads "Enter actual"

**Mark done when:** Number input shows for NUMERIC/PERCENT.

- [x] Pass — notes:

---

### 12.6 — TIMELINE goals show a date picker labelled "Completion Date"

**What to do:**
1. Find the TIMELINE goal on the check-ins page
2. Look at the input

**What you should see:**
- Label says "Completion Date"
- Input is a date picker (`type="date"`)
- No "Actual Value" number field is shown for this goal

**Mark done when:** Date picker shows for TIMELINE.

- [x] Pass — notes:

---

### 12.7 — ZERO goals show a number input labelled "Incident Count (0 = success)"

**What to do:**
1. Find the ZERO goal on the check-ins page

**What you should see:**
- Label says "Incident Count (0 = success)"
- Input is `type="number"`, `min=0`, `step=1`
- Placeholder reads "0"

**Mark done when:** Correct ZERO input renders.

- [x] Pass — notes:

---

### 12.8 — Score preview updates in real time as employee types

**What to do:**
1. On a NUMERIC goal with target = 100, type the following values one at a time in the Actual field: 50, 75, 100, 120
2. Watch the Score row in the small card at the bottom of the goal card

**What you should see:**
- As you type each value, the Score updates immediately without clicking Save
- 50 → 50.0% (red)
- 75 → 75.0% (amber)
- 100 → 100.0% (green)
- 120 → 100.0% (green — clamped to max)
- Clearing the field shows "—"

**Mark done when:** Score preview is live and colour-coded.

- [x] Pass — notes:

---

### 12.9 — Lower-is-better NUMERIC scoring uses Target ÷ Actual

**What to do:**
1. Find the NUMERIC goal flagged "Lower is better" (e.g. TAT, target 24)
2. Type Actual = 24 → observe score
3. Type Actual = 48 → observe score
4. Type Actual = 12 → observe score

**What you should see:**
- 24 → 100.0% (Target/Actual = 24/24)
- 48 → 50.0% (24/48)
- 12 → 100.0% (clamped — Target/Actual would be 200%)
- The score colour follows the same bands (red < 75, amber 75–99, green ≥ 100)

**Mark done when:** "Lower is better" goals use Target ÷ Actual formula.

- [x] Pass — notes:

---

### 12.10 — ZERO goal scores 100% only when actual = 0

**What to do:**
1. On the ZERO goal, type Actual = 0 → observe score
2. Type Actual = 1 → observe score
3. Type Actual = 5 → observe score

**What you should see:**
- 0 → 100.0% (green)
- 1 → 0.0% (red)
- 5 → 0.0% (red)

**Mark done when:** Only 0 yields 100%; anything else yields 0%.

- [x] Pass — notes:

---

### 12.11 — TIMELINE goal scoring: on-time = 100%, late = penalised

**What to do:**
1. Find your TIMELINE goal; note its target date
2. Set Completion Date = the target date → observe score
3. Set Completion Date = 15 days AFTER target date → observe score
4. Set Completion Date = 30 days AFTER target date → observe score

**What you should see:**
- On-time → 100.0% (green)
- 15 days late → 75.0% (amber) — penalty 50/30 × 15 = 25%
- 30 days late → 50.0% (red) — penalty 50%

**Mark done when:** TIMELINE scoring matches the linear penalty formula.

- [x] Pass — notes:

---

### 12.12 — Save button disabled until input is valid

**What to do:**
1. On any goal with an empty Actual field, look at the Save button
2. For a ZERO goal, type a negative number (e.g. -1) — look at Save
3. For a NUMERIC goal, type letters (e.g. "abc") — look at Save

**What you should see:**
- Save is disabled when Actual is empty
- Save is disabled when ZERO actual is negative or not an integer
- Save is disabled when value is non-numeric

**Mark done when:** Invalid input cannot be saved.

- [x] Pass — notes:

---

### 12.13 — Employee saves a check-in and it persists on refresh

**What to do:**
1. On a NUMERIC goal, type Actual = 80, set Status = "On Track"
2. Click **Save**
3. Wait for the green toast "Check-in saved"
4. Press F5 to hard refresh the page

**What you should see:**
- After save, the score card updates with the saved value
- After refresh, the Actual field still shows 80, Status still "On Track"
- In Supabase → `check_ins` table → new row exists with `goal_id` matching this goal, `quarter='Q4'` (or the active quarter), `actual='80'`, `status='ON_TRACK'`, `score` populated

**Mark done when:** Saved value survives a hard refresh and exists in DB.

- [x] Pass — notes:

---

### 12.14 — Re-saving the same quarter UPDATES, not duplicates

**What to do:**
1. On the same goal you just saved, change Actual from 80 → 95
2. Click **Save** (button now labelled "Update")
3. Refresh
4. Check Supabase

**What you should see:**
- Score updates to 95.0%
- After refresh, value still 95
- In `check_ins` table, there is still only ONE row for (goal_id, quarter) — `updated_at` has moved, `actual` = '95'

**Mark done when:** Upsert behaviour confirmed (no duplicate row).

- [x] Pass — notes:

---

### 12.15 — audit_logs has a CHECK_IN_SAVED entry per save

**What to do:**
1. Log out → log in as `admin@demo.com` (audit_logs is admin-readable only)
2. Open Supabase → `audit_logs` table
3. Filter by `action = 'CHECK_IN_SAVED'`

**What you should see:**
- At least 2 rows (one per save above)
- Each row has `goal_id`, `sheet_id`, `changed_by = employee uuid`, `new_value` JSON with `quarter, actual, status, score`

**Mark done when:** Each save produced one CHECK_IN_SAVED audit row.

- [x] Pass — notes:

---

## SECTION 13 — Manager Check-in Flow

---

### 13.1 — "Team Check-ins" link appears in sidebar for manager

**What to do:**
1. Log out → log in as `manager@demo.com`
2. Look at the sidebar

**What you should see:**
- New sidebar item **Team Check-ins** below **Team**, with a clipboard icon
- Clicking it navigates to `/manager/checkins`

**Mark done when:** Sidebar link appears and routes correctly.

- [x] Pass — notes:

---

### 13.2 — Manager picks an employee with an APPROVED sheet

**What to do:**
1. On `/manager/checkins`, look at the "Select team member" dropdown

**What you should see:**
- Dropdown lists all direct reports
- Employees without an APPROVED sheet are shown with a "· no approved sheet" suffix and are disabled in the dropdown
- The first employee with an APPROVED sheet is auto-selected on first load
- Quarter selector at top-right; current quarter (Q4) marked with a green dot

**Mark done when:** Dropdown behaves correctly and auto-selects.

- [x] Pass — notes:

---

### 13.3 — Manager sees planned vs actual side by side per goal

**What to do:**
1. With an employee selected and the quarter set to the one where the employee saved data (likely Q4)
2. Look at the ManagerCheckInView table

**What you should see:**
- Table columns: Goal Title | Thrust Area | UoM | Target | Actual | Score | Status | Manager Comment
- Each approved goal is a row
- Rows where the employee saved a check-in show Actual and Score populated
- Rows with no check-in show "—" for Actual/Score/Status
- Score colour bands match the employee view (green/amber/red)

**Mark done when:** Table renders correctly with planned vs actual data.

- [x] Pass — notes:

---

### 13.4 — Manager can save a comment and it persists on refresh

**What to do:**
1. Click an empty "Click to add comment…" cell on a row with a saved check-in
2. Type a comment (e.g. "Good progress this quarter, push harder in Q1 next year")
3. Click **Save**
4. Wait for "Comment saved" toast
5. F5 hard refresh

**What you should see:**
- Comment appears in the cell after save
- After refresh, the comment is still there
- In Supabase → `check_ins` table → the row's `manager_comment` is populated

**Mark done when:** Manager comment survives refresh and exists in DB.

- [x] Pass — notes:

---

### 13.5 — Manager can edit an existing comment

**What to do:**
1. Click the cell containing the comment you just saved
2. Edit the text
3. Save

**What you should see:**
- Updated comment shows in the cell
- DB row's `manager_comment` reflects the new value
- A second audit row is written (see 13.7)

**Mark done when:** Edit-in-place works.

- [x] Pass — notes:

---

### 13.6 — Employee sees manager comment on their check-ins page

**What to do:**
1. Log out → log in as `employee@demo.com`
2. Go to **My Check-ins** → same quarter the manager commented on

**What you should see:**
- The goal card that has a manager comment shows a "Manager comment" section below the score card with the manager's text

**Mark done when:** Employee can read the manager's comment without an extra click.

- [x] Pass — notes:

---

### 13.7 — audit_logs has MANAGER_COMMENT_SAVED entries

**What to do:**
1. Log in as admin
2. Open `audit_logs` → filter `action = 'MANAGER_COMMENT_SAVED'`

**What you should see:**
- 2 rows (one for the initial save, one for the edit)
- `changed_by` = manager's uuid
- `new_value` contains `{ check_in_id, comment }`

**Mark done when:** Audit trail captures each comment save.

- [x] Pass — notes:

---

## SECTION 14 — Scoring & Direction Toggle

---

### 14.1 — GoalForm shows "Scoring direction" toggle for NUMERIC/PERCENT only

**What to do:**
1. Log in as employee with a DRAFT or RETURNED sheet (or create a new one)
2. Click "Add goal" — the GoalForm modal opens
3. Change UoM between Numeric, Percent, Timeline, Zero target

**What you should see:**
- When UoM = NUMERIC or PERCENT → "Scoring direction" appears with two buttons: "Higher is better" / "Lower is better" (default Higher)
- When UoM = TIMELINE or ZERO → the toggle disappears (no direction needed)

**Mark done when:** Toggle visibility follows UoM.

- [x] Pass — notes:

---

### 14.2 — Direction value persists to DB

**What to do:**
1. Add a NUMERIC goal, switch direction to "Lower is better", save
2. Open Supabase → `goals` table → find the new row

**What you should see:**
- Row has `direction = 'LOWER'`
- All existing goals from Phase 1 show `direction = 'HIGHER'` (the default)

**Mark done when:** Direction stored correctly in DB.

- [x] Pass — notes:

---

### 14.3 — Score colour bands are correct

**What to do:**
1. On the check-ins page, type values to produce each score band on a NUMERIC goal (target=100)

**What you should see:**
- Score < 75% → red (`text-rose-600`)
- 75 ≤ Score < 100 → amber (`text-amber-600`)
- Score ≥ 100 → green (`text-emerald-600`)

**Mark done when:** Colour bands match the BRD spec.

- [x] Pass — notes:

---

### 14.4 — Quarter auto-highlight reflects current fiscal quarter

**What to do:**
1. Look at the QuarterSelector on either the employee or manager check-ins page

**What you should see:**
- Today's date (May 2026) → **Q4** marked with a green dot
- If you click another quarter, Q4 still has the dot but is not the active tab

**Mark done when:** Correct quarter auto-marked.

- [x] Pass — notes:

---

## SECTION 15 — Security & RLS

---

### 15.1 — Employee CANNOT insert a check-in if their sheet is not APPROVED

**What to do:**
1. Sign in as an employee whose sheet is DRAFT/SUBMITTED/RETURNED (skip if you only have one approved sheet)
2. Open browser DevTools → Console
3. Run the following snippet, replacing `<goalId>` with one of their goal IDs:
   ```js
   const { supabase } = await import('/src/lib/supabase.ts');
   const { error } = await supabase.from('check_ins').insert({ goal_id: '<goalId>', quarter: 'Q4', actual: '50', status: 'ON_TRACK' });
   console.log(error);
   ```

**What you should see:**
- An error is returned (RLS denies the insert — likely "new row violates row-level security policy")
- No row is created in `check_ins`

**Mark done when:** RLS blocks unapproved-sheet check-ins.

- [x] Pass — notes:

---

### 15.2 — Manager CANNOT change `actual` on a team member's check-in

**What to do:**
1. Sign in as `manager@demo.com`
2. Open DevTools → Console
3. Run, replacing `<checkInId>` with a real id from `check_ins` belonging to a report:
   ```js
   const { supabase } = await import('/src/lib/supabase.ts');
   const { error } = await supabase.from('check_ins').update({ actual: '999999' }).eq('id', '<checkInId>');
   console.log(error);
   ```

**What you should see:**
- An error from the trigger: `"Managers cannot edit actual value"`
- `actual` is unchanged in DB

**Mark done when:** Field-scope trigger blocks the change.

- [x] Pass — notes:

---

### 15.3 — Employee CANNOT set `manager_comment` on their own check-in

**What to do:**
1. Sign in as `employee@demo.com`
2. DevTools → Console:
   ```js
   const { supabase } = await import('/src/lib/supabase.ts');
   const { error } = await supabase.from('check_ins').update({ manager_comment: 'I am the manager now' }).eq('id', '<checkInId>');
   console.log(error);
   ```

**What you should see:**
- Error: `"Employees cannot edit manager comments"`
- `manager_comment` unchanged in DB

**Mark done when:** Field-scope trigger blocks the change.

- [x] Pass — notes:

---

### 15.4 — Employee CANNOT see another employee's check-ins

**What to do (requires a second employee with their own check-ins — skip if you only have one):**
1. Sign in as employee A
2. DevTools → Console:
   ```js
   const { supabase } = await import('/src/lib/supabase.ts');
   const { data } = await supabase.from('check_ins').select('*');
   console.log(data);
   ```

**What you should see:**
- Only check-ins for goals belonging to employee A's own sheet
- Employee B's rows are NOT returned (RLS filters them out)

**Mark done when:** RLS isolates employees correctly.

- [x] Pass — notes:

---

### 15.5 — Manager CAN see check-ins for their reports only (not other managers' reports)

**What to do (requires a second manager — skip if not set up):**
1. Sign in as manager A
2. DevTools → Console: run the same SELECT as above

**What you should see:**
- Only check-ins for goals on sheets of manager A's direct reports
- No cross-team leak

**Mark done when:** RLS scopes manager visibility.

- [x] Pass — notes:

---

## Summary Checklist

Copy this into your tracker when done.

### Section 12 — Employee Check-in Flow
- [x] 12.1 "My Check-ins" sidebar link
- [x] 12.2 Approved goals appear on page
- [x] 12.3 Non-approved sheet shows blocked message
- [x] 12.4 All four quarters selectable
- [x] 12.5 NUMERIC / PERCENT → number input
- [x] 12.6 TIMELINE → date picker
- [x] 12.7 ZERO → number input with min 0
- [x] 12.8 Score preview live + colour-coded
- [x] 12.9 Lower-is-better uses Target ÷ Actual
- [x] 12.10 ZERO scores 100% only at actual = 0
- [x] 12.11 TIMELINE linear-late penalty correct
- [x] 12.12 Save disabled for invalid input
- [x] 12.13 Check-in persists on refresh
- [x] 12.14 Re-save updates same row (upsert)
- [x] 12.15 audit_logs has CHECK_IN_SAVED entries

### Section 13 — Manager Check-in Flow
- [x] 13.1 "Team Check-ins" sidebar link
- [x] 13.2 Employee dropdown auto-selects approved
- [x] 13.3 Planned vs actual table renders
- [x] 13.4 Manager comment saves + persists
- [x] 13.5 Manager can edit existing comment
- [x] 13.6 Employee sees manager comment
- [x] 13.7 audit_logs has MANAGER_COMMENT_SAVED entries

### Section 14 — Scoring & Direction
- [x] 14.1 Direction toggle only for NUMERIC/PERCENT
- [x] 14.2 Direction persists in DB
- [x] 14.3 Score colour bands correct
- [x] 14.4 Quarter auto-highlight = Q4

### Section 15 — Security & RLS
- [x] 15.1 Employee can't insert if sheet not APPROVED
- [x] 15.2 Manager can't change `actual`
- [x] 15.3 Employee can't set `manager_comment`
- [x] 15.4 Employee can't see another employee's check-ins
- [x] 15.5 Manager can't see another manager's reports' check-ins
