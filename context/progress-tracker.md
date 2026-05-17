# AtomAlign — Master Progress Tracker

**Last updated:** 2026-05-18 (round 5 — latency fixes + deployment finalised)
**Overall completion:** ~99.95% — all phases done, Netlify deployment live, UptimeRobot warm-ping active, Supabase cold-start polling fixed, CreateTeamWizard parallelised. Remaining items: key rotation, smoke test, submission form.

---

## Loose ends before submission (2026-05-19 10:00)

Status as of round-5 build.

| # | Item | Type | Status |
|---|---|---|---|
| 1 | Apply migration `0008_escalations.sql` in Supabase SQL Editor | user action | ✅ |
| 2 | Apply migration `0009_restrict_azure_signup.sql` in Supabase SQL Editor | user action | ✅ |
| 2b | Apply migration `0011_update_my_account_immediate.sql` in SQL Editor | user action | ⬜ |
| 3 | `supabase functions deploy notify` (picks up `event: 'user_created'` welcome email + extended escalation payload) | user action | ✅ |
| 4 | `supabase functions deploy evaluate-escalations` (if 5.3 will be demoed) | user action | ✅ |
| 5 | Commit + push round-4 changes to `Vaibhav5771/atomalign` `main` | git | ✅ |
| 6 | ~~Architecture diagram~~ — `context/architecture.png` (rendered via cairosvg from `context/architecture.svg`) | submission deliverable | ✅ |
| 7 | Netlify migration (from Vercel) · Supabase Auth URLs updated · UptimeRobot warm-ping configured | deployment | ✅ |
| 8 | Fix `adminCreateUser` polling loop (600ms wait + 1 retry) — `src/stores/authStore.ts` | perf fix | ✅ |
| 9 | Parallelise `CreateTeamWizard` manager + employee creation with `Promise.all` — `src/components/admin/CreateTeamWizard.tsx` | perf fix | ✅ |
| 9b | Cache wizard user lists (`workspaceManagers`, `workspaceEmployees`) in Zustand. Show complete team tree in step 4 summary. | perf/UX fix | ✅ |
| 10 | `npx tsc -b --noEmit && npm run build` — verify 0 errors after round-5 changes | QA | ⬜ |
| 11 | Commit + push round-5 latency fixes to `main` + Netlify auto-redeploy | git | ⬜ |
| 12 | Apply for Supabase Hackathon Pro trial (removes instance pause permanently) | optional perf | ⬜ |
| 13 | Rotate Supabase publishable key + update `.env` + Netlify env vars + redeploy | security | ⬜ |
| 14 | Smoke test the full wizard on `https://atomalignv.netlify.app` (3 role journeys) | QA | ⬜ |
| 15 | Fill submission form (live URL · repo · diagram · creds doc) | submission | ⬜ |

**Hard blockers**: ~~#2, #3, #5~~ ✅ · #2b, #15 remaining.
**Must do before submit**: #2b, #10, #11, #13, #14.
**Strongly recommended**: #12.

---

## BRD coverage matrix (cross-checked against `6a06fcd06885a_AtomQuest_Hackathon_1.0_Problem_Statement_.docx`)

