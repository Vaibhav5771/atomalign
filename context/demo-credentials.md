# Demo Credentials — AtomAlign

**Live demo URL:** https://atomalignv.netlify.app

## The one credential you need

| Role | Email | Password |
|---|---|---|
| Admin / HR | `admin@demo.com` | `Demo@1234` |

That is the only pre-seeded account. Manager and Employee logins are created **by you** through the onboarding wizard described below — using real email addresses so welcome emails and goal-event notifications actually land in inboxes you can read.

## First-run walkthrough (~2 min setup)

1. Sign in at `/login` as `admin@demo.com` / `Demo@1234`.
2. The **Create Team** wizard auto-opens on `/admin/dashboard` the first time you land. (After you dismiss it once, re-open via the **Create Team** button on `/admin/dashboard` or `/admin/users`.)
3. **Step 0 — Personal admin** — replace `admin@demo.com` with your own email + a real password. This creates a *new* admin account and signs you in as that user; `admin@demo.com / Demo@1234` is preserved untouched as a permanent fallback. You'll receive a welcome email at the new address.
4. **Step 1 — Managers** — add 1–5 managers with real email addresses.
5. **Step 2 — Employees** — add 1–20 employees, each assigned to one of the managers from Step 1.
6. **Step 3 — Summary** — confirm the team tree, then copy the credentials table to your clipboard. Sign in as any of those new users to walk the Employee / Manager / Admin journeys end-to-end.

Welcome emails are sent automatically per wizard-created user. All four goal-lifecycle events (submitted / approved / returned / check-in saved) fire emails to the appropriate manager or employee. Time-based check-in reminders are delivered via the escalation module (`/admin/escalations` → `CHECKIN_OVERDUE` rule) — admin sets the threshold-days, the same `notify` pipeline ships the email.

> **Plus-addressing tip for repeated runs:** use Gmail plus-aliases (`you+admin1@gmail.com`, `you+mgr1@gmail.com`, …) so the same inbox receives every welcome email but Supabase treats each as a distinct user. Avoids "already registered" collisions between runs.

## Falling back to `admin@demo.com`

If you ever need to start over (e.g. you forget the password of the personal admin you just created), sign back in as `admin@demo.com / Demo@1234`. That row is never modified by the wizard, so it's always available. From there you can manage the personal admin user via `/admin/users` or just re-run the wizard.

## Microsoft sign-in

The **Sign in with Microsoft** button on the login page works only for emails that have been pre-registered by an admin (via the Create Team wizard or the single-user form on `/admin/users`). Any other MS account is rejected by the `handle_new_user` trigger with a "Microsoft sign-in is restricted…" message — every Microsoft user is a known user.

Side-effect to be aware of: a wizard-created user who later signs in with Microsoft using the same email gets a *second* profile row (Supabase doesn't auto-merge identities). The MS profile inherits role/manager data via the Graph sync, so the user lands in the app correctly; admin can delete the dormant email-provider row via `/admin/users` if it bothers them.

---

## How to switch roles during demo

1. Click your avatar (top right of any authenticated page) → **Sign out**
2. Sign in with another role's credentials (or `admin@demo.com` to land back on admin)
3. App auto-redirects to the role-specific dashboard

Session persists across hard refresh (Supabase token in `localStorage`), so refreshing the page does not log you out.

---

## What each role can see

**Employee** — `/employee/dashboard`
- Create / edit own goal sheet (DRAFT or RETURNED status only)
- Submit for manager approval
- Q1–Q4 check-ins on approved goals
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
- Escalation rules (`/admin/escalations`)
- Can reopen approved sheets

---

## A quick happy-path walk-through (~5 min after wizard setup)

1. **Employee** logs in → `/employee/goals/new` → add 2 goals (e.g. weightage 60/40) → Submit
2. **Manager** logs in → opens the submission → tweaks one target inline → **Approve**
3. **Employee** logs back in → opens `/employee/checkins` → logs a Q1 actual on one of the now-locked goals
4. **Manager** opens `/manager/checkins` → reads the Q1 actual → adds a comment
5. **Admin** logs in → `/admin/analytics` → see the goal appear in the charts; `/admin/reports` → export the Achievement xlsx; `/admin/users` → confirm user mgmt works

---

## Behind the scenes

- **Auth**: Supabase email/password + Microsoft Entra ID SSO. "Confirm email" is **OFF** so admin-created users can log in immediately.
- **Data isolation**: Postgres Row Level Security — `auth.uid()` + `profiles.role` enforced server-side.
- **Hosting**: Netlify (static SPA, CDN edge) + Supabase free tier (Postgres, Auth, Edge Functions).
- **Migrations**: see [`supabase/migrations/`](../supabase/migrations/) — all 12 applied on the demo project.
