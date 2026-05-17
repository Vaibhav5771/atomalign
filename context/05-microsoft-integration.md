# Phase 5 — Microsoft Integration (Bonus)

Covers BRD section 5.1 (Entra ID SSO + org hierarchy) and 5.2 (Email + Teams notifications). Built on top of the existing Supabase Auth setup; **email/password login for the 3 demo users is unchanged**.

---

## What's in this branch

- `supabase/migrations/0007_microsoft_integration.sql` — adds `profiles.azure_oid` + `profiles.auth_provider`; patches `handle_new_user` to accept Azure's `name` claim as a fallback for `full_name`.
- `src/lib/graph.ts` — Microsoft Graph `/me` client that maps `displayName` / `mail` / `manager.mail` / `department` onto our `profiles` row.
- `src/stores/authStore.ts` — new `signInWithMicrosoft()` action; the existing `onAuthStateChange` listener now detects Azure sign-ins and runs the Graph sync before resolving the user.
- `src/pages/auth/LoginPage.tsx` — adds a "Sign in with Microsoft" button **below** the existing email/password form.
- `src/pages/auth/AuthCallbackPage.tsx` — landing page at `/auth/callback`; waits for the Graph sync to finish, then redirects to role home.
- `supabase/functions/notify/index.ts` — Edge Function that sends a Resend email + an Adaptive Card to a Teams webhook on goal lifecycle events.
- `src/lib/notify.ts` — fire-and-forget client wrapper around the Edge Function. Failures log to console; **they never block the user's primary action**.
- 4 trigger points wired in stores: `submitSheet`, `approveSheet`, `returnSheet`, `saveCheckIn`.

---

## Setup checklist

### 1. Apply the migration

Supabase Dashboard → SQL Editor → paste `0007_microsoft_integration.sql` → Run.

Verify with:
```sql
select column_name from information_schema.columns
where table_schema='public' and table_name='profiles'
  and column_name in ('azure_oid','auth_provider');
```

### 2. Azure App Registration

1. Azure Portal → Microsoft Entra ID → **App registrations** → New registration.
2. Name: `AtomAlign`. Supported account types: **Accounts in any organizational directory and personal Microsoft accounts** (easiest for demo).
3. Redirect URI (Web): copy from **Supabase Dashboard → Authentication → Providers → Azure** (looks like `https://<project>.supabase.co/auth/v1/callback`).
4. After creating: copy the **Application (client) ID**. Then Certificates & secrets → New client secret → copy the **Value**.
5. API permissions → already includes `User.Read` (delegated). No admin consent needed.
6. Authentication → tick **ID tokens** under Implicit grant.

### 3. Supabase provider config

Authentication → Providers → Azure → enable, paste:
- **Azure Tenant URL**: `https://login.microsoftonline.com/common` (multi-tenant) or your tenant id
- **Application (client) ID** + **Application (client) Secret** from step 2

Authentication → URL Configuration → add to **Redirect URLs**:
- `http://localhost:5174/auth/callback`
- `https://atomalign.vercel.app/auth/callback`

### 4. Edge Function deploy

```bash
# from repo root
supabase login                                  # one-time
supabase link --project-ref <your-ref>          # one-time
supabase functions deploy notify

supabase secrets set GMAIL_USER=you@gmail.com
supabase secrets set GMAIL_APP_PASSWORD=xxxxxxxxxxxxxxxx
supabase secrets set GMAIL_FROM_NAME='AtomAlign Notifications'
supabase secrets set TEAMS_WEBHOOK_URL='https://...office.com/webhookb2/...'   # optional
supabase secrets set APP_BASE_URL=https://atomalign.vercel.app
```

`SUPABASE_URL` and `SUPABASE_SERVICE_ROLE_KEY` are injected by Supabase automatically — do not set them manually.

The function uses **Gmail SMTP** via [denomailer](https://deno.land/x/denomailer), so emails come from your Gmail address with the display name set by `GMAIL_FROM_NAME`. Generate an **App Password** at <https://myaccount.google.com/apppasswords> — this requires 2-Step Verification to be enabled on the Google account. Using an App Password is mandatory; Gmail rejects SMTP logins that use your regular account password.

If you skip `TEAMS_WEBHOOK_URL`, the function still sends email and logs a warning instead of failing. Same for `GMAIL_USER` / `GMAIL_APP_PASSWORD`.

### 5. Teams Incoming Webhook

In your target Teams channel: `…` → Connectors → **Incoming Webhook** → Configure → name + image → copy the URL → save it as `TEAMS_WEBHOOK_URL`.

If your tenant uses **Power Automate Workflows** instead of Connectors (some tenants have Connectors disabled), use the "Post to a channel when a webhook request is received" template; the URL shape is similar.

### 6. Gmail App Password

1. <https://myaccount.google.com/security> → enable **2-Step Verification** if you haven't already (mandatory — App Passwords don't work without it).
2. <https://myaccount.google.com/apppasswords> → name it `AtomAlign` → **Create** → copy the 16-character password (shown once).
3. Save it as the `GMAIL_APP_PASSWORD` secret in step 4 above.

Gmail's SMTP server (`smtp.gmail.com:465`) allows up to **500 emails/day** for free accounts (2,000 for Workspace). Plenty for a hackathon demo. Sends to any recipient address.

---

## Behaviour you should see

| Action | Recipient | Channels |
|---|---|---|
| Employee submits goal sheet | manager | email + Teams |
| Manager approves | employee | email + Teams |
| Manager returns | employee | email + Teams |
| Employee saves a check-in | manager | email + Teams |

Microsoft sign-in: clicking the button redirects to `login.microsoftonline.com`, then back to `/auth/callback`. On first login, the user lands as `EMPLOYEE` with `full_name` / `department` / `manager_id` populated from Graph (when manager's email exists in our `profiles` table). Admins promote to `MANAGER`/`ADMIN` via the existing Users page.

---

## What we deliberately did NOT do

- **No group→role auto-mapping.** Requires `GroupMember.Read.All` which needs Azure admin consent — out of scope for a hackathon demo. Role provisioning stays admin-managed; defensible as "least privilege by default".
- **No client-side Resend calls.** Putting `VITE_RESEND_API_KEY` in the browser exposes the key AND fails CORS. The Edge Function is the only safe path.
- **No background job for check-in reminders.** The "reminder" event from the original plan is not wired — the BRD doesn't require it explicitly and a cron-driven reminder would need pg_cron or a separate scheduler. Easy follow-up if needed.
