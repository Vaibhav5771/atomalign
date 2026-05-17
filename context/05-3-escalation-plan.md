# Phase 5.3 — Rule-Based Escalation Module — Implementation Plan

> BRD §5.3 verbatim: *"Configurable escalation rules triggered by defined conditions — Employee has not submitted goals within N days of cycle open; Manager has not approved goals within N days of submission; Quarterly check-in not completed within the active window. Escalation chain: auto-notification to employee → manager → skip-level / HR after defined intervals. Escalation log visible to Admin / HR for tracking and resolution."*

---

## Design summary

Three pieces:

1. **Storage** — two tables and a small SQL function
2. **Evaluator** — a Supabase Edge Function that scans for overdue items and fires notifications
3. **Admin UI** — page at `/admin/escalations` with Rules tab + Log tab + "Run now" button

Reuses the existing `notify` Edge Function (adds one new event type). Reuses the existing `audit_logs` pattern for the escalation log. No new external services — all server-side work runs inside Supabase.

---

## Component 1 — Storage (`supabase/migrations/0008_escalations.sql`)

### Enums

```sql
create type trigger_type as enum (
  'SUBMIT_OVERDUE',     -- DRAFT sheet older than threshold
  'APPROVE_OVERDUE',    -- SUBMITTED sheet older than threshold
  'CHECKIN_OVERDUE'     -- APPROVED sheet missing current-quarter check-in
);

create type escalate_target as enum (
  'EMPLOYEE',           -- L1: chase the person directly
  'MANAGER',            -- L2: chase their manager
  'SKIP_LEVEL',         -- L3: manager's manager
  'HR'                  -- L3 alt: anyone with role = ADMIN
);
```

### `escalation_rules` table

```sql
create table public.escalation_rules (
  id              uuid primary key default gen_random_uuid(),
  name            text not null,
  trigger_type    trigger_type not null,
  threshold_days  int not null check (threshold_days > 0),
  escalate_to    escalate_target not null,
  is_active       boolean not null default true,
  created_at      timestamptz not null default now()
);
```

### `escalations` table (the log)

```sql
create table public.escalations (
  id                uuid primary key default gen_random_uuid(),
  rule_id           uuid references public.escalation_rules(id) on delete set null,
  subject_user_id   uuid not null references public.profiles(id) on delete cascade,
  recipient_user_id uuid references public.profiles(id) on delete set null,
  trigger_type      trigger_type not null,
  sheet_id          uuid references public.goal_sheets(id) on delete set null,
  reason_text       text not null,
  fired_at          timestamptz not null default now(),
  resolved_at       timestamptz,
  -- Prevents duplicate fires for the same (rule, subject, day):
  fire_date         date generated always as ((fired_at at time zone 'utc')::date) stored
);

create unique index escalations_dedupe_idx
  on public.escalations(rule_id, subject_user_id, fire_date);
```

### RLS

- Admin: SELECT/INSERT/UPDATE on both tables
- Manager: SELECT on `escalations` where `subject_user_id` is a direct report; no access to rules
- Employee: SELECT on `escalations` where `subject_user_id = auth.uid()`; no access to rules

### Seed (3 default rules so the demo isn't empty)

```sql
insert into public.escalation_rules (name, trigger_type, threshold_days, escalate_to) values
  ('Goal-setting overdue (employee)',  'SUBMIT_OVERDUE',  10, 'EMPLOYEE'),
  ('Approval overdue (manager)',        'APPROVE_OVERDUE', 5,  'MANAGER'),
  ('Check-in overdue (employee)',       'CHECKIN_OVERDUE', 14, 'EMPLOYEE');
```

---

## Component 2 — Evaluator (`supabase/functions/evaluate-escalations/index.ts`)

### Inputs

- POST with empty body (invoked by Supabase Cron daily, OR by admin "Run now" button)
- Uses `SUPABASE_SERVICE_ROLE_KEY` for admin queries

### Algorithm

For each `is_active = true` rule:

1. Query the relevant overdue set:
   - `SUBMIT_OVERDUE`: `goal_sheets where status = 'DRAFT' and created_at < now() - interval '<threshold> days'`
   - `APPROVE_OVERDUE`: `goal_sheets where status = 'SUBMITTED' and submitted_at < now() - interval '<threshold> days'`
   - `CHECKIN_OVERDUE`: `goal_sheets where status = 'APPROVED'` joined against `check_ins` for the current quarter; rows with NO check-in for the active quarter beyond threshold

2. For each overdue row, resolve the recipient:
   - `EMPLOYEE` → `subject_user_id`
   - `MANAGER` → `profiles.manager_id` of subject
   - `SKIP_LEVEL` → manager's manager
   - `HR` → any user with `role = 'ADMIN'` (pick first)

3. Try to insert an `escalations` row. The `(rule_id, subject_user_id, fire_date)` unique index makes the insert idempotent — silently skipped if already fired today.

4. On successful insert, invoke `notify` function with `event: "escalation"`, passing the new escalation row id.

### Return shape

```json
{ "ok": true, "evaluated_rules": 3, "fired": 5, "skipped_duplicates": 2 }
```

### Schedule

Supabase Dashboard → Database → **Cron** → schedule:
- Function: `evaluate-escalations`
- Schedule: `0 9 * * *` (daily at 09:00 UTC)

Manual button in admin UI also invokes the same function directly.

---

## Component 3 — Admin UI

### Types (`src/types/index.ts`)