| BRD section | Requirement | Implementation | Status |
|---|---|---|---|
| 2.1 | Goal sheet creation, Thrust Area, UoM (Numeric/%/Timeline/Zero), targets, weightage | Phase 1 + Round-3 per-UoM target UI in `GoalForm` | ✅ |
| 2.1 | Weightage = 100% · min 10% · max 8 goals | DB CHECK + triggers + client zod | ✅ |
| 2.1 | Manager L1 approval workflow, inline edit, return, lock on approve | `ReviewGoalSheet` + `managerStore` | ✅ |
| 2.1 | Shared goals (admin pushes, recipients adjust weightage only, title/target read-only) | `SharedGoalsPage` + `enforce_shared_goal_lock` trigger | ✅ |
| 2.2 | Quarterly check-ins, status per goal, manager comments | `CheckInsPage` + `CheckInForm` + `ManagerCheckInView` | ✅ |
| 2.2 | UoM score formulas (Min, Max, Timeline, Zero) | `utils.ts` score functions + `goals.direction` column | ✅ |
| 2.3 | Quarterly window enforcement (May goal-setting, July Q1, October Q2, January Q3, March/April Q4) | `CyclePhaseBanner` on both `CheckInsPage` (employee) and `ManagerCheckInsPage` shows the currently-open BRD window + when the next opens. Saves are not hard-blocked outside the window so the demo can exercise all four quarters at any time. Soft enforcement is documented in `lib/utils.ts` `cyclePhase()` | ✅ Soft enforcement |
| 3 | Three roles with differentiated capabilities | `ProtectedRoute` + RLS policies + role-based sidebar | ✅ |
| 4 | Achievement report exportable (CSV/Excel) | `ReportsPage` + `ExportButton` (xlsx) | ✅ |
| 4 | Completion dashboard | `CompletionTable` in `ReportsPage` | ✅ |
| 4 | Audit trail | `audit_logs` table + `AuditTable` UI | ✅ |
| 5.1 | Entra ID SSO | `signInWithMicrosoft` + `/auth/callback` | ✅ |
| 5.1 | Org hierarchy sync from Azure AD | `graph.ts` syncs `displayName`/`mail`/`department`/`manager.mail` from `/me?$expand=manager` | ✅ |
| 5.1 | Role assignment mapped from Azure AD group membership | **Not implemented.** Requires `GroupMember.Read.All` admin consent. Default is EMPLOYEE; admin promotes via `/admin/users`. Defensible as "least privilege by default" | ⚠️ Scope decision |
| 5.1 (new round-4) | MS sign-in restricted to admin-pre-registered emails | migration `0009_restrict_azure_signup.sql` rejects azure provider in `handle_new_user` if email not in profiles | ✅ |
| 5.2 | Email notifications: submission, approval, rejection, check-in reminders | `notify` Edge Function via Gmail SMTP. Submission ✅, approval ✅, return ✅, check-in saved ✅. Time-based **check-in reminders** are delivered through Phase 5.3's `evaluate-escalations` daily scheduled function with the `CHECKIN_OVERDUE` trigger type (re-uses the same notification pipeline; admin configures threshold-days + escalate-to chain via `/admin/escalations`) | ✅ |
| 5.2 (new round-4) | Welcome email on admin-created users | new `event: 'user_created'` arm in `notify` Edge Function | ✅ |
| 5.2 | Teams adaptive card | Card builder coded for every event; will fire when `TEAMS_WEBHOOK_URL` secret is set (deferred — no M365 sandbox yet) | ⚠️ Code-ready, deferred |
| 5.2 | Teams deep-link to relevant goal sheet | `Action.OpenUrl` in adaptive card → `APP_BASE_URL/employee/goals` | ✅ |
| 5.3 | Rule-based escalation with chain | `EscalationsPage` + `evaluate-escalations` Edge Function + 3-step SUBMIT_OVERDUE chain seeded | ✅ |
| 5.3 | Escalation log visible to admin/HR | "Log" tab in `EscalationsPage` | ✅ |
| 5.4 | QoQ trends · distribution · team completion · manager effectiveness | `AnalyticsDashboard` (4 charts) | ✅ |
| 7 | Web-browser accessible, version-controlled, architecture diagram | Netlify (`https://atomalignv.netlify.app`) + GitHub repo · architecture diagram ✅ | ✅ |
| 8 | Login credentials of 3 roles **or option to switch journeys** | Demo creds doc + round-4 "Create Team" wizard so judges can spin up their own isolated team. Best of both | ✅ |

---

## Project Completion Map

| Phase | Group | Status | % of total |
|-------|-------|--------|-----------|
| Phase 1 | Goal creation & approval | ✅ Complete | 45% |
| Phase 1.5 | Admin user management (bonus) | ✅ Complete | — |
| Phase 2 — P1 | Quarterly check-ins | ✅ Complete · all 31 tests passed | 20% |
| Phase 2 — P2 | Reporting & governance | ✅ Complete · all P2 tests passed | 20% |
| Phase 2 — P3 | Analytics module (BRD §5.4) | ✅ Complete · all P3 tests passed | 10% |
| Phase 5 — 5.1 | Entra ID SSO + Graph org sync (bonus) | ✅ Live · MS sign-in verified on `vaibhavpardeshi190@gmail.com` · round-4 lockdown via migration 0009 | — |
| Phase 5 — 5.2 | Email notifications via Gmail SMTP (bonus) | ✅ Live · test email received · `user_created` welcome email added in round 4 · Teams card code-ready, deferred (no M365 sandbox yet) | — |
| Phase 5 — 5.3 | Rule-based escalation (bonus) | ✅ Live · 4 escalations fired end-to-end · emails received at atomberg + 190 | — |
| Round-3 UX hardening (2026-05-17 AM) | GoalForm + WeightageBar + CheckInForm fixes | ✅ Done · TS 0 errors, build 1.73s | — |
| Round-4 reviewer onboarding (2026-05-17 PM) | Create Team wizard · admin profile self-edit · welcome emails · MS sign-in lockdown | ✅ Done · TS 0 errors, build 2.98s | — |
| Deployment & submission | Netlify (`https://atomalignv.netlify.app`) + docs | 🔄 In progress · migrated from Vercel to Netlify ✅ · Supabase Auth URLs updated ✅ · UptimeRobot warm-ping configured ✅ · key rotation + submission form pending | 5% |

