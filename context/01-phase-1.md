# Phase 1 Implementation Plan

## Overview

Phase 1 = Goal Creation & Approval (Must-Have)
Three actors: Employee, Manager, Admin
Goal: Complete working flow from login → create goals → submit → manager reviews → approve/return

---

## Actors & What They Do in Phase 1

| Actor    | Actions |
|----------|---------|
| Employee | Login → Create goal sheet → Add goals → Validate weightage → Submit |
| Manager  | Login → See team submissions → Review goals → Edit inline → Approve or Return |
| Admin    | Login → Push a shared goal to multiple employees |

---

## Validation Rules (Must Be Enforced Everywhere)

- Total weightage across all goals in a sheet = exactly 100%
- Minimum weightage per single goal = 10%
- Maximum number of goals per employee per cycle = 8
- Goals become locked (read-only) immediately after manager approval
- Shared goals: employee can only change weightage — title and target are read-only
- A sheet cannot be submitted if weightage ≠ 100%
- A returned sheet goes back to DRAFT — employee can edit and resubmit

---

## Database Tables to Create (Supabase)

### Table: profiles
- Extends Supabase auth.users
- Columns: id, full_name, email, role (EMPLOYEE / MANAGER / ADMIN), manager_id, department, created_at
- manager_id links employee to their L1 manager

### Table: goal_sheets
- One sheet per employee per cycle year
- Columns: id, employee_id, cycle_year, status (DRAFT / SUBMITTED / APPROVED / RETURNED), submitted_at, approved_at, manager_remark, created_at, updated_at

### Table: goals
- Many goals per sheet (max 8)
- Columns: id, sheet_id, thrust_area, title, description, uom (NUMERIC / PERCENT / TIMELINE / ZERO), target, target_date, weightage, is_shared, is_locked, created_at

### Table: shared_goals
- Links a pushed goal to specific employees
- Columns: id, source_goal_id, employee_id, weightage, created_at
- Unique constraint on (source_goal_id, employee_id)

### Table: audit_logs
- Tracks all changes made after goal lock
- Columns: id, goal_id, sheet_id, changed_by, action, old_value (jsonb), new_value (jsonb), created_at

### RLS Policies Required
- Employee sees only their own sheet and goals
- Manager sees sheets of employees where profiles.manager_id = manager's id
- Admin sees everything
- Goals cannot be inserted into a sheet that is not in DRAFT status
- Goals cannot be updated if is_locked = true (except by MANAGER/ADMIN)
- Audit logs insertable by all, readable only by ADMIN

### Auth Trigger
- On new user signup → auto-create a row in profiles using metadata (full_name, role)

---

## Demo Users to Create (Supabase Dashboard → Auth → Add User)

| Email               | Password   | Role     |
|---------------------|------------|----------|
| employee@demo.com   | Demo@1234  | EMPLOYEE |
| manager@demo.com    | Demo@1234  | MANAGER  |
| admin@demo.com      | Demo@1234  | ADMIN    |

After creating users → set employee's manager_id = manager's profile id in profiles table

---

## Zustand Stores Needed

### authStore
State: user (profile object), session, loading
Actions: signIn, signOut, fetchProfile

### goalSheetStore
State: currentSheet, goals (array), loading, totalWeightage (computed)
Actions: fetchMySheet, createSheet, addGoal, updateGoal, deleteGoal, submitSheet

### managerStore
State: teamSheets (array), loading
Actions: fetchTeamSheets, approveSheet, returnSheet, updateGoalInline

---

## Pages to Build

| Route                    | Role     | Purpose |
|--------------------------|----------|---------|
| /login                   | All      | Supabase email+password login, redirect by role after login |
| /employee/dashboard      | Employee | Shows current sheet status, quick stats |
| /employee/goals          | Employee | View own goal sheet (read-only if submitted/approved) |
| /employee/goals/new      | Employee | Create new goal sheet with goal form |
| /manager/dashboard       | Manager  | Table of all team members + their sheet status |
| /manager/review/:sheetId | Manager  | Full review page — see all goals, edit inline, approve/return |
| /admin/dashboard         | Admin    | Overview stats |
| /admin/shared-goals      | Admin    | Select goal + select employees → push shared goal |

---

## Components to Build

### Layout Components
- AppShell — sidebar + top bar wrapper, wraps all authenticated pages
- Sidebar — shows nav links based on role (different links for Employee / Manager / Admin)
- ProtectedRoute — redirects to /login if not authenticated, also checks role access

### Shared Components
- StatusBadge — colored pill showing DRAFT / SUBMITTED / APPROVED / RETURNED
- RoleBadge — shows EMPLOYEE / MANAGER / ADMIN
- ExportButton — triggers CSV export (Phase 2, placeholder for now)

### Goal Components
- GoalForm — form to add or edit a single goal row (thrust area, title, UoM, target, weightage)
- GoalList — renders all goals in a sheet as a table with edit/delete per row
- WeightageBar — visual bar showing total weightage out of 100%, turns red if not 100%, green if exactly 100%

### Manager Components
- TeamTable — table of employees with name, sheet status, submitted date, action button
- ReviewPanel — shows all goals for one employee with inline editable fields for target and weightage

---

## User Flows (Step by Step)

### Employee Flow
1. Opens /login → enters email + password → clicks Sign In
2. Supabase auth → profile fetched → role = EMPLOYEE → redirected to /employee/dashboard
3. Dashboard shows "No goal sheet yet" if none exists → button "Create Goal Sheet"
4. Goes to /employee/goals/new
5. Clicks "Add Goal" → GoalForm appears → fills: Thrust Area, Title, Description, UoM, Target, Weightage
6. Saves goal → appears in GoalList
7. WeightageBar updates in real time
8. Can add up to 8 goals, edit or delete any goal while sheet is DRAFT
9. When total = 100% → Submit button becomes active
10. Clicks Submit → sheet status changes to SUBMITTED → goals become read-only for employee
11. Employee sees status badge change to SUBMITTED on dashboard

