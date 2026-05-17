# Phase 5 — Microsoft Integration Testing Walkthrough

> Covers 5.1 (Entra ID SSO + org-hierarchy sync) and 5.2 (Email + Teams notifications). Do these IN ORDER. Each step tells you exactly what to do, what you should see, and includes a tick box to mark done.

---

## Status: ⬜ Not started

---

## Before You Start

Make sure:

- You are on branch `feature/microsoft-integration`
- `npm run dev` is running at `http://localhost:5174`
- All migrations applied IN ORDER:
  - `0001_phase1_schema.sql`
  - `0002_phase1_test_fixes.sql`
  - `0003_admin_reopen.sql`
  - `0004_phase2_checkins.sql`
  - `0005_admin_delete_user.sql`
  - `0006_analytics_summary.sql`
  - `0007_microsoft_integration.sql` ← **new for Phase 5**
- The setup checklist in [context/05-microsoft-integration.md](./05-microsoft-integration.md) sections 2–6 is complete:
  - Azure App Registration created
  - Supabase Auth → Providers → Azure enabled + credentials pasted
  - `/auth/callback` added to Supabase Redirect URLs for both `localhost:5174` and `atomalign.vercel.app`
  - Edge Function `notify` deployed
  - Secrets set: `GMAIL_USER`, `GMAIL_APP_PASSWORD`, `GMAIL_FROM_NAME`, `APP_BASE_URL` (and optional `TEAMS_WEBHOOK_URL`)
  - Teams Incoming Webhook (optional) created and its URL stored as the `TEAMS_WEBHOOK_URL` secret. Skipped in our demo since the M365 Dev Program sandbox is pending — code-ready but not delivering Teams cards.

### What you need on hand

- One real Microsoft account (work, school, or personal). It does **not** need to exist as a user in your Supabase project yet — first sign-in will provision them.
- The 3 demo users (`employee@demo.com`, `manager@demo.com`, `admin@demo.com`) should still exist in Supabase Auth.

---

## SECTION 26 — Migration & Schema

---

### 26.1 — Migration 0007 added the new columns

**What to do:**

1. Open Supabase → SQL Editor
2. Run:
   ```sql
   select column_name, data_type
   from information_schema.columns
   where table_schema = 'public'
     and table_name = 'profiles'
     and column_name in ('azure_oid', 'auth_provider');
   ```

**What you should see:**

- Two rows returned: `azure_oid | text` and `auth_provider | text`
- No errors

**Mark done when:** Both columns are present.

- [ ] Pass / [ ] Fail — notes:

---

### 26.2 — handle_new_user trigger picks up Azure's `name` claim

**What to do:**

1. In Supabase SQL Editor, run:
   ```sql
   select pg_get_functiondef(oid)
   from pg_proc
   where proname = 'handle_new_user';
   ```

**What you should see:**

- Function source contains `raw_user_meta_data->>'name'` as a fallback
- Function source contains `raw_app_meta_data->>'provider'`

**Mark done when:** The patched function body is in the database.

- [ ] Pass / [ ] Fail — notes:

---

## SECTION 27 — Existing Email/Password Auth Still Works (Regression)

> **The whole point of this work is that nothing existing breaks.** Run these regressions FIRST.

---

### 27.1 — Demo employee can still sign in with password

**What to do:**

1. Open `http://localhost:5174/login` in a fresh tab (or after logging out)
2. Email: `employee@demo.com` · Password: (your demo password)
3. Click **Sign in** (the original button)

**What you should see:**

- Lands at `/employee/dashboard`
- Sidebar shows: Dashboard / My Goals / My Check-ins
- DevTools Console clean (no red errors)

**Mark done when:** Employee dashboard renders normally.

- [ ] Pass / [ ] Fail — notes:

---

### 27.2 — Demo manager can still sign in with password

**What to do:**

1. Sign out, then sign in as `manager@demo.com`

**What you should see:**

- Lands at `/manager/dashboard`
- Team table renders the employee(s) under them

**Mark done when:** Manager dashboard works.

- [ ] Pass / [ ] Fail — notes:

---

### 27.3 — Demo admin can still sign in with password

**What to do:**

1. Sign out, then sign in as `admin@demo.com`

**What you should see:**

- Lands at `/admin/dashboard`
- Sidebar shows: Dashboard / Shared Goals / Users / Reports / Analytics

**Mark done when:** Admin dashboard works.

- [ ] Pass / [ ] Fail — notes:

---

### 27.4 — Admin can still create a user via the Users page

**What to do:**

1. As admin, go to `/admin/users`
2. Create a throwaway user (e.g. `regression-test@example.com`, password `Test1234!`, role EMPLOYEE)

**What you should see:**