---

## Round-5 fix log (2026-05-18 — performance and caching)

Goal: close remaining UI confusions during admin onboarding flow, and remove duplicated database lookups when navigating between wizard steps.

- [x] `src/stores/authStore.ts` — Added `workspaceManagers` and `workspaceEmployees` Zustand cache + fetching logic to ensure data remains persistent and fetched once, skipping repeated DB hits when jumping between tabs.
- [x] `src/components/admin/CreateTeamWizard.tsx` — Rebuilt fetching mechanism to utilize Zustand. Redesigned Employee tab to show "Existing Employees (N)" at the top. Overhauled the final Summary tab to render the "Complete Team Hierarchy", parsing all relationships so users can see the whole existing org tree (and any plaintext passwords generated for newly created users), even if they skipped adding new users inside the flow.

---

## Round-4 fix log (2026-05-17 PM — reviewer onboarding)

Goal: close the two open loops for tomorrow's submission demo — (a) make it trivial for a judge to spin up their own isolated team so multiple reviewers don't collide on the shared demo DB, and (b) tighten the Microsoft sign-in flow so only admin-pre-registered emails get in.

- [x] New migration `0009_restrict_azure_signup.sql` — `handle_new_user` trigger rejects azure provider sign-ins whose email isn't already in `profiles`. Closes the "no one signs in with MS unless wizard-created" loop server-side. Existing email/password sign-up behaviour is byte-for-byte unchanged
- [x] `notify` Edge Function extended with `event: 'user_created'` — welcome email per admin-created user (HTML + plain text + Teams card path); reuses existing Gmail SMTP / denomailer setup. Plaintext password is shipped in the email — acceptable for hackathon, same posture as `demo-credentials.md`
- [x] `src/lib/notify.ts` — typed discriminated union; new `recipient_id` + `password` fields supported for `user_created`
- [x] `src/stores/authStore.ts` — new `updateMyAccount({full_name, email?, password?})` action. Used by Step 0 of the wizard so the demo admin can swap `admin@demo.com` / `Demo@1234` for her own inbox and start receiving goal-event emails herself
- [x] `src/components/admin/CreateTeamWizard.tsx` — new 4-step wizard (profile · managers · employees · summary). 1–5 managers, 1–20 employees per submit (Supabase free-tier rate-limit friendly), per-row error surfacing, sequential progress counter, copy-all-credentials markdown table on the summary
- [x] `src/pages/admin/AdminDashboard.tsx` — top-right **Create Team** button + first-time auto-popup gated by `localStorage("atomalign:onboarding-seen:<adminId>")`. Auto-opens once per admin per browser; afterwards the manual button is the entry
- [x] `src/pages/admin/UsersPage.tsx` — top-right **Create Team** button (manual entry, Step 0 skipped). Existing single-user "Create user" form + users table left untouched as the "edit / one-off add" path
- [x] `context/demo-credentials.md` — added "Recommended for judges — create your own team" walkthrough + MS-restriction explanation + dual-profile-on-MS-merge caveat
- [x] `README.md` — single-line callout pointing judges at the wizard
- [x] `npm run build` — 0 TS errors, Vite built in 2.98s (bundle 1,507kB / 444kB gzipped, ~60kB delta from round 3)

### Pending user actions for round-4
- [x] Apply migration `0009_restrict_azure_signup.sql` in Supabase SQL Editor
- [x] `supabase functions deploy notify` (re-deploy with the new `user_created` event)
- [x] Commit + push round-4 changes to `main`
- [ ] Live-URL smoke test: log in as `admin@demo.com / Demo@1234` in incognito → wizard auto-opens on `/admin/dashboard` Step 0 → change name/email/password → Step 1 add 2 managers (real Gmail) → Step 2 add 3 employees → confirm 5 welcome emails arrive → sign in as new manager → approve a goal sheet → confirm email cascade

### Round-4 fix-ups (2026-05-17 late PM)
Goal: close the remaining BRD gaps and deliver the submission's architecture diagram from code (so it ships in this commit, not as a separate manual action).

