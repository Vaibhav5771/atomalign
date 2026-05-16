# AtomAlign

In-house portal for company-wide quarterly goal setting, manager approval, achievement tracking, and HR-level analytics. Built for **AtomQuest Hackathon 1.0**.

**Live demo:** https://atomalign.vercel.app
**Demo credentials:** see [`context/demo-credentials.md`](./context/demo-credentials.md)
**Architecture diagram:** see [`context/architecture.png`](./context/architecture.png)

---

## What's built

| Phase | Module | Status |
|---|---|---|
| Phase 1 | Goal creation, weightage validation, manager approval, shared goals | ✅ |
| Phase 1.5 | Admin user management (create / edit / delete with cascades) | ✅ |
| Phase 2 P1 | Quarterly check-ins with computed scores (Min / Max / Timeline / Zero) | ✅ |
| Phase 2 P2 | Reports — Achievement export (xlsx), completion dashboard, audit trail | ✅ |
| Phase 2 P3 | Analytics — QoQ trends, distribution, team completion, manager effectiveness | ✅ |

All Phase 1 and Phase 2 validation rules from the BRD are enforced (weightage = 100%, min 10%, max 8 goals, goal lock after approval, shared goal read-only title/target).

---

## Tech stack

| Layer | Choice |
|---|---|
| Frontend | React 19 + Vite 8 + TypeScript |
| UI | shadcn/ui (Radix primitives) + Tailwind 3 |
| State | Zustand |
| Forms | react-hook-form + zod |
| Charts | Recharts |
| Backend | Supabase (Postgres + Auth + Row Level Security) |
| Export | SheetJS (xlsx) |
| Hosting | Vercel |

No custom backend service — all business logic lives in Postgres (triggers, RLS, SECURITY DEFINER RPCs) and the React client.

---

## Project structure

```
src/
  components/        layout, shared, goals, manager, admin
  pages/             auth, employee, manager, admin
  stores/            authStore, goalSheetStore, managerStore,
                     reportsStore, analyticsStore
  lib/               supabase client, score functions
  types/             shared TypeScript interfaces

supabase/
  migrations/        0001 … 0006 — apply in numeric order

context/             phase plans, test plans, deployment doc,
                     problem statement, progress tracker
```

---

## Local setup

**Prereqs:** Node ≥ 20.19, npm, a Supabase project.

```bash
# 1. clone + install
git clone https://github.com/Vaibhav5771/atomalign.git
cd atomalign
npm install

# 2. configure env
cp .env.example .env
# fill in VITE_SUPABASE_URL and VITE_SUPABASE_PUBLISHABLE_KEY

# 3. apply migrations
#    Supabase Dashboard → SQL Editor → paste each file under
#    supabase/migrations/ in numeric order (0001 → 0006) → Run

# 4. seed demo users
#    Supabase Dashboard → Authentication → Users → "Add user"
#    Create employee@demo.com, manager@demo.com, admin@demo.com
#    (all password Demo@1234)
#    Then run the role/manager-linkage SQL block at the bottom
#    of 0001_phase1_schema.sql

# 5. dev server
npm run dev   # http://localhost:5173

# 6. production build
npm run build   # outputs to dist/
npm run preview # serves the built bundle
```

**Auth setting:** Supabase → Authentication → Settings → "Confirm email" **OFF** (required so admin-created users can sign in immediately).

---

## Database schema (summary)

Six migration files, applied in numeric order:

| File | What it adds |
|---|---|
| `0001_phase1_schema.sql` | Core tables (`profiles`, `goal_sheets`, `goals`, `shared_goals`, `audit_logs`), enums, `handle_new_user` trigger, full RLS policy set |
| `0002_phase1_test_fixes.sql` | `goals.shared_by` FK + `enforce_shared_goal_lock` trigger |
| `0003_admin_reopen.sql` | `goal_sheets.reopened_by` / `reopened_at` + admin update RLS |
| `0004_phase2_checkins.sql` | `check_ins` table, `goals.direction` (HIGHER/LOWER), check-in RLS |
| `0005_admin_delete_user.sql` | `admin_delete_user(uuid)` SECURITY DEFINER RPC |
| `0006_analytics_summary.sql` | `analytics_summary` view (SECURITY INVOKER) |

Row Level Security is the security boundary: employees see only their own data, managers see their reports, admins see everything. `current_role()` SQL helper reads `profiles.role`.

---

## Routes

| Route | Role |
|---|---|
| `/login` | All |
| `/employee/dashboard`, `/employee/goals`, `/employee/goals/new`, `/employee/checkins` | Employee |
| `/manager/dashboard`, `/manager/review/:sheetId`, `/manager/checkins` | Manager |
| `/admin/dashboard`, `/admin/users`, `/admin/shared-goals`, `/admin/reports`, `/admin/analytics` | Admin |

`ProtectedRoute` redirects unauthenticated users to `/login` and blocks cross-role access.

---

## Hackathon mapping

| Problem statement section | Implementation |
|---|---|
| 2.1 Phase 1 — Goal creation & approval | ✅ Employee/Manager/Admin flows, validation, shared goals |
| 2.2 Phase 2 — Achievement tracking | ✅ Quarterly check-ins, score formulas, manager comments |
| 4 — Reporting & governance | ✅ Achievement export, completion dashboard, audit trail |
| 5.4 — Analytics module (bonus) | ✅ 4 charts: QoQ trend, distribution, team completion, manager effectiveness |
| 5.1 — Microsoft Entra ID SSO (bonus) | _(deferred — see [`context/deployment.md`](./context/deployment.md))_ |
| 5.2 — Email / Teams integration (bonus) | _(not implemented)_ |
| 5.3 — Escalation module (bonus) | _(not implemented)_ |

---

## Docs

- [`context/01-phase-1.md`](./context/01-phase-1.md) — Phase 1 plan
- [`context/02-phase-2.md`](./context/02-phase-2.md) — Phase 2 plan (P1 / P2 / P3)
- [`context/progress-tracker.md`](./context/progress-tracker.md) — master status
- [`context/deployment.md`](./context/deployment.md) — deployment checklist
- [`context/6a06fcd06885a_AtomQuest_Hackathon_1.0_Problem_Statement_.docx`](./context/6a06fcd06885a_AtomQuest_Hackathon_1.0_Problem_Statement_.docx) — original problem statement