- Row appears in the Existing users table
- New user can log in via email/password
- `auth_provider` for this user is `email` (verify in Supabase SQL Editor: `select email, auth_provider from public.profiles where email='regression-test@example.com'`)

**Mark done when:** Admin user-creation flow is unchanged.

- [ ] Pass / [ ] Fail — notes:

---

## SECTION 28 — Microsoft Sign-In (5.1)

---

### 28.1 — Login page shows the Microsoft button

**What to do:**

1. Open `/login` in an incognito window

**What you should see:**

- Original email + password form intact
- Below it: an **or** divider
- Below the divider: a **Sign in with Microsoft** button with the 4-square MS logo

**Mark done when:** Both auth paths are visible.

- [ ] Pass / [ ] Fail — notes:

---

### 28.2 — Clicking the button redirects to Microsoft

**What to do:**

1. Click **Sign in with Microsoft**

**What you should see:**

- Browser navigates to `login.microsoftonline.com/...`
- Microsoft's sign-in screen prompts for an account
- URL contains your client ID

**Mark done when:** Microsoft sign-in screen loads.

- [ ] Pass / [ ] Fail — notes:

---

### 28.3 — First-time login provisions a profile

**What to do:**

1. Sign in with a Microsoft account that has NEVER been used on this app
2. Approve the consent prompt (one-time)

**What you should see:**

- Brief "Setting up your account…" splash on `/auth/callback`
- Then redirects to `/employee/dashboard` (default role)
- Sidebar shows employee navigation
- In Supabase SQL Editor:
  ```sql
  select email, full_name, role, department, manager_id, auth_provider, azure_oid
  from public.profiles
  where email ilike '<your-ms-email>';
  ```
  - `azure_oid` is NOT NULL
  - `auth_provider` = `azure`
  - `full_name` is the Microsoft `displayName` (not the email local-part)
  - `role` = `EMPLOYEE`

**Mark done when:** The profile row was auto-created with Graph data.

- [ ] Pass / [ ] Fail — notes:

---

### 28.4 — Department + manager are populated from Graph (when possible)

**What to do:**

1. Confirm your Microsoft account has a `department` set in Azure AD
2. Confirm your Microsoft manager's email matches an existing row in `public.profiles`
3. Sign in again with the same Microsoft account (or check the profile row from 28.3)

**What you should see:**

- `department` matches Azure AD value
- `manager_id` points to the matching profile row (verify by joining: `select p.email as me, m.email as manager from profiles p left join profiles m on m.id = p.manager_id where p.email ilike '<your-ms-email>'`)

**Pass condition (relaxed):** If Azure AD has no manager or no matching profile exists yet, `manager_id` will be `null`. That is still a PASS — admin assigns it manually from the Users page. Note "no manager in AD" in the notes box.

- [ ] Pass / [ ] Fail — notes:

---

### 28.5 — Admin can promote the new Microsoft user

**What to do:**

1. Log out
2. Sign in as `admin@demo.com`
3. Go to `/admin/users` → find your Microsoft user → Edit
4. Change role from `EMPLOYEE` to `MANAGER`, save
5. Log out, sign in via Microsoft again

**What you should see:**

- After Microsoft sign-in, lands at `/manager/dashboard`
- Sidebar shows manager navigation

**Mark done when:** Role promotion takes effect on next sign-in.

- [ ] Pass / [ ] Fail — notes:

---

### 28.6 — Returning sign-in is fast and does not duplicate the profile

**What to do:**

1. Log out and sign back in via Microsoft a second time
2. In SQL Editor: `select count(*) from public.profiles where azure_oid is not null and email ilike '<your-ms-email>';`

**What you should see:**

- Count = 1 (no duplicate row)
- "Setting up your account…" splash is brief (under ~2 seconds)
- Lands at correct role home

**Mark done when:** Repeat sign-ins are idempotent.

- [ ] Pass / [ ] Fail — notes:

---

### 28.7 — Sign-out works for Microsoft users

**What to do:**

1. While signed in via Microsoft, click the sign-out button in the sidebar/header

**What you should see:**

- Redirects to `/login`
- Refreshing the page does not silently re-authenticate
- Supabase localStorage key `sb-<project>-auth-token` is cleared (DevTools → Application → Local Storage)

**Mark done when:** Sign-out fully clears the session.

- [ ] Pass / [ ] Fail — notes:

---

## SECTION 29 — Email + Teams Notifications (5.2)

> If you skipped `GMAIL_USER` / `GMAIL_APP_PASSWORD` or `TEAMS_WEBHOOK_URL` in the function secrets, those specific channels will be skipped silently and the function returns `ok: false, reason: "no_credentials" / "no_webhook"`. Set them before running this section.

---

### 29.1 — Submit triggers email + Teams to the manager

**What to do:**