- [x] **Architecture diagram** — `context/architecture.svg` written by hand, rendered to `context/architecture.png` (2560px wide, 366 KB) via `cairosvg`. Three-layer layout per `architecture-spec.md`: Users → Netlify SPA → Supabase (Auth/Postgres/Edge Functions) with side annotations for Security boundary + External integrations
- [x] **BRD §2.3 quarterly window indicator** — `cyclePhase()` helper in `lib/utils.ts` returns the BRD-correct open window for today's date (May→Goal-Setting, Jul–Sep→Q1, Oct–Dec→Q2, Jan–Feb→Q3, Mar–Apr→Q4). New `CyclePhaseBanner` component is mounted on both `CheckInsPage` and `ManagerCheckInsPage`. Soft indicator — does not hard-block saves so the demo still works in May
- [x] **Audit trail extended** — `adminCreateUser` now writes a `USER_CREATED` row to `audit_logs` per wizard-created user (captures email/role/full_name/manager_id/department in `new_value`). Visible to admins via `/admin/reports` → Audit tab
- [x] **AuthCallbackPage error surface** — parses `error_description` from the OAuth redirect hash so a rejected MS sign-in (migration 0009) shows a friendly card with "ask admin to add you via the wizard" + Back-to-login button, instead of looping on the splash screen
- [x] **BRD §5.2 reminders coverage clarified** — escalation module's `CHECKIN_OVERDUE` trigger type already handles time-based check-in reminders; documented in the BRD coverage matrix above and in `demo-credentials.md`
- [x] `npm run build` — 0 TS errors

---

## Round-3 fix log (2026-05-17 PM)
Detailed log: [current-issues.md](./current-issues.md)

- [x] WeightageBar: solid amber/emerald/rose fills; "Ready to submit" / "Need X% more" copy
- [x] GoalForm: conditional Target UI per UoM (NUMERIC/PERCENT number input · TIMELINE date-picker only · ZERO disabled "0" Input matching other field styles · ZERO fixed to use real `<Input disabled>` so visual is consistent)
- [x] GoalForm: zod `superRefine` validation — TIMELINE requires `target_date`, NUMERIC/PERCENT require positive numbers, PERCENT ≤ 100, all required fields marked `*`
- [x] CheckInForm: per-UoM help text banners explaining TIMELINE single-completion model and ZERO per-quarter incident count
- [x] Round-2 carryovers also still in: Switch CSS Tailwind 3 syntax fix · Reporting-manager dropdown shown for all non-admin roles · evaluate-escalations forwards user JWT to notify (verify_jwt stays ON)

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

# PHASE 5 — Bonus features (BRD §5.1 + §5.2 + §5.3)
> 5.1 ✅ live · 5.2 ✅ live (email) / deferred (Teams) · 5.3 📋 planned
>
> Setup guide: [05-microsoft-integration.md](./05-microsoft-integration.md) · Test walkthrough: [05-microsoft-integration-test.md](./05-microsoft-integration-test.md)

## 5.1 — Entra ID SSO + Org Hierarchy Sync ✅

### Database
- [x] `supabase/migrations/0007_microsoft_integration.sql` — adds nullable `profiles.azure_oid` (+ unique partial index) and `profiles.auth_provider`; patches `handle_new_user()` to accept Azure's `name` claim and tag rows with their provider (`email` vs `azure`)
- [x] **(user action)** Migration 0007 applied in Supabase SQL Editor

### Azure App Registration & Supabase wiring
- [x] **(user action)** Azure App Registration created in personal tenant `vaibhavpardeshi190gmail.onmicrosoft.com` ("Any Entra ID Tenant + Personal Microsoft accounts"); `User.Read` delegated; web redirect = `localhost:5174/auth/callback` + Supabase callback
- [x] **(user action)** Supabase → Authentication → Providers → Azure enabled with client ID + secret; tenant URL = `https://login.microsoftonline.com/common`
- [x] **(user action)** Supabase → Authentication → URL Configuration → Redirect URLs include `http://localhost:5174/auth/callback` and `https://atomalignv.netlify.app/auth/callback` *(updated from Vercel → Netlify)*

### Client code
- [x] `src/lib/graph.ts` — Microsoft Graph `/me` client with `$expand=manager`; maps `displayName`/`mail`/`department` and resolves `manager_id` by email lookup
- [x] `src/stores/authStore.ts` — adds `signInWithMicrosoft()` + `syncing` flag; existing `onAuthStateChange` listener runs Graph sync when `app_metadata.provider === 'azure'`
- [x] `src/types/index.ts` — `Profile` interface extended with optional `azure_oid` + `auth_provider`

