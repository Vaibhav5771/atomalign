# Phase 1 Testing Walkthrough
> Sections 10 & 11 — Validation Rules + Acceptance Tests
> Do these IN ORDER. Each step tells you exactly what to do and what you should see.

---

## Before You Start

Make sure:
- `npm run dev` is running
- App opens at `http://localhost:5173`
- All 3 demo users exist in Supabase
- Migration SQL has been applied
- manager_id linkage SQL has been run

Open the app in browser. Keep Supabase dashboard open in another tab (Table Editor → goal_sheets / goals) so you can verify DB changes.

---

## SECTION 10 — Validation Rules

---

### 10.1 — Total weightage = 100% gate on submit

**What to do:**
1. Log in as `employee@demo.com`
2. Go to Create Goal Sheet
3. Add one goal with weightage = 50
4. Add a second goal with weightage = 30
5. Try to click Submit

**What you should see:**
- Submit button is either disabled OR shows an error toast saying something like "Total weightage must be 100%. Currently 80%."
- Sheet is NOT submitted
- Status stays DRAFT

**Mark done when:** Submit is blocked and error is shown clearly.

##  Not Passed 
As 
Total weightage
130% / 100%
Over allocation by 30% — reduce weightage to reach exactly 100%. still i am able to  add goal

---

### 10.2 — Min weightage 10% per goal

**What to do:**
1. Still logged in as employee
2. Try to add a goal with weightage = 5

**What you should see:**
- Form shows a validation error on the weightage field like "Minimum weightage is 10%"
- Goal is NOT saved

**Mark done when:** Goal with weightage below 10 cannot be saved.

## Passed 

Shows HTML warnings 


---

### 10.3 — Max 8 goals per sheet