```typescript
export type TriggerType = "SUBMIT_OVERDUE" | "APPROVE_OVERDUE" | "CHECKIN_OVERDUE";
export type EscalateTarget = "EMPLOYEE" | "MANAGER" | "SKIP_LEVEL" | "HR";

export interface EscalationRule {
  id: string;
  name: string;
  trigger_type: TriggerType;
  threshold_days: number;
  escalate_to: EscalateTarget;
  is_active: boolean;
  created_at: string;
}

export interface Escalation {
  id: string;
  rule_id: string | null;
  subject_user_id: string;
  recipient_user_id: string | null;
  trigger_type: TriggerType;
  sheet_id: string | null;
  reason_text: string;
  fired_at: string;
  resolved_at: string | null;
}
```

### Store (`src/stores/escalationsStore.ts`)

```typescript
interface EscalationsState {
  rules: EscalationRule[];
  log: Escalation[];
  running: boolean;
  loading: boolean;
  fetchRules: () => Promise<void>;
  createRule: (input: Omit<EscalationRule, "id" | "created_at">) => Promise<{ error: string | null }>;
  updateRule: (id: string, patch: Partial<EscalationRule>) => Promise<{ error: string | null }>;
  deleteRule: (id: string) => Promise<{ error: string | null }>;
  fetchLog: () => Promise<void>;
  runNow: () => Promise<{ error: string | null; summary?: { fired: number; skipped: number } }>;
  resolve: (escalationId: string) => Promise<{ error: string | null }>;
}
```

### Components

- `src/components/admin/RulesTable.tsx` — table of rules with inline toggles for `is_active`, edit dialog (name/threshold/escalate_to), delete confirmation
- `src/components/admin/EscalationLogTable.tsx` — newest-first; columns: fired_at · subject · trigger · recipient · reason · status (active/resolved) · "Resolve" button
- `src/components/admin/AddRuleDialog.tsx` — form: name, trigger type select, threshold number, escalate_to select

### Page (`src/pages/admin/EscalationsPage.tsx`)

shadcn Tabs:
- **Rules** tab: RulesTable + "+ Add rule" button
- **Log** tab: EscalationLogTable + "Run escalations now" button (shows toast with `fired: N` after invoke)

### Routing & nav

- `src/App.tsx` — add `<Route path="/admin/escalations" element={<EscalationsPage />} />` inside the ADMIN ProtectedRoute
- `src/components/layout/Sidebar.tsx` — add admin nav item: icon `AlertTriangle`, label "Escalations"

---

## Notification path — extending `notify` function

Add to `EventType` union: `"escalation"`.

```typescript
case "escalation":
  // payload.remark = reason_text; payload.actor_id = subject_user_id
  return wrap(
    `<p>Hi ${ctx.manager?.name ?? ctx.employee.name},</p>
     <p>This is an automated escalation: <strong>${payload.remark}</strong></p>
     <p>Subject: ${ctx.employee.name}${ctx.employee.email ? ` (${ctx.employee.email})` : ""}</p>`
  );
```

Subject example: `"Escalation: <subject_name> has not submitted goals (15 days overdue)"`.

The recipient for escalation events is **explicitly passed** in the function call (not derived from sheet) — the evaluator already resolved it. So extend the payload contract:

```typescript
interface Payload {
  event: EventType;
  sheet_id?: string;       // optional now — escalations may not have a sheet
  actor_id: string;
  recipient_id?: string;   // NEW: explicit override for escalation flow
  remark?: string;
  quarter?: string;
}
```

When `recipient_id` is set, the function uses that user's profile email instead of the derived one.

---

## Build order (most-to-least dependent)

1. **Migration** (`0008_escalations.sql`) — apply in SQL Editor
2. **Types** — `src/types/index.ts` additions
3. **Edge Function** `evaluate-escalations` — write + deploy
4. **Extend `notify`** with escalation event + recipient_id support → redeploy
5. **Store** `escalationsStore.ts`
6. **Components** Rules/Log tables + Add dialog
7. **Page** `EscalationsPage.tsx`
8. **Routing + Sidebar** wiring
9. **Type-check + build** (must stay 0 errors)
10. **Cron schedule** in Supabase Dashboard
11. **Smoke test:** backdate a draft sheet, click Run now, verify escalation row + email arrives

---

## Smoke test details

To prove the system works without waiting for a real overdue scenario:

```sql
-- Pick the employee's DRAFT sheet (assumes employee@demo.com still has one)
update public.goal_sheets
set created_at = now() - interval '20 days'
where employee_id = (select id from public.profiles where email = 'employee@demo.com')
  and status = 'DRAFT';
```

Then:
1. Admin → Escalations → Run now
2. Should see toast like "Fired 1, skipped 0"
3. Log tab shows new row with trigger `SUBMIT_OVERDUE`
4. `vaibhavpardeshi190@gmail.com` (since manager's profile email is the gmail) receives escalation email

---

## Estimated effort

| Block | Time |
|---|---|
| Migration + RLS + seed | 25 min |
| Types + store | 20 min |
| Evaluator Edge Function | 45 min |
| Extend notify + redeploy | 15 min |
| Components (3 files) | 40 min |
| Page + routing + sidebar | 15 min |
| Type-check + build verify | 10 min |
| Cron + smoke test | 20 min |
| **Total** | **~3 hours** |

---

## Risk register

| Risk | Mitigation |
|---|---|
| Supabase Cron not available on free tier | Use pg_cron extension instead (also free); or just demo via "Run now" button — evaluator sees it work either way |
| Evaluator times out for large user sets | Demo data is tiny (3-5 users); not a real concern for hackathon. For production, paginate queries. |
| Duplicate notifications on retries | Already handled — unique index on `(rule_id, subject_user_id, fire_date)` |
| Existing notify function breaks when adding `recipient_id` field | New field is optional; existing 4 trigger points pass payloads without it and continue to work unchanged |
| Demo doesn't have any overdue items naturally | Smoke-test SQL above artificially backdates a sheet so the demo always has at least one escalation to show |
