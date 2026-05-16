# Demo Credentials — AtomAlign

**Live demo URL:** https://atomalign.vercel.app

These accounts are pre-seeded in the Supabase project backing the live demo. All passwords are the same so judges can switch roles quickly.

| Role | Email | Password | Notes |
|---|---|---|---|
| Employee | `employee@demo.com` | `Demo@1234` | Reports to `manager@demo.com` |
| Manager (L1) | `manager@demo.com` | `Demo@1234` | One direct report (employee above) |
| Admin / HR | `admin@demo.com` | `Demo@1234` | Full access — user mgmt, shared goals, reports, analytics |

---

## How to switch roles during demo

1. Click your name (top right of any authenticated page) → **Sign out**
2. Sign in with another role's credentials
3. App auto-redirects to the role-specific dashboard

Session persists across hard refresh (Supabase token in `localStorage`), so refreshing the page does not log you out.

---

## What each role can see

**Employee** — `/employee/dashboard`
- Create / edit own goal sheet (DRAFT or RETURNED status only)
- Submit for manager approval
- Q1-Q4 check-ins on approved goals
- Cannot see other employees' data

**Manager** — `/manager/dashboard`
- See submissions from direct reports
- Inline edit target / weightage during review
- Approve (locks the sheet) or Return (back to DRAFT)
- Add check-in comments on team's quarterly actuals

**Admin** — `/admin/dashboard`
- User management (`/admin/users`)
- Push shared goals to multiple employees (`/admin/shared-goals`)
- Reports — achievement export, completion dashboard, audit trail (`/admin/reports`)
- Analytics — QoQ trends, distribution, team completion, manager effectiveness (`/admin/analytics`)
- Can reopen approved sheets

---

## A quick happy-path walk-through (~5 min)

Run this sequence to exercise all three roles end-to-end:

1. **Employee** logs in → `/employee/goals/new` → add 2 goals (e.g. weightage 60/40) → Submit
2. **Manager** logs in → opens the submission → tweaks one target inline → **Approve**
3. **Employee** logs back in → opens `/employee/checkins` → logs a Q1 actual on one of the now-locked goals
4. **Manager** opens `/manager/checkins` → reads the Q1 actual → adds a comment
5. **Admin** logs in → `/admin/analytics` → see the goal appear in the charts; `/admin/reports` → export the Achievement xlsx; `/admin/users` → confirm user mgmt works

---

## Behind the scenes

- Auth: Supabase email/password — "Confirm email" is **OFF** in Supabase Auth Settings so admin-created users can log in immediately.
- Data isolation: Postgres Row Level Security — `auth.uid()` + `profiles.role` enforced server-side.
- Demo project is a single Supabase free-tier project; same migrations as in [`supabase/migrations/`](../supabase/migrations/) are applied.
