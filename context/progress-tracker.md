# Phase 1 Progress Tracker

**Last updated:** 2026-05-16 (post acceptance test pass)

This tracker mirrors [01-phase-1.md](01-phase-1.md). Flip `- [ ]` to `- [x]` as each item lands. Sections marked **(user action)** require manual work in the Supabase dashboard.

---

## 0. Environment & Setup

- [x] `.env` populated with `VITE_SUPABASE_URL` + `VITE_SUPABASE_PUBLISHABLE_KEY`
- [x] Type-check passes (`npx tsc -b` → 0 errors)
- [x] WSL Node ≥ 20.19 available (using nvm v20.20.2)
- [x] Dev server starts cleanly (Vite 8 on http://localhost:5174)

## 1. Database (Supabase)

- [x] `supabase/migrations/0001_phase1_schema.sql` created
- [x] `profiles` table + RLS
- [x] `goal_sheets` table + RLS
- [x] `goals` table + RLS (lock enforcement)
- [x] `shared_goals` table + RLS (unique constraint)
- [x] `audit_logs` table + RLS
- [x] Auth trigger: `on auth.users insert → profiles row`
- [x] **(user action)** Migration applied via Supabase SQL Editor
- [x] **(user action)** Demo users created in Supabase Auth dashboard
- [x] **(user action)** Role + `manager_id` linkage SQL run

## 2. Core Files

- [x] `src/types/index.ts`
- [x] `src/lib/supabase.ts`
- [x] `src/lib/utils.ts` extended with score functions (NUMERIC, PERCENT, TIMELINE, ZERO)

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

- [x] `src/App.tsx` replaced with router + role guards
- [x] All 8 routes wired with `ProtectedRoute`
- [x] Catch-all → `NotFoundPage`

## 10. Validation Rules (enforced & verified)

- [x] Total weightage = 100% gate on submit (UI: [NewGoalSheetPage](src/pages/employee/NewGoalSheetPage.tsx); store: [goalSheetStore.canSubmit](src/stores/goalSheetStore.ts))
- [x] Min weightage 10% per goal (DB `CHECK` + zod schema in [GoalForm](src/components/goals/GoalForm.tsx))
- [x] Max 8 goals per sheet (DB trigger `enforce_goal_cap` + client cap in store)
- [x] Goals locked after manager approval (`is_locked=true` set on approve; UI hides edit/delete)
- [x] Shared goals: title/target read-only for employee (UI-enforced in [GoalList](src/components/goals/GoalList.tsx); weightage editable inline)
- [x] Returned sheet → DRAFT, editable, resubmittable ([managerStore.returnSheet](src/stores/managerStore.ts); RLS allows employee update on RETURNED)

## 11. Acceptance Tests (from plan §"What Done Looks Like")

Data-layer verified by `test-acceptance.mjs` (23/23 PASS). UI-only items code-verified.

- [x] Employee can log in and is redirected correctly *(AC1; LoginPage role-routing)*
- [x] Employee can create a goal sheet and add goals *(AC2a, AC2b)*
- [x] WeightageBar correctly shows running total *(AC3; [WeightageBar](src/components/goals/WeightageBar.tsx))*
- [x] Cannot submit if weightage ≠ 100% *(AC4a + `canSubmit()` gate)*
- [x] Cannot add more than 8 goals *(AC5, AC5b — DB trigger)*
- [x] Cannot add goal with weightage < 10% *(AC6 — DB CHECK)*
- [x] Employee can submit sheet → status changes → form locks *(AC7a, AC7b)*
- [x] Manager can log in and see team dashboard *(AC8a, AC8b)*
- [x] Manager can open and review a submitted sheet *(AC9)*
- [x] Manager can edit target and weightage inline *(AC10)*
- [x] Manager can approve → goals lock → audit log created *(AC11a, AC11b)*
- [x] Manager can return sheet → employee can edit and resubmit *(AC12)*
- [x] Admin can log in and push a shared goal to selected employees *(AC13a, AC13b)*
- [x] Employees see shared goal with locked title/target *(AC14a; UI-locked in GoalList)*
- [x] All role-based route guards work (wrong role → redirect) *(code-verified in [ProtectedRoute](src/components/layout/ProtectedRoute.tsx); needs manual browser check to confirm visually)*
- [x] Page refreshes maintain login session *(AC16 + supabase client `persistSession: true, autoRefreshToken: true`; needs manual browser refresh to confirm visually)*