1. Sign in as `employee@demo.com`
2. Open or create a goal sheet with goals totaling 100%
3. Click **Submit**

**What you should see:**

- Toast/status confirms submission
- Within ~10 seconds: an email arrives in `manager@demo.com`'s inbox with subject `<employee name> submitted goals for your review` and an **Open goal sheet** link
- Within ~10 seconds: an Adaptive Card appears in your Teams channel — title `AtomAlign — submitted`, fact set with Employee + Cycle, button **Open goal sheet**
- Supabase Dashboard → Edge Functions → notify → Logs shows a 200 response

**Mark done when:** Both channels fire on submission.

- [ ] Pass / [ ] Fail — notes:

---

### 29.2 — Approve triggers email + Teams to the employee

**What to do:**

1. Sign in as `manager@demo.com`
2. Open the just-submitted sheet → write a remark → click **Approve**

**What you should see:**

- Email to `employee@demo.com`: subject `Your <year> goals have been approved`, body includes the manager's remark
- Teams Adaptive Card: title `AtomAlign — approved`, facts include Remark
- Logs: 200

**Mark done when:** Both channels fire on approval.

- [ ] Pass / [ ] Fail — notes:

---

### 29.3 — Return triggers email + Teams to the employee

**What to do:**

1. Reset the test: as employee, edit/resubmit a sheet. As manager, **Return** it with a remark like "needs more detail".

**What you should see:**

- Email to employee: subject `Your <year> goals need revision`, body includes remark
- Teams card: title `AtomAlign — returned`, Remark fact present
- Logs: 200

**Mark done when:** Both channels fire on return.

- [ ] Pass / [ ] Fail — notes:

---

### 29.4 — Check-in triggers email + Teams to the manager

**What to do:**

1. Sign in as employee (sheet must be APPROVED for check-ins)
2. Go to **My Check-ins** → fill Q1 actual + status → Save

**What you should see:**

- Email to manager: subject `<employee name> logged a check-in`
- Teams card: title `AtomAlign — checkin saved`, Quarter fact = `Q1`
- Logs: 200

**Mark done when:** Both channels fire on check-in save.

- [ ] Pass / [ ] Fail — notes:

---

### 29.5 — Notifications are fire-and-forget — UI never blocks

**What to do:**

1. In Supabase Dashboard, temporarily unset the secret: `supabase secrets unset TEAMS_WEBHOOK_URL` (or set it to a clearly-invalid URL like `https://example.invalid/webhook`)
2. Repeat any of 29.1–29.4

**What you should see:**

- The user-facing action still succeeds (toast, status change, etc.)
- DevTools Console shows a `[notify]` warning but **no red error** that interrupts the flow
- Email still arrives (Resend channel independent of Teams)
- Re-set `TEAMS_WEBHOOK_URL` to the real value when done

**Mark done when:** A broken Teams webhook does not break the app.

- [ ] Pass / [ ] Fail — notes:

---

### 29.6 — No recipient → function returns skipped, no crash

**What to do:**

1. In `/admin/users`, create an EMPLOYEE without selecting a manager (leave Reporting manager empty)
2. Sign in as that employee, submit a sheet

**What you should see:**

- Submit succeeds
- Edge Function logs show `skipped: true, reason: "no_recipient"` for that submission (employee with no manager = nobody to email)
- No red errors anywhere

**Mark done when:** Missing recipients degrade gracefully.

- [ ] Pass / [ ] Fail — notes:

---

## SECTION 30 — Final Smoke

---

### 30.1 — Build still passes

**What to do:**

1. Stop dev server
2. Run `npm run build`

**What you should see:**

- 0 TypeScript errors
- Vite build succeeds
- `dist/` produced

**Mark done when:** Production build is clean.

- [ ] Pass / [ ] Fail — notes:

---

### 30.2 — Live URL still works (after Vercel redeploy)

**What to do:**

1. Push branch to remote, open a PR, merge to `main`, let Vercel deploy
2. Open `https://atomalign.vercel.app/login` in an incognito window

**What you should see:**

- Microsoft sign-in button visible
- Email/password sign-in still works
- Microsoft sign-in works end-to-end on production URL (provided you added the production callback URL to both Azure App Registration AND Supabase Redirect URLs)

**Mark done when:** Both auth paths work in production.

- [ ] Pass / [ ] Fail — notes:

---

## Summary

| Section | Title | Tests | Passed |
|---|---|---|---|
| 26 | Migration & Schema | 2 | _ / 2 |
| 27 | Email/Password regression | 4 | _ / 4 |
| 28 | Microsoft sign-in | 7 | _ / 7 |
| 29 | Email + Teams notifications | 6 | _ / 6 |
| 30 | Final smoke | 2 | _ / 2 |
| **Total** | | **21** | _ / 21 |
