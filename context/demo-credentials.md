# Demo Credentials — AtomAlign

**Live demo URL:** https://atomalign.vercel.app

## Recommended for judges — create your own team

For the cleanest demo experience, log in as the admin and spin up your own isolated mini-org via the **Create Team** wizard. This avoids collisions with other reviewers on the shared demo database and gives you real users (with real emails, if you want notifications) to drive the rest of the journey.

1. Sign in at `/login` as `admin@demo.com` / `Demo@1234`.
2. The wizard auto-opens on `/admin/dashboard` the first time you land. (After dismissing it once, it won't re-open — use the **Create Team** button at the top-right of `/admin/dashboard` or `/admin/users` to bring it back any time.)
3. **Step 0** — replace `admin@demo.com` with your own email + a real password so *you* also receive goal-event notifications.
4. **Step 1** — add 1–5 managers. Use real email addresses if you want the welcome email + downstream goal notifications to actually land in an inbox you can read.
5. **Step 2** — add 1–20 employees, each assigned to one of the managers from Step 1 (or any pre-existing manager).
6. **Step 3** — copy the credentials table to your clipboard and sign in as any of the new users to walk the Employee / Manager / Admin journeys end-to-end.

Welcome emails are sent automatically per wizard-created user, and all four goal-lifecycle events (submitted / approved / returned / check-in saved) fire emails to the appropriate manager or employee. Time-based check-in reminders are delivered via Phase 5.3 (`/admin/escalations` → `CHECKIN_OVERDUE` rule) — admin configures threshold-days and the same `notify` pipeline ships the email.

## Pre-seeded demo accounts (fallback)

If you don't want to use the wizard, the three pre-seeded shared accounts below still work:

| Role | Email | Password | Notes |
|---|---|---|---|
| Employee | `employee@demo.com` | `Demo@1234` | Reports to `manager@demo.com` |
| Manager (L1) | `manager@demo.com` | `Demo@1234` | One direct report (employee above) |
| Admin / HR | `admin@demo.com` | `Demo@1234` | Full access — user mgmt, shared goals, reports, analytics |

Multiple reviewers using these shared accounts simultaneously will see each other's edits on the same DB rows. Prefer the wizard path above when in doubt.

## Microsoft sign-in

The **Sign in with Microsoft** button on the login page works only for emails that have been pre-registered by an admin via the Create Team wizard (or the Users-page single-user form). Anyone else who attempts MS sign-in is rejected by the `handle_new_user` trigger with a "Microsoft sign-in is restricted…" message. This closes the loop on the bonus 5.1 feature — every Microsoft user is a known user.

Side-effect to be aware of: a wizard-created user who later signs in with Microsoft using the same email will get a *second* profile row (Supabase doesn't auto-merge identities). The MS profile inherits role/manager data via the existing Graph sync, so the user lands in the app correctly; admin can delete the dormant email-provider row via `/admin/users` if it bothers them.

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
