# Phase 5.3 — Rule-Based Escalation Testing Walkthrough

> Covers BRD §5.3 — admin-configurable escalation rules, evaluator function, log + Run-now UI, deduped daily fires, and email delivery via the existing `notify` flow. Continues section numbering from [05-microsoft-integration-test.md](./05-microsoft-integration-test.md) (which ended at Section 30).
>
> Do these IN ORDER. Each step tells you exactly what to do, what you should see, and includes a tick box to mark done.

---

## Status: ⬜ Not started

---

## Before You Start

Make sure:

- You are on branch `feature/microsoft-integration`
- Phase 5.1 + 5.2 tests already passed (see [05-microsoft-integration-test.md](./05-microsoft-integration-test.md))
- All migrations applied IN ORDER:
  - `0001_phase1_schema.sql` … `0007_microsoft_integration.sql`
  - `0008_escalations.sql` ← **new for 5.3**
- Edge Functions deployed:
  - `supabase functions deploy notify` (extended with `escalation` event + `recipient_id` override)
  - `supabase functions deploy evaluate-escalations` (new)
- All required secrets set: `GMAIL_USER`, `GMAIL_APP_PASSWORD`, `GMAIL_FROM_NAME`, `APP_BASE_URL`
- `npm run dev` is running at `http://localhost:5174`
- The manager's `profiles.email` is set to a real inbox you can monitor (`vaibhavpardeshi190@gmail.com` in our demo) — escalations addressed to fake `@demo.com` addresses bounce silently

---

## SECTION 31 — Migration & Schema

---

### 31.1 — Migration 0008 created both tables

**What to do:**

1. Supabase → SQL Editor
2. Run:
   ```sql
   select table_name
   from information_schema.tables
   where table_schema = 'public'
     and table_name in ('escalation_rules', 'escalations');
   ```

**What you should see:**

- Two rows: `escalation_rules` and `escalations`

**Mark done when:** Both tables exist.

- [ ] Pass / [ ] Fail — notes:

---

### 31.2 — Enums created

**What to do:**

```sql
select typname
from pg_type
where typname in ('trigger_type', 'escalate_target');
```

**What you should see:**

- Two rows: `trigger_type` and `escalate_target`

**Mark done when:** Both enums exist.

- [ ] Pass / [ ] Fail — notes:

---

### 31.3 — Seed rules loaded (5 rows)

**What to do:**

```sql
select name, trigger_type, threshold_days, escalate_to, is_active
from public.escalation_rules
order by trigger_type, threshold_days;
```

**What you should see:**

- 5 rows
- Includes a 3-step chain for `SUBMIT_OVERDUE`: thresholds 7 / 14 / 21 days targeting `EMPLOYEE` / `MANAGER` / `HR`
- Plus `APPROVE_OVERDUE` (5d → MANAGER) and `CHECKIN_OVERDUE` (14d → EMPLOYEE)
- All `is_active = true`

**Mark done when:** All 5 seed rules present and active.

- [ ] Pass / [ ] Fail — notes:

---

### 31.4 — Dedupe unique index in place

**What to do:**

```sql
select indexname, indexdef
from pg_indexes
where tablename = 'escalations'
  and indexname = 'escalations_dedupe_idx';
```

**What you should see:**

- One row whose `indexdef` includes `UNIQUE` and the columns `(rule_id, subject_user_id, fire_date)`

**Mark done when:** Index exists.

- [ ] Pass / [ ] Fail — notes:

---

## SECTION 32 — Routing, RLS & Permissions

---

### 32.1 — Admin sees "Escalations" sidebar link

**What to do:**

1. Log in as `admin@demo.com`
2. Look at the sidebar

**What you should see:**

- New **Escalations** item below "Analytics", with the `AlertTriangle` icon
- Hover effect works

**Mark done when:** Link appears in admin nav.

- [ ] Pass / [ ] Fail — notes:

---

### 32.2 — Employee + Manager do NOT see the Escalations link

**What to do:**

1. Sign out, sign in as `employee@demo.com` → check sidebar
2. Sign out, sign in as `manager@demo.com` → check sidebar