**What to do:**
1. Add goals one by one until you have 8 goals (any weightage values, doesn't need to total 100 yet)
2. Try to add a 9th goal

**What you should see:**
- Either the Add Goal button is disabled
- OR a toast/error appears saying "Maximum 8 goals allowed"
- 9th goal is NOT added

**Mark done when:** Cannot add a 9th goal.

## Passed

Shows
Goal limit reached

---

### 10.4 — Goals locked after manager approval

**What to do:**
1. As employee — set up a valid sheet (goals totaling 100%) and submit it
2. Log out → log in as `manager@demo.com`
3. Go to Manager Dashboard → find the submitted sheet → open Review

## Remark I cant review it  it seems as if its read-only. 

4. Click Approve
5. Log out → log in as `employee@demo.com`
6. Go to view your goal sheet

**What you should see:**
- Goals are now read-only — no edit or delete buttons visible
- Sheet status shows APPROVED
- In Supabase Table Editor → goals table → is_locked = true for all goals in that sheet

**Mark done when:** Approved goals cannot be edited by employee.

---

### 10.5 — Shared goals: title/target read-only for employee

**What to do:**
1. Log out → log in as `admin@demo.com`
2. Go to Shared Goals page
3. Push a shared goal to `employee@demo.com` (fill title, target, UoM, select employee)
4. Log out → log in as `employee@demo.com`
5. Go to your goal sheet — find the shared goal

**What you should see:**
- Shared goal appears on employee's sheet
- Title and Target fields are read-only / greyed out
- Weightage field IS editable
- Employee can change weightage but cannot change title or target

**Mark done when:** Shared goal title/target cannot be changed by employee.

## Not Passed 

- When i have Shared Goals appeared on the employee sheet but, when he opens it with Edit&Resubmit he is able to edit everythingg also, on employee he should see that who have assigned it to him that info isnt available so we can differentiate if it wwas created by him, manager or admin

## TILL HERE 

---

### 10.6 — Returned sheet → DRAFT, editable, resubmittable

**What to do:**
1. As employee — create and submit a fresh goal sheet
2. Log out → log in as manager
3. Open the submitted sheet → click "Return for Rework" (add a remark if required)
4. Log out → log in as employee
5. Go to your goal sheet

**What you should see:**
- Status badge shows RETURNED or DRAFT
- Manager's remark is visible
- Employee can now edit goals again (add, edit, delete)
- Employee can resubmit once weightage = 100%

**Mark done when:** Returned sheet is fully editable and can be resubmitted.

---

## SECTION 11 — Acceptance Tests

---

### 11.1 — Employee can log in and is redirected correctly

**What to do:**
1. Open `http://localhost:5173`
2. Log in with `employee@demo.com` / `Demo@1234`

**What you should see:**
- Redirected to `/employee/dashboard` (NOT manager or admin page)
- Sidebar shows employee-only navigation links
- No manager or admin menu items visible

**Mark done when:** Employee lands on their own dashboard after login.

---

### 11.2 — Employee can create a goal sheet and add goals

**What to do:**
1. Logged in as employee
2. Click Create Goal Sheet (or go to `/employee/goals/new`)
3. Add a goal — fill: Thrust Area, Title, UoM, Target, Weightage
4. Click Save / Add

**What you should see:**
- Goal appears in the goal list below the form
- Row shows all fields correctly (title, UoM, target, weightage)
- In Supabase → goals table → new row exists with correct sheet_id

**Mark done when:** Goal saved and visible in list and in Supabase.

---

### 11.3 — WeightageBar correctly shows running total

**What to do:**
1. On the goal creation page, add goals with different weightages
2. Watch the WeightageBar as you add each goal

**What you should see:**
- Bar fills proportionally (e.g. 40% = bar is 40% filled)
- Number shown updates in real time (e.g. "40 / 100")
- Bar is RED or shows warning when total ≠ 100
- Bar turns GREEN when total = exactly 100

**Mark done when:** Bar updates live and color changes at 100%.

---

### 11.4 — Cannot submit if weightage ≠ 100%

**What to do:**
1. Have goals that total something other than 100 (e.g. 70%)
2. Click Submit

**What you should see:**
- Clear error message blocking submission
- Sheet status stays DRAFT
- No SUBMITTED entry appears in Supabase goal_sheets table

**Mark done when:** Submit is blocked with a clear message.

---

### 11.5 — Cannot add more than 8 goals

*(Already covered in 10.3 — mark this done if 10.3 passed)*

---

### 11.6 — Cannot add goal with weightage < 10%

*(Already covered in 10.2 — mark this done if 10.2 passed)*

---

### 11.7 — Employee can submit sheet → status changes → form locks

**What to do:**
1. Set up goals totaling exactly 100%
2. Click Submit
3. Observe the page after submission

**What you should see:**
- Success toast / confirmation message
- Sheet status badge changes to SUBMITTED
- Goal form disappears OR all fields become read-only
- Add Goal button is gone or disabled
- In Supabase → goal_sheets → status = 'SUBMITTED', submitted_at has a timestamp

**Mark done when:** Status = SUBMITTED and employee cannot edit goals anymore.

---

### 11.8 — Manager can log in and see team dashboard

**What to do:**
1. Log out from employee
2. Log in as `manager@demo.com` / `Demo@1234`

**What you should see:**
- Redirected to `/manager/dashboard`
- A table showing team members
- Employee's name appears with their sheet status (SUBMITTED)
- A Review or View button next to the employee row

**Mark done when:** Manager sees their team list with correct statuses.

---

### 11.9 — Manager can open and review a submitted sheet

**What to do:**
1. Logged in as manager
2. Click Review next to the employee who submitted
3. Opens `/manager/review/:sheetId`

**What you should see:**
- Full list of employee's goals visible
- Each goal shows: thrust area, title, UoM, target, weightage
- Fields for target and weightage are editable inline
- Approve and Return buttons visible

**Mark done when:** Manager can see all goals and fields are editable.

---

### 11.10 — Manager can edit target and weightage inline

**What to do:**
1. On the review page, change the target value of one goal
2. Change the weightage of another goal
3. Save / confirm the changes

**What you should see:**
- Changes persist (refresh the page and they are still there)
- In Supabase → goals table → updated values are saved

**Mark done when:** Inline edits saved correctly in DB.

---

### 11.11 — Manager can approve → goals lock → audit log created

**What to do:**
1. On the review page, click Approve
2. Log out → log in as employee → view goal sheet
3. Open Supabase → goals table
4. Open Supabase → audit_logs table

**What you should see:**
- Sheet status = APPROVED
- Employee sees goals as read-only (no edit/delete)
- In Supabase goals → is_locked = true for all goals in this sheet
- In Supabase audit_logs → at least one new row with action = 'APPROVED' or similar

**Mark done when:** All 3 things confirmed — status, lock, audit log.

---

### 11.12 — Manager can return sheet → employee can edit and resubmit

*(Already covered in 10.6 — mark done if 10.6 passed)*

---

### 11.13 — Admin can log in and push a shared goal to employees

**What to do:**
1. Log out → log in as `admin@demo.com` / `Demo@1234`
2. Redirected to `/admin/dashboard`
3. Go to Shared Goals page
4. Fill: Thrust Area, Goal Title, Target, UoM
5. Select employee@demo.com from the employee list
6. Click Push Goal

**What you should see:**
- Success message
- In Supabase → shared_goals table → new row with source_goal_id and employee_id

**Mark done when:** Shared goal row exists in Supabase with correct employee_id.

---

### 11.14 — Employees see shared goal with locked title/target

*(Already covered in 10.5 — mark done if 10.5 passed)*

---

### 11.15 — All role-based route guards work

**What to do — test 3 scenarios:**

Scenario A:
1. Logged in as employee
2. Manually type in browser: `http://localhost:5173/manager/dashboard`
3. Should redirect to `/employee/dashboard` — NOT show manager page

Scenario B:
1. Logged in as manager
2. Manually type: `http://localhost:5173/admin/dashboard`
3. Should redirect to `/manager/dashboard`

Scenario C:
1. Log out completely
2. Manually type: `http://localhost:5173/employee/dashboard`
3. Should redirect to `/login`

**Mark done when:** All 3 scenarios redirect correctly.

---

### 11.16 — Page refreshes maintain login session

**What to do:**
1. Log in as any user
2. Navigate to any page
3. Press F5 or Ctrl+R to hard refresh
4. Wait for page to load

**What you should see:**
- User stays logged in
- Not redirected to /login
- Same page loads with correct data
- No flash of login page before loading

**Mark done when:** Refresh keeps user logged in with their data intact.

---

## Summary Checklist

Copy this into your tracker when done:

### Section 10
- [ ] 10.1 Total weightage = 100% gate on submit
- [ ] 10.2 Min weightage 10% per goal
- [ ] 10.3 Max 8 goals per sheet
- [ ] 10.4 Goals locked after manager approval
- [ ] 10.5 Shared goals: title/target read-only for employee
- [ ] 10.6 Returned sheet → DRAFT, editable, resubmittable

### Section 11
- [ ] 11.1 Employee login + redirect
- [ ] 11.2 Employee creates goal sheet and adds goals
- [ ] 11.3 WeightageBar shows running total
- [ ] 11.4 Cannot submit if weightage ≠ 100%
- [ ] 11.5 Cannot add more than 8 goals
- [ ] 11.6 Cannot add goal with weightage < 10%
- [ ] 11.7 Submit → status changes → form locks
- [ ] 11.8 Manager login + team dashboard
- [ ] 11.9 Manager opens and reviews submitted sheet
- [ ] 11.10 Manager edits inline and saves
- [ ] 11.11 Approve → goals lock → audit log created
- [ ] 11.12 Return → employee can edit + resubmit
- [ ] 11.13 Admin pushes shared goal
- [ ] 11.14 Employee sees shared goal with locked fields
- [ ] 11.15 Role-based route guards work
- [ ] 11.16 Session persists on page refresh