### Manager Flow
1. Logs in → role = MANAGER → redirected to /manager/dashboard
2. Sees TeamTable with all employees and their sheet statuses
3. Clicks "Review" on a SUBMITTED sheet
4. Goes to /manager/review/:sheetId
5. Sees all goals in a table — can edit Target and Weightage inline
6. Can add a remark in a text area
7. Clicks "Approve" → sheet status = APPROVED → all goals is_locked = true → audit log entry created
8. OR clicks "Return for Rework" → sheet status = RETURNED → employee can edit and resubmit

### Admin Flow
1. Logs in → role = ADMIN → redirected to /admin/dashboard
2. Goes to /admin/shared-goals
3. Fills: Thrust Area, Goal Title, Target, UoM
4. Selects employees from a list (multi-select)
5. Clicks "Push Goal" → shared_goals rows created for each selected employee
6. Employees see the shared goal on their sheet with title/target locked — only weightage editable

---

## Routing Structure

- All routes under / require authentication (ProtectedRoute)
- Role mismatch → redirect to their own dashboard
- Unknown route → /404

```
/login                        → LoginPage (public)
/employee/dashboard           → EmployeeDashboard (EMPLOYEE only)
/employee/goals               → GoalSheetPage (EMPLOYEE only)
/employee/goals/new           → NewGoalSheetPage (EMPLOYEE only)
/manager/dashboard            → ManagerDashboard (MANAGER only)
/manager/review/:sheetId      → ReviewGoalSheet (MANAGER only)
/admin/dashboard              → AdminDashboard (ADMIN only)
/admin/shared-goals           → SharedGoalsPage (ADMIN only)
*                             → NotFoundPage
```

---

## Score Computation Logic (Needed for Check-in Display, Phase 2)

Implement these as pure utility functions in src/lib/utils.ts — not called in Phase 1 UI but should be ready:

| UoM Type        | Formula                                  | Notes |
|-----------------|------------------------------------------|-------|
| NUMERIC (min)   | actual ÷ target × 100                   | Higher actual = better (e.g. revenue) |
| PERCENT (min)   | actual ÷ target × 100                   | Same formula |
| NUMERIC (max)   | target ÷ actual × 100                   | Lower actual = better (e.g. cost, TAT) |
| TIMELINE        | Based on completion date vs target_date  | On time = 100%, late = scaled down |
| ZERO            | If actual = 0 → 100%, else 0%           | Zero incidents = success |

---

## What "Done" Looks Like for Phase 1

Test all 3 role journeys end to end before moving to Phase 2:

- [ ] Employee can log in and is redirected correctly
- [ ] Employee can create a goal sheet and add goals
- [ ] WeightageBar correctly shows running total
- [ ] Cannot submit if weightage ≠ 100%
- [ ] Cannot add more than 8 goals
- [ ] Cannot add goal with weightage < 10%
- [ ] Employee can submit sheet → status changes → form locks
- [ ] Manager can log in and see team dashboard
- [ ] Manager can open and review a submitted sheet
- [ ] Manager can edit target and weightage inline
- [ ] Manager can approve → goals lock → audit log created
- [ ] Manager can return sheet → employee can edit and resubmit
- [ ] Admin can log in and push a shared goal to selected employees
- [ ] Employees see shared goal with locked title/target
- [ ] All role-based route guards work (wrong role → redirect)
- [ ] Page refreshes maintain login session (Supabase session persistence)

---

## Files to Create (in order)

1. src/types/index.ts
2. src/lib/supabase.ts
3. src/lib/utils.ts
4. src/stores/authStore.ts
5. src/stores/goalSheetStore.ts
6. src/stores/managerStore.ts
7. src/components/layout/ProtectedRoute.tsx
8. src/components/layout/Sidebar.tsx
9. src/components/layout/AppShell.tsx
10. src/components/shared/StatusBadge.tsx
11. src/components/shared/RoleBadge.tsx
12. src/components/goals/WeightageBar.tsx
13. src/components/goals/GoalForm.tsx
14. src/components/goals/GoalList.tsx
15. src/components/manager/TeamTable.tsx
16. src/components/manager/ReviewPanel.tsx
17. src/pages/auth/LoginPage.tsx
18. src/pages/employee/EmployeeDashboard.tsx
19. src/pages/employee/NewGoalSheetPage.tsx
20. src/pages/employee/GoalSheetPage.tsx
21. src/pages/manager/ManagerDashboard.tsx
22. src/pages/manager/ReviewGoalSheet.tsx
23. src/pages/admin/AdminDashboard.tsx
24. src/pages/admin/SharedGoalsPage.tsx
25. src/pages/NotFoundPage.tsx
26. src/App.tsx (router setup with all routes + role guards)

---

## Notes for Claude Code

- Use shadcn/ui components for all UI — Button, Input, Card, Table, Badge, Dialog, Select, Form, Toast
- Use react-hook-form + zod for all forms with validation
- Use react-router-dom v6 for routing
- Use Zustand for all global state — no prop drilling
- All Supabase calls go inside Zustand store actions or custom hooks — never directly in components
- Show toast notifications for all success and error actions
- Keep components small and single-purpose
- Do not implement Phase 2 (check-ins) yet — just make sure the score utility functions exist
- Do not implement reporting/export yet — placeholder button is fine