**What you should see:**

- Neither role's sidebar contains "Escalations" (it's ADMIN-only)

**Mark done when:** Confirmed.

- [ ] Pass / [ ] Fail — notes:

---

### 32.3 — Non-admin direct URL access is blocked

**What to do:**

1. While signed in as `employee@demo.com`, manually navigate to `http://localhost:5174/admin/escalations`

**What you should see:**

- Redirected away (to `/employee/dashboard` or `/login`); page does not render

**Mark done when:** Route guard works.

- [ ] Pass / [ ] Fail — notes:

---

### 32.4 — RLS: employee can SELECT only their own escalations

**What to do:**

1. In Supabase Dashboard, switch to **SQL Editor** in user context (or use the JS client signed in as employee)
2. Run: `select count(*) from public.escalations;`

**What you should see:**

- Either 0 (no fires yet) or only rows where `subject_user_id` = the employee's id
- Never sees other employees' escalations

**Mark done when:** RLS verified.

- [ ] Pass / [ ] Fail — notes:

---

## SECTION 33 — Rules Tab (CRUD)

---

### 33.1 — Rules tab lists the 5 seed rules

**What to do:**

1. As admin, open `/admin/escalations`
2. Default tab is "Rules"

**What you should see:**

- 5 rows in the table
- Each row shows: name, trigger badge, threshold days, escalate-to badge (colour-coded by target), active toggle, edit + delete buttons
- "Rules (5)" appears in the tab label

**Mark done when:** Rules table renders correctly.

- [ ] Pass / [ ] Fail — notes:

---

### 33.2 — Add a new rule

**What to do:**

1. Click **+ Add rule**
2. Fill: name = "Test rule QA", trigger = "Check-in overdue", threshold = 30, escalate_to = "Skip-level", active = ON
3. Click **Create rule**

**What you should see:**

- Toast: "Rule created"
- Table now shows 6 rows; new rule visible at the bottom
- DB confirms: `select count(*) from public.escalation_rules` returns 6

**Mark done when:** Rule created.

- [ ] Pass / [ ] Fail — notes:

---

### 33.3 — Edit a rule

**What to do:**

1. Click the pencil icon on "Test rule QA"
2. Change threshold to 45, click Save changes

**What you should see:**

- Toast: "Rule updated"
- Threshold column now shows "45 days"

**Mark done when:** Edit persisted.

- [ ] Pass / [ ] Fail — notes:

---

### 33.4 — Toggle a rule active/inactive inline

**What to do:**

1. Click the **active switch** on "Test rule QA" to turn it OFF

**What you should see:**

- Switch slides to the off position
- `select is_active from public.escalation_rules where name = 'Test rule QA'` returns `false`

**Mark done when:** Toggle works without page reload.

- [ ] Pass / [ ] Fail — notes:

---

### 33.5 — Delete a rule (with confirm dialog)

**What to do:**

1. Click the trash icon on "Test rule QA"
2. Confirm dialog appears
3. Click **Delete rule**

**What you should see:**

- Toast: "Rule deleted"
- Row disappears; table is back to 5 rows
- Past escalations (if any) referencing this rule keep their `rule_id` set to NULL (foreign key uses ON DELETE SET NULL)

**Mark done when:** Delete + cascade-to-null works.

- [ ] Pass / [ ] Fail — notes:

---

## SECTION 34 — Run Now + Notification Delivery

---

### 34.1 — Run with no overdue data → fired = 0

**What to do:**

1. First, clear today's escalations to start fresh:
   ```sql
   delete from public.escalations where fire_date = current_date;
   ```
2. Reset sheet timestamps to "fresh" (no overdue):
   ```sql
   update public.goal_sheets set created_at = now(), submitted_at = now(), approved_at = now();
   ```
3. In `/admin/escalations`, click **Run escalations now**

**What you should see:**

- Toast: "Escalations evaluated — 0 fired · 0 skipped · 5 rules checked"
- Log tab still shows the empty-state placeholder

**Mark done when:** Empty result handled gracefully.

- [ ] Pass / [ ] Fail — notes:

---

### 34.2 — Backdate a draft sheet → SUBMIT_OVERDUE fires

**What to do:**

1. Force-create an overdue scenario:
   ```sql
   update public.goal_sheets
   set created_at = now() - interval '25 days'
   where status in ('DRAFT', 'RETURNED');
   ```
2. Clear today's log:
   ```sql
   delete from public.escalations where fire_date = current_date;
   ```
3. Click **Run escalations now**

**What you should see:**

- Toast: `fired: 3 · skipped: 0 · 5 rules checked` (all 3 SUBMIT_OVERDUE rules — 7/14/21 day thresholds — fire because 25 > 21)
- Log tab auto-switches to show the new rows

**Mark done when:** L1, L2, L3 SUBMIT_OVERDUE all fired.

- [ ] Pass / [ ] Fail — notes:

---

### 34.3 — Email arrives at recipient gmail (via Gmail SMTP)

**What to do:**

1. Check `vaibhavpardeshi190@gmail.com` inbox

**What you should see:**

- At least one email titled **"Escalation: action required regarding ..."** within ~30 seconds
- From: `AtomAlign Notifications <vaibhavpardeshi190@gmail.com>`
- Body includes: subject person's name + email, the reason text, an "Open goal sheet" button
- Edge Function logs (Supabase Dashboard → `notify`) show `200` response with `email: { ok: true }`

**Mark done when:** At least one escalation email delivered.

- [ ] Pass / [ ] Fail — notes:

> Note: Only escalations whose recipient has a real email address (in `profiles.email`) deliver. Demo users still using `@demo.com` profile emails will bounce silently. Update profiles to real emails if you want every fire to land in an inbox: `update profiles set email = 'vaibhavpardeshi190@gmail.com' where email like '%@demo.com';` (auth.users untouched — logins still work).

---

### 34.4 — Dedupe blocks same-day re-runs

**What to do:**

1. Without changing any data, click **Run escalations now** again immediately

**What you should see:**

- Toast: `fired: 0 · skipped: 3 · 5 rules checked`
- No new rows added to the log
- Function logs show no new `notify` invocations (skipped at insert time via the unique index)

**Mark done when:** Idempotency verified.

- [ ] Pass / [ ] Fail — notes:

---

### 34.5 — APPROVE_OVERDUE fires when a SUBMITTED sheet ages

**What to do:**

1. Get a sheet into SUBMITTED state (employee submits) — or fake it:
   ```sql
   update public.goal_sheets
   set status = 'SUBMITTED', submitted_at = now() - interval '10 days'
   where status = 'APPROVED'
   limit 1;
   ```
2. Clear today's log: `delete from public.escalations where fire_date = current_date;`
3. Run escalations now

**What you should see:**

- `fired: ≥1` with at least one row whose `trigger_type` = `APPROVE_OVERDUE`
- Manager (recipient) receives an email

**Mark done when:** Approve-overdue path verified.

- [ ] Pass / [ ] Fail — notes:

---

### 34.6 — CHECKIN_OVERDUE fires when goals lack check-ins

**What to do:**

1. Backdate an APPROVED sheet so it's older than 14 days AND make sure at least one of its goals has no check-ins:
   ```sql
   update public.goal_sheets
   set approved_at = now() - interval '20 days', status = 'APPROVED'
   where id = (select id from public.goal_sheets where status = 'APPROVED' limit 1);

   -- Remove check-ins for at least one goal on that sheet
   delete from public.check_ins
   where goal_id in (
     select id from public.goals
     where sheet_id = (select id from public.goal_sheets where status = 'APPROVED' limit 1)
     limit 1
   );
   ```
2. Clear today's log + run again

**What you should see:**

- A new row with `trigger_type` = `CHECKIN_OVERDUE`
- Employee (recipient) receives an email

**Mark done when:** Check-in-overdue path verified.

- [ ] Pass / [ ] Fail — notes:

---

### 34.7 — JWT verification still enabled (security check)

**What to do:**