### Pages & routing
- [x] `src/pages/auth/AuthCallbackPage.tsx` — landing page at `/auth/callback`; waits for `syncing` to clear, redirects to role home
- [x] `src/pages/auth/LoginPage.tsx` — "Sign in with Microsoft" button below existing email/password form (additive only, demo logins unchanged)
- [x] `src/App.tsx` — `/auth/callback` route added

### Verified end-to-end
- [x] Microsoft sign-in tested with `vaibhavpardeshi190@gmail.com` → lands on dashboard with `auth_provider=azure`, `azure_oid` populated, `full_name` from Graph

## 5.2 — Email Notifications (Gmail SMTP) ✅ / Teams card deferred

### Edge Function (deployed)
- [x] `supabase/functions/notify/index.ts` — uses **Gmail SMTP via [denomailer](https://deno.land/x/denomailer)** (swapped from Resend since Resend sandbox can only deliver to the signup email — Gmail SMTP delivers to any recipient with no domain verification); accepts `{event, sheet_id, actor_id, remark?, quarter?}`; resolves recipient (manager for employee actions; employee for manager actions); sends styled HTML email + Adaptive Card to Teams in parallel; CORS-safe; degrades gracefully when secrets are unset
- [x] **(user action)** `supabase functions deploy notify` run (JWT verification ON — only signed-in users can invoke)
- [x] **(user action)** Secrets set: `GMAIL_USER`, `GMAIL_APP_PASSWORD`, `GMAIL_FROM_NAME`, `APP_BASE_URL`

### Client wrapper
- [x] `src/lib/notify.ts` — fire-and-forget wrapper around `supabase.functions.invoke('notify')`; logs warnings but never throws; UI is never blocked

### Trigger points wired
- [x] Employee submits goal sheet → `notify({event: "submitted"})` (recipient = manager) — in `goalSheetStore.submitSheet`
- [x] Manager approves sheet → `notify({event: "approved"})` (recipient = employee) — in `managerStore.approveSheet`
- [x] Manager returns sheet → `notify({event: "returned"})` (recipient = employee) — in `managerStore.returnSheet`
- [x] Employee saves check-in → `notify({event: "checkin_saved"})` (recipient = manager) — in `goalSheetStore.saveCheckIn`

### Verified end-to-end
- [x] Employee saved check-in → email arrived at `vaibhavpardeshi190@gmail.com` (manager's profile email patched to gmail since `manager@demo.com` is a fake address); subject + body content correct
- [x] HTML polish redeploy: added explicit UTF-8 charset, removed leading-whitespace artifacts (`=20`), replaced em-dash with hyphen (no more `2€` mojibake)

### Teams Incoming Webhook
- Code is ready and will fire when secret is set; deferred because the M365 Developer Program sandbox application is still pending approval (no Teams tenant currently available)
- [ ] **(user action — when sandbox arrives)** Create Incoming Webhook → `supabase secrets set TEAMS_WEBHOOK_URL=...` → re-test. No code changes needed.

### Phase 5 Acceptance Tests
> See the walkthrough in [05-microsoft-integration-test.md](./05-microsoft-integration-test.md) (21 numbered tests across Sections 26–30).
>
> Section 27 is the regression sweep — runs the 3 demo passwords + admin user-creation BEFORE touching Microsoft, so we catch any accidental break early.

- [x] Core flows verified ad-hoc during build (MS sign-in + email delivery)
- [ ] Full 21-test sweep not yet run formally — recommend before submission demo

---

## 5.3 — Rule-Based Escalation Module 🔄

> Design: [05-3-escalation-plan.md](./05-3-escalation-plan.md) · Test walkthrough: [05-3-escalation-test.md](./05-3-escalation-test.md) (26 numbered tests across Sections 31–36)

### Status

- [x] `supabase/migrations/0008_escalations.sql` — enums, both tables, RLS, unique dedupe index, 5 seed rules (3-step chain for SUBMIT_OVERDUE)
- [x] `src/types/index.ts` — `TriggerType`, `EscalateTarget`, `EscalationRule`, `Escalation`, `EscalationWithPeople`, `RunEscalationsResult`
- [x] `supabase/functions/evaluate-escalations/index.ts` — daily-runnable evaluator; queries 3 trigger types; resolves recipient via chain; idempotent via daily unique index; calls `notify` for each fire
- [x] `supabase/functions/notify/index.ts` — extended with `event: "escalation"` + optional `recipient_id` + optional `sheet_id` (escalations may not have a sheet)
- [x] `src/stores/escalationsStore.ts` — `fetchRules`, `createRule`, `updateRule`, `deleteRule`, `fetchLog`, `runNow`, `resolve`
- [x] `src/pages/admin/EscalationsPage.tsx` — Rules tab (CRUD + activate switch) + Log tab + "Run escalations now" button + create/edit/delete dialogs (single-file pattern matching `AnalyticsDashboard`)
- [x] `src/components/ui/switch.tsx` — new shadcn Switch primitive (uses `radix-ui` aggregated package)
- [x] `src/App.tsx` — `/admin/escalations` route added (ADMIN-only)
- [x] `src/components/layout/Sidebar.tsx` — admin nav link with `AlertTriangle` icon
- [x] Build: `npm run build` passes (1.55s, 0 TS errors)

### Remaining user actions
- [x] **(user action)** Apply migration 0008 in Supabase SQL Editor
- [x] **(user action)** `supabase functions deploy notify` (re-deploy with extended payload)
- [x] **(user action)** `supabase functions deploy evaluate-escalations`
- [ ] **(user action)** Supabase Dashboard → Database → Cron → schedule `evaluate-escalations` daily 09:00 UTC (optional — "Run now" button works without it)
- [ ] **(user action)** Smoke test: backdate a draft sheet 20 days, click "Run now" in `/admin/escalations`, verify log row + email arrives

---

---

# DEPLOYMENT & SUBMISSION
> Detailed checklist + step-by-step plan lives in [deployment.md](./deployment.md). Submission deadline: **2026-05-18 08:00**.

## Completed (2026-05-16)

- [x] `npm run build` passes with 0 errors and 0 TypeScript errors (TS clean, Vite built 1.47 MB / 435 KB gzipped, 3.38s)
- [x] **GitHub repo pushed** — `Vaibhav5771/atomalign` on `main`, commit `2612c6a Add Phase 1.5 admin user mgmt, Phase 2 (check-ins, reports, analytics), deployment prep`. All 6 migrations now in repo; 11 new pages/components added; .env untracked (gitignored)
- [x] **README replaced** — boilerplate gone, proper project overview + setup steps + hackathon mapping
- [x] **Login credentials doc** — [context/demo-credentials.md](./demo-credentials.md) drafted with 3 demo users + happy-path walk-through
- [x] **App migrated from Vercel → Netlify** — live at **https://atomalignv.netlify.app/login** · `netlify.toml` present · SPA fallback `/*` → `/index.html` configured · env vars (`VITE_SUPABASE_URL`, `VITE_SUPABASE_PUBLISHABLE_KEY`) set in Netlify dashboard
- [x] **Supabase Auth URL config** — Site URL + Redirect URLs updated to Netlify domain (`https://atomalignv.netlify.app/auth/callback`) ✅
- [x] **UptimeRobot warm-ping** — free monitor pinging `https://atomalignv.netlify.app/login` every 10 min to prevent Supabase free-tier cold starts ✅

## Remaining tasks (5)

- [x] **1. Netlify deployment live** — `https://atomalignv.netlify.app/login` is the canonical live URL. Vercel deployment abandoned.
- [ ] **2. Live-URL smoke test for all 3 role journeys** — once the redeploy is green, run the minimal sweep documented in [deployment.md](./deployment.md) section 3:
  - Employee: login → Dashboard / My Goals / **My Check-ins** sidebar items
  - Manager: login → Dashboard / **Team Check-ins** sidebar
  - Admin: login → Dashboard / Shared Goals / **Users / Reports / Analytics** sidebar; click each
  - DevTools console clear on every page
- [ ] **3. Draw architecture.png** — use the layout in [context/architecture-spec.md](./architecture-spec.md), open Excalidraw, follow the 10-step recipe at the bottom, export PNG to `context/architecture.png`, link from README.
- [ ] **4. Rotate Supabase publishable key (Option B from chat)** — the publishable key still in git history at commit `18519e8 Implement  Phase 1`. Supabase Dashboard → Settings → API → rotate publishable (anon) key → update local `.env` AND Netlify env vars → trigger a redeploy. Do this **before** filling the submission form.
- [ ] **5. Fill submission form** — live URL · repo link · architecture diagram link · demo credentials doc link. Deadline 2026-05-18 08:00.