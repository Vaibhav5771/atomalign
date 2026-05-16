# AtomAlign — Master Progress Tracker

**Last updated:** 2026-05-16
**Overall completion:** ~97% (all phases done · Vercel deployed but env vars broken · 5 tasks remain — see Deployment section below)

---

## Project Completion Map

| Phase | Group | Status | % of total |
|-------|-------|--------|-----------|
| Phase 1 | Goal creation & approval | ✅ Complete | 45% |
| Phase 1.5 | Admin user management (bonus) | ✅ Complete | — |
| Phase 2 — P1 | Quarterly check-ins | ✅ Complete · all 31 tests passed | 20% |
| Phase 2 — P2 | Reporting & governance | ✅ Complete · all P2 tests passed | 20% |
| Phase 2 — P3 | Analytics module | ✅ Complete · all P3 tests passed | 10% |
| Deployment & submission | Vercel + docs | 🔄 In progress · blocked on Vercel env vars | 5% |

---

---

# PHASE 1 — Goal Creation & Approval
> ✅ 100% Complete · All 23 acceptance tests passing

---

## 0. Environment & Setup

- [x] `.env` populated with `VITE_SUPABASE_URL` + `VITE_SUPABASE_PUBLISHABLE_KEY`
- [x] Type-check passes (`npx tsc -b` → 0 errors)
- [x] WSL Node ≥ 20.19 available (using nvm v20.20.2)
- [x] Dev server starts cleanly (Vite 8 on http://localhost:5174)

## 1. Database

- [x] `supabase/migrations/0001_phase1_schema.sql` — profiles, goal_sheets, goals, shared_goals, audit_logs, check_ins, auth trigger
- [x] `supabase/migrations/0002_phase1_test_fixes.sql` — `goals.shared_by` FK + `enforce_shared_goal_lock` trigger
- [x] `supabase/migrations/0003_admin_reopen.sql` — `goal_sheets.reopened_by/reopened_at` + admin RLS update policies
- [x] **(user action)** All three migrations applied in Supabase SQL Editor (in order: 0001 → 0002 → 0003)
- [x] **(user action)** Demo users created in Supabase Auth dashboard
- [x] **(user action)** Role + `manager_id` linkage SQL run

## 2. Core Files

- [x] `src/types/index.ts`
- [x] `src/lib/supabase.ts`
- [x] `src/lib/utils.ts` — score functions (NUMERIC, PERCENT, TIMELINE, ZERO)

## 3. Zustand Stores

- [x] `src/stores/authStore.ts`
- [x] `src/stores/goalSheetStore.ts`
- [x] `src/stores/managerStore.ts`

## 4. Layout Components

- [x] `src/components/layout/ProtectedRoute.tsx`
- [x] `src/components/layout/Sidebar.tsx`
- [x] `src/components/layout/AppShell.tsx`

## 5. Shared Components

- [x] `src/components/shared/StatusBadge.tsx`
- [x] `src/components/shared/RoleBadge.tsx`

## 6. Goal Components

- [x] `src/components/goals/WeightageBar.tsx`
- [x] `src/components/goals/GoalForm.tsx`
- [x] `src/components/goals/GoalList.tsx`

## 7. Manager Components

- [x] `src/components/manager/TeamTable.tsx`
- [x] `src/components/manager/ReviewPanel.tsx`

## 8. Pages

- [x] `src/pages/auth/LoginPage.tsx`
- [x] `src/pages/employee/EmployeeDashboard.tsx`
- [x] `src/pages/employee/NewGoalSheetPage.tsx`
- [x] `src/pages/employee/GoalSheetPage.tsx`
- [x] `src/pages/manager/ManagerDashboard.tsx`
- [x] `src/pages/manager/ReviewGoalSheet.tsx`
- [x] `src/pages/admin/AdminDashboard.tsx`
- [x] `src/pages/admin/SharedGoalsPage.tsx`
- [x] `src/pages/NotFoundPage.tsx`

## 9. Routing

- [x] `src/App.tsx` — all 8 routes wired with ProtectedRoute + catch-all NotFoundPage

## 10. Validation Rules

- [x] Total weightage = 100% gate on submit + over-allocation guard on edit and shared-goal weightage paths
- [x] Min weightage 10% per goal (DB CHECK + zod)
- [x] Max 8 goals per sheet (DB trigger + client cap)
- [x] Goals locked after approval (`is_locked = true`; UI hides edit/delete)
- [x] Shared goals: title/target read-only for employee (UI + DB trigger `enforce_shared_goal_lock`)
- [x] Returned sheet → DRAFT, editable, resubmittable

## 11. Acceptance Tests

- [x] Employee login + correct redirect
- [x] Employee creates goal sheet and adds goals
- [x] WeightageBar shows running total (red → green at 100%)
- [x] Cannot submit if weightage ≠ 100%
- [x] Cannot add more than 8 goals
- [x] Cannot add goal with weightage < 10%
- [x] Submit → status = SUBMITTED → form locks
- [x] Manager login + team dashboard
- [x] Manager opens and reviews submitted sheet
- [x] Manager edits target and weightage inline
- [x] Manager approves → goals lock → audit log created
- [x] Manager returns sheet → employee can edit and resubmit
- [x] Admin pushes shared goal (with reopen & push conflict resolution flow)
- [x] Employee sees shared goal with locked title/target
- [x] Role-based route guards (wrong role → redirect)
- [x] Session persists on page refresh

---

---

# PHASE 1.5 — Admin User Management (Bonus)
> ✅ Built · type-check 0 errors

Replaces the original "create users by hand in the Supabase Auth dashboard" workflow with a first-class admin page.

### Database
- [x] `supabase/migrations/0005_admin_delete_user.sql` — `admin_delete_user(uuid)` SECURITY DEFINER RPC
- [x] **(user action)** Migration 0005 applied in Supabase SQL Editor
- [x] **(user action)** Supabase → Authentication → Settings → "Confirm email" set to OFF so new users can sign in immediately

### Store (`authStore.ts`)
- [x] `adminCreateUser(args)` — isolated Supabase client (does not clobber admin session); reads role from auth metadata via existing `handle_new_user` trigger; patches `full_name` / `manager_id` / `department` on the new profile
- [x] `adminUpdateUser(userId, patch)` — patches `full_name` / `role` / `manager_id` / `department`; calls `refreshProfile` if admin edits self
- [x] `adminDeleteUser(userId)` — calls `admin_delete_user` RPC; client-side guards (admin role check, self-delete block)

### Page (`src/pages/admin/UsersPage.tsx`)
- [x] Create form: full name, email, password, role, department, reporting manager (when role=EMPLOYEE)
- [x] Existing users table with role badges and manager name lookup
- [x] **Edit** dialog (pencil icon) — full name / role / department / manager_id
- [x] **Delete** dialog (trash icon) — destructive confirmation requiring email retype
- [x] Self-delete disabled in UI (DB function also blocks it)

### Security stance
- [x] ADMIN role removed from BOTH create form and edit dialog
- [x] Existing admins shown as read-only "Locked — change via SQL" badge in edit dialog
- [x] Admin role can only be granted via direct SQL (`update profiles set role='ADMIN' where email=…`)
- [x] `admin_delete_user` RPC checks `current_role() = 'ADMIN'` server-side (defence in depth)
- [x] Cascade plan: deleting a user removes their profile, goal_sheets, goals, check_ins, shared_goals; audit_logs preserved via `ON DELETE SET NULL`; their reports' `manager_id` cleared

### Routing & Navigation
- [x] `/admin/users` route in `App.tsx`
- [x] Admin sidebar: "Users" link with UserPlus icon

### Tests (manual)
- [x] Admin can create an EMPLOYEE with manager linkage; user can log in immediately
- [x] Admin can create a MANAGER; appears in the Reporting-manager dropdown for new employees
- [x] Admin can edit name / role / department / manager_id on any non-admin user
- [x] Editing an existing admin shows the "Locked — change via SQL" badge; their role cannot be touched from the UI
- [x] Admin can delete a non-admin user after typing the confirmation email; cascades verified in `auth.users` and `profiles`
- [x] Admin cannot delete themselves (UI disabled + RPC raises `'You cannot delete your own account'`)
- [x] `audit_logs` has an `ADMIN_DELETED_USER` row per delete

---

---

# PHASE 2 — Achievement Tracking, Reporting & Analytics

---

## P1 — Quarterly Check-in Module
> ✅ Complete · type-check 0 errors · all 31 manual tests passed per [02-phase-2-test.md](./02-phase-2-test.md)

### Database
- [x] `supabase/migrations/0004_phase2_checkins.sql` created
- [x] **(user action)** Migration 0004 applied in Supabase SQL Editor
- [x] RLS: employee INSERT own check_ins (APPROVED sheet only)
- [x] RLS: employee UPDATE own check_ins (APPROVED sheet only)
- [x] RLS: manager SELECT team check_ins
- [x] RLS: manager UPDATE manager_comment on any check_in (enforced via field-scope trigger)
- [x] RLS: admin SELECT all check_ins
- [x] RLS: admin UPDATE all check_ins
- [x] BRD adherence: `goals.direction` column added (HIGHER/LOWER) so Min vs Max scoring is honoured

### Zustand Store Updates
- [x] `goalSheetStore` — `checkIns` map added to state
- [x] `goalSheetStore` — `fetchCheckIns(sheetId)` action
- [x] `goalSheetStore` — `saveCheckIn(goalId, quarter, actual, actualDate, status)` action + score compute + audit log (`CHECK_IN_SAVED`)
- [x] `managerStore` — `selectedEmployeeCheckIns` added to state
- [x] `managerStore` — `fetchTeamCheckIns(employeeId, quarter)` action
- [x] `managerStore` — `saveManagerComment(checkInId, comment)` action + audit log (`MANAGER_COMMENT_SAVED`)

### New Components
- [x] `src/components/goals/QuarterSelector.tsx` (shadcn Tabs)
- [x] `src/components/goals/CheckInForm.tsx`
- [x] `src/components/goals/CheckInScoreCard.tsx`
- [x] `src/components/manager/ManagerCheckInView.tsx`

### New Pages
- [x] `src/pages/employee/CheckInsPage.tsx`
- [x] `src/pages/manager/ManagerCheckInsPage.tsx`

### Routing & Navigation
- [x] `/employee/checkins` route added in `App.tsx`
- [x] `/manager/checkins` route added in `App.tsx`
- [x] Employee sidebar: "My Check-ins" link added
- [x] Manager sidebar: "Team Check-ins" link added

### Phase 1 Surgical Patch
- [x] `GoalForm.tsx` extended with "Scoring direction" toggle (Higher / Lower) for NUMERIC/PERCENT goals

### P1 Acceptance Tests
> See the walkthrough in [02-phase-2-test.md](./02-phase-2-test.md) (31 numbered tests across Sections 12–15).

- [x] All 31 P1 tests passed

---

## P2 — Reporting & Governance
> ✅ Complete · type-check 0 errors · all P2 tests passed per [03-p2-test.md](./03-p2-test.md)
>
> No new migration needed — all reports are read-only against existing tables. Audit-table access is gated by the existing `audit_logs_select_admin` policy from migration 0001.

### Store (new)
- [x] `src/stores/reportsStore.ts` — `fetchCompletion`, `fetchAchievement`, `fetchAudit` actions; typed row interfaces (`CompletionRow`, `AchievementRow`, `AuditRow`)

### New Components
- [x] `src/components/shared/ExportButton.tsx` (generic xlsx writer, date-stamped filename, loading spinner)
- [x] `src/components/admin/CompletionTable.tsx` (per-quarter ✅/⏳/— states, manager filter, dynamic summary)
- [x] `src/components/admin/AuditTable.tsx` (newest-first, click-to-expand JSON, colour-coded action badges)

### New Pages
- [x] `src/pages/admin/ReportsPage.tsx` (3 shadcn Tabs: Achievement Export · Completion Dashboard · Audit Trail)

### Routing & Navigation
- [x] `/admin/reports` route added in `App.tsx`
- [x] Admin sidebar: "Reports" link added (FileBarChart icon)

### Surgical patch
- [x] `src/components/ui/tabs.tsx` — fixed `data-active:` → `data-[state=active]:` and the broken orientation variant so shadcn Tabs actually work in Tailwind 3

### P2 Acceptance Tests
> See the walkthrough in [03-p2-test.md](./03-p2-test.md) (24 numbered tests across Sections 16–19).

- [x] All P2 tests passed

---

## P3 — Analytics Module (Bonus)
> ✅ Complete · type-check 0 errors · all P3 tests passed per [04-p3-test.md](./04-p3-test.md)

### Database
- [x] `supabase/migrations/0006_analytics_summary.sql` — `analytics_summary` view (SECURITY INVOKER; RLS via underlying tables)
- [x] **(user action)** Migration 0006 applied in Supabase SQL Editor
- [x] View columns: `employee_id, employee_name, department, manager_id, manager_name, goal_id, goal_title, thrust_area, uom, target, weightage, sheet_status, quarter, actual, score, checkin_status`

### Type addition
- [x] `AnalyticsRow` interface in `src/types/index.ts`

### New Zustand Store
- [x] `src/stores/analyticsStore.ts` — `summary[]`, `loading`, `error`, `fetchAnalytics()`, `reset()`

### New Components
- [x] `src/components/admin/AnalyticsDashboard.tsx` — all 4 charts in one file:
  - Chart 1: QoQ Achievement Trend (Recharts `LineChart`) with whole-org / per-department toggle
  - Chart 2: Goal Distribution (Recharts `PieChart`) with Thrust Area / UoM / Status tabs
  - Chart 3: Team Completion Rate (Recharts horizontal `BarChart`) with green/amber/red bars
  - Chart 4: Manager Effectiveness (shadcn `Table`) sorted by completion rate desc
- [x] Loading skeletons (`animate-pulse bg-muted/40`) per chart
- [x] "No data yet" placeholders when empty (never crashes)
- [x] Top-of-page stats row (Employees / Goals / Approved / Check-ins)

### New Pages
- [x] `src/pages/admin/AnalyticsPage.tsx` — calls `fetchAnalytics` on mount, renders dashboard

### Routing & Navigation
- [x] `/admin/analytics` route added in `App.tsx` (ADMIN-only via ProtectedRoute)
- [x] Admin sidebar: "Analytics" link added (TrendingUp icon)

### P3 Acceptance Tests
> See the walkthrough in [04-p3-test.md](./04-p3-test.md) (21 numbered tests across Sections 20–25).

- [x] All P3 tests passed

---

---

# DEPLOYMENT & SUBMISSION
> Detailed checklist + step-by-step plan lives in [deployment.md](./deployment.md). Submission deadline: **2026-05-18 08:00**.

## Completed (2026-05-16)

- [x] `npm run build` passes with 0 errors and 0 TypeScript errors (TS clean, Vite built 1.47 MB / 435 KB gzipped, 3.38s)
- [x] **GitHub repo pushed** — `Vaibhav5771/atomalign` on `main`, commit `2612c6a Add Phase 1.5 admin user mgmt, Phase 2 (check-ins, reports, analytics), deployment prep`. All 6 migrations now in repo; 11 new pages/components added; .env untracked (gitignored)
- [x] **README replaced** — boilerplate gone, proper project overview + setup steps + hackathon mapping
- [x] **Login credentials doc** — [context/demo-credentials.md](./demo-credentials.md) drafted with 3 demo users + happy-path walk-through
- [x] **App deployed to Vercel** — first build live at https://atomalign.vercel.app/login (Phase 1 only) · second build at commit `2612c6a` is broken (env var issue, see below)
- [x] **Supabase Auth URL config** — Site URL + Redirect URLs set to the Vercel domain

## Blocker (resume here)

- ⚠️ **Vercel env vars not reaching the Production build.** Diagnosis: downloaded the live bundle, searched for `https://*.supabase.co` and `eyJ...` (publishable JWT prefix) — both absent. Vite saw empty values at build time and baked the "Missing Supabase env vars" throw into the bundle.
- **Symptom in browser:** `Uncaught Error: Missing Supabase env vars. Set VITE_SUPABASE_URL and VITE_SUPABASE_PUBLISHABLE_KEY in .env` at `index-k7IyKfg0.js`
- **Tried so far:** added env vars in Vercel (initially only Preview), then re-ticked Production. Redeploy ran but only 26s (cache hit). Nuclear reset (delete + re-add both env vars with all 3 environment checkboxes ticked) was started — user reports "done" but the force-redeploy commit `241eb4d` hasn't been pushed yet.
- **Local commit waiting to be pushed:** `241eb4d Force Vercel redeploy to pick up env vars` (empty commit, ahead of origin/main by 1).

## Remaining tasks (5)

- [ ] **1. Push empty commit `241eb4d`** to force a fresh Vercel build that picks up the re-added env vars. Push via VSCode sync arrow or terminal. Watch the resulting Vercel build — duration should be 60–120s (a sub-30s build means cache is still winning).
- [ ] **2. Live-URL smoke test for all 3 role journeys** — once the redeploy is green, run the minimal sweep documented in [deployment.md](./deployment.md) section 3:
  - Employee: login → Dashboard / My Goals / **My Check-ins** sidebar items
  - Manager: login → Dashboard / **Team Check-ins** sidebar
  - Admin: login → Dashboard / Shared Goals / **Users / Reports / Analytics** sidebar; click each
  - DevTools console clear on every page
- [ ] **3. Draw architecture.png** — use the layout in [context/architecture-spec.md](./architecture-spec.md), open Excalidraw, follow the 10-step recipe at the bottom, export PNG to `context/architecture.png`, link from README.
- [ ] **4. Rotate Supabase publishable key (Option B from chat)** — the publishable key still in git history at commit `18519e8 Implement  Phase 1`. Supabase Dashboard → Settings → API → rotate publishable (anon) key → update local `.env` AND Vercel env vars AND trigger a redeploy. Do this **before** filling the submission form.
- [ ] **5. Fill submission form** — live URL · repo link · architecture diagram link · demo credentials doc link. Deadline 2026-05-18 08:00.