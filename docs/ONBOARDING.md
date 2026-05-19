# Onboarding & Email Setup — AtomAlign

A detailed walkthrough of what happens after a fresh admin login, and how the email-notification pipeline is wired so reviewers know what to expect (and forkers know how to configure it).

---

## Part 1 — Onboarding walkthrough

### Sign-in

1. Open https://atomalignv.netlify.app — the login screen appears.
2. Enter `admin@demo.com` / `Demo@1234` → **Sign in**.
3. You are redirected to `/admin/dashboard`.

### The wizard auto-opens

On the first visit per browser, the **Create Team** wizard opens automatically over the dashboard. (The "first visit" gate is a `localStorage` flag keyed per admin user UUID. After you dismiss or complete it once, it never auto-opens for that admin in that browser again. You can always re-open it manually from the "Create Team" button on `/admin/dashboard` or `/admin/users`.)

### Step 0 — Replace the demo admin with your own account

**Why:** the wizard creates a *new* admin account so notifications sent to "the admin" land in *your* inbox, not a dummy address. The seed `admin@demo.com / Demo@1234` row is preserved untouched as a permanent fallback you can always sign in with if anything goes wrong.

Fields:
- **Full name** — printed in dashboards and audit logs.
- **Email** — must be different from `admin@demo.com`. A real address you can read. The wizard rejects `admin@demo.com` as the new email (it's reserved as the fallback).
- **Password** — required, 8+ chars. Will be used for the next sign-in.

On submit:
- A new row is added to `auth.users` and `profiles` with role = `ADMIN`.
- A welcome email fires to the new address (subject: "Welcome to AtomAlign").
- Your current session is swapped in-place via `signIn()` — you're now signed in as the new admin without needing to log out/in manually.
- CTA: **"Create admin & continue"** → moves to Step 1.

> If Supabase's free instance is cold, the first request can take up to 15 seconds. The wizard surfaces a "Still working — first request can take up to 15 seconds while the demo Supabase instance wakes up. Hang tight." message after 3 s so the wait reads as intentional, not broken.

### Step 1 — Add managers

Add 1 to 5 managers in one form. Each row has:
- **Full name**
- **Email** — real address, no duplicates within the form or against existing users.
- **Password** — 8+ chars, prefilled with a strong default you can edit.
- **Department** (optional) — string label for grouping.

Validation runs live: red borders + helper text under any invalid field. The **Continue** button stays disabled until every row passes.

On **Continue**:
- All managers are created in parallel via `Promise.all`. (Round-5 latency fix — the wizard used to create them serially and time out on cold-starts.)
- Each manager gets a welcome email with their own credentials.
- Move to Step 2.

### Step 2 — Add employees

Add 1 to 20 employees. Each row has:
- **Full name**, **Email**, **Password** — same rules as managers.
- **Reports to** — dropdown of managers (from Step 1 + any pre-existing managers in the workspace).
- **Department** — auto-fills from the chosen manager's `department` (you can still type to override). Empty values from manager don't overwrite anything you've typed.

On **Continue**:
- Employees created in parallel via `Promise.all`.
- Each employee gets a welcome email.
- Move to Step 3.

### Step 3 — Summary

The full team tree is rendered with the new admin at the root, managers below, employees nested under their assigned managers. Animated connecting beams (`AnimatedBeam` from Magic UI) trace the hierarchy.

Below the tree, a credentials table lists every account just created — full name, email, password, role. A **Copy credentials** button writes the table to your clipboard as Markdown so you can paste it anywhere (sticky note, terminal, password manager).

Click **Finish** → wizard closes, you're back on `/admin/dashboard` with charts now showing real data (number of managers, employees, sheets, etc.).

### What you can do next

- Sign out via the avatar dropdown (top right) → sign back in as any of the new users.
- Sign in as an employee → `/employee/goals/new` → create a goal sheet.
- Sign in as a manager → `/manager/dashboard` → review and approve a submission.
- Sign back in as `admin@demo.com / Demo@1234` any time — it's untouched and remains an admin.

### Re-opening the wizard later

You can re-open the wizard at any time from:
- `/admin/dashboard` → **Create Team** button (shown when no team has been built yet, or **View Team** if it has).
- `/admin/users` → **Create Team** button (always visible).

On `/admin/users`, the wizard skips Step 0 (you're already a real admin); it starts at Step 1 so you can just add more managers/employees on top of an existing team.

---

## Part 2 — Email setup

### What fires automatically (what reviewers will see)

The deployed instance has email enabled. Six event types route through a single `notify` Supabase Edge Function:

| Event | When it fires | Who gets emailed | Subject |
|---|---|---|---|
| `user_created` | Admin creates a manager / employee via the wizard or single-user form | The newly created user | "Welcome to AtomAlign" |
| `submitted` | Employee submits a goal sheet for approval | The employee's manager | "Goal sheet submitted — review" |
| `approved` | Manager approves a sheet | The employee whose sheet was approved | "Your goal sheet was approved" |
| `returned` | Manager returns a sheet for rework | The employee whose sheet was returned | "Goal sheet returned for rework" |
| `checkin_saved` | Employee saves a quarterly check-in | The employee's manager | "Check-in submitted — review" |
| `escalation` | `evaluate-escalations` cron finds a rule match | Configurable: employee / manager / HR depending on rule | Rule-specific |

All six payloads also build a Microsoft Teams adaptive card. The Teams arm only sends if the `TEAMS_WEBHOOK_URL` secret is set on the Edge Function (deferred — no M365 sandbox in the demo).

### What evaluators should know

- **Emails come from a Gmail account via Gmail SMTP** (`denomailer` running inside the Deno Edge Function). Free quota: ~500 emails / day, which is more than enough for evaluation traffic.
- **First email may land in Spam** — Gmail's reputation rules treat new senders that way until the recipient marks one as Not Spam. Whitelist the sender once and subsequent emails arrive in Inbox.
- **Deliverability is fire-and-forget.** The app does not block the UI on email send. If an email fails to deliver (invalid address, SMTP quota exhausted), the user action still succeeds. Errors are logged in the Edge Function logs only.
- **Escalation reminders run once per day** via Supabase cron, not on a user action. Triggers: `SUBMIT_OVERDUE`, `APPROVE_OVERDUE`, `CHECKIN_OVERDUE`. Admin configures threshold-days + escalation chain (employee → manager → HR) via `/admin/escalations`. A unique-per-day index guarantees idempotency — no spam if the function runs twice.
- **Deep links in emails** point at `https://atomalignv.netlify.app/...` so clicking goes straight to the relevant page.

### Configuring email yourself (forkers / re-deployers)

The Supabase Edge Function `notify` lives in `supabase/functions/notify/`. To deploy it pointing at your own Gmail account:

1. **Create a Gmail App Password** at https://myaccount.google.com/apppasswords. (Requires 2FA enabled on the Gmail account.) Copy the 16-character app password.

2. **Set Edge Function secrets** in your Supabase project:

   ```bash
   supabase secrets set GMAIL_USER=youraccount@gmail.com
   supabase secrets set GMAIL_APP_PASSWORD=xxxxxxxxxxxxxxxx
   supabase secrets set APP_BASE_URL=https://atomalignv.netlify.app
   # optional — only if you want Teams adaptive cards too
   supabase secrets set TEAMS_WEBHOOK_URL=https://outlook.office.com/webhook/...
   ```

3. **Deploy** both functions:

   ```bash
   supabase functions deploy notify
   supabase functions deploy evaluate-escalations
   ```

4. **Schedule the daily escalation evaluator.** In Supabase Dashboard → Database → Cron:

   ```sql
   select cron.schedule(
     'evaluate-escalations-daily',
     '0 9 * * *',   -- every day at 09:00 UTC
     $$ select net.http_post(
          url:='https://YOUR_PROJECT.functions.supabase.co/evaluate-escalations',
          headers:=jsonb_build_object(
            'Authorization', 'Bearer ' || current_setting('app.service_role_key'),
            'Content-Type',  'application/json'
          )
       ); $$
   );
   ```

   (Adjust the URL to your project's functions hostname. The service-role key is needed because the Edge Function reads `escalation_rules` and writes `escalations` rows that bypass RLS.)

5. **Smoke-test** by creating a user via `/admin/users` and confirming the welcome email lands in your inbox within ~15 seconds.

### Where to look if something doesn't arrive

- **Edge Function logs:** Supabase Dashboard → Edge Functions → `notify` → Logs. Look for `Sent ok` or any `denomailer` errors.
- **Gmail quota:** Gmail SMTP caps at ~500 emails / 24 h per account. If you've smoke-tested a lot, you may need to wait or swap to a different Gmail.
- **Recipient inbox:** check Spam first. Then check if the address is correct (the wizard validates format, but typos still slip past).
- **App.base_url:** if deep-links in emails point at the wrong domain, the `APP_BASE_URL` secret is wrong — re-set it and re-deploy `notify`.

### Email pipeline at a glance

```
User action (submit / approve / return / check-in / user_created)
    └─> Supabase Postgres write (RLS-checked)
        └─> Client fires `notify(event, payload)` (fire-and-forget POST)
            └─> Edge Function `notify` (Deno)
                ├─> Gmail SMTP via denomailer ──> recipient inbox
                └─> Teams webhook (if TEAMS_WEBHOOK_URL set) ──> Teams channel
```

The cron-driven escalation flow is identical except the trigger is `evaluate-escalations` walking `goal_sheets` / `check_ins` once a day and calling `notify({event: 'escalation', ...})` for each rule match.

---

## Related docs

- [`context/demo-credentials.md`](../context/demo-credentials.md) — short credentials reference
- [`context/progress-tracker.md`](../context/progress-tracker.md) — Phase 5.2 + 5.3 build logs
- [`supabase/functions/notify/`](../supabase/functions/notify/) — Edge Function source
- [`supabase/functions/evaluate-escalations/`](../supabase/functions/evaluate-escalations/) — daily cron Edge Function source
- [`supabase/migrations/0008_escalations.sql`](../supabase/migrations/0008_escalations.sql) — escalation rules schema + 5 seed rules