1. Try invoking the function without auth:
   ```bash
   curl -X POST 'https://<your-ref>.supabase.co/functions/v1/evaluate-escalations' \
     -H "Content-Type: application/json" -d '{}'
   ```

**What you should see:**

- HTTP 401 Unauthorized response
- Same applies to direct curl against `/functions/v1/notify` without auth header

**Mark done when:** Both functions require a valid JWT.

- [ ] Pass / [ ] Fail — notes:

---

## SECTION 35 — Log Tab + Resolution

---

### 35.1 — Log shows fired escalations newest-first

**What to do:**

1. Open the Log tab in `/admin/escalations`

**What you should see:**

- All non-resolved escalations from the previous tests, newest at the top
- Each row shows: fired timestamp, subject name + email, trigger badge, recipient name, reason text, "Resolve" button
- Resolved rows (if any) appear faded (`opacity-60`) with a green "Resolved" badge instead of the button

**Mark done when:** Log renders correctly.

- [ ] Pass / [ ] Fail — notes:

---

### 35.2 — Resolve an escalation

**What to do:**

1. Click **Resolve** on any active row

**What you should see:**

- Toast: "Marked resolved"
- That row's button is replaced with a green "Resolved" badge
- Row visually fades
- `select resolved_at from public.escalations where id = '<id>'` shows a non-null timestamp

**Mark done when:** Resolution persists.

- [ ] Pass / [ ] Fail — notes:

---

### 35.3 — Resolved rows are NOT re-escalated by next day's cron

**What to do (conceptual — no real waiting required):**

1. Inspect the dedupe index — `(rule_id, subject_user_id, fire_date)`. A resolved row keeps `fire_date = today`, so today's re-runs are blocked anyway. **Tomorrow's run** would create a NEW row (different `fire_date`) if the underlying overdue condition still holds — that's intentional ("re-remind daily until fixed"). Confirm by reading the index definition:
   ```sql
   select indexdef from pg_indexes where indexname = 'escalations_dedupe_idx';
   ```

**What you should see:**

- Index includes `fire_date` (per-day dedupe), not `resolved_at` (does not consider resolution state)
- Behavioural meaning: resolving silences today's noise; the next cron tick re-checks reality

**Mark done when:** Behaviour understood and documented for the demo.

- [ ] Pass / [ ] Fail — notes:

---

## SECTION 36 — Regression sweep (existing features still work)

---

### 36.1 — Goal submission still notifies the manager

**What to do:**

1. Sign in as employee, submit a fresh goal sheet
2. Check manager's gmail

**What you should see:**

- Email titled "<employee> submitted goals for your review"
- This proves the `notify` function still works for non-escalation events after our payload changes (`sheet_id` made optional, `recipient_id` added)

**Mark done when:** Submission email arrives.

- [ ] Pass / [ ] Fail — notes:

---

### 36.2 — Type-check + build clean

**What to do:**

```bash
cd ~/atomalign
nvm use 20.20.2
npx tsc -b
npm run build
```

**What you should see:**

- 0 TypeScript errors
- Vite build succeeds, `dist/` produced

**Mark done when:** Build is clean.

- [ ] Pass / [ ] Fail — notes:

---

### 36.3 — Phase 5.1 SSO regression

**What to do:**

1. Sign in via Microsoft on `/login`

**What you should see:**

- Same as test 28.3 (lands on dashboard, profile created if first-time, no errors)
- The notify-payload changes didn't break the auth callback path

**Mark done when:** MS sign-in still works.

- [ ] Pass / [ ] Fail — notes:

---

## Summary

| Section | Title | Tests | Passed |
|---|---|---|---|
| 31 | Migration & Schema | 4 | _ / 4 |
| 32 | Routing, RLS & Permissions | 4 | _ / 4 |
| 33 | Rules tab (CRUD) | 5 | _ / 5 |
| 34 | Run Now + Notification Delivery | 7 | _ / 7 |
| 35 | Log tab + Resolution | 3 | _ / 3 |
| 36 | Regression sweep | 3 | _ / 3 |
| **Total** | | **26** | _ / 26 |
