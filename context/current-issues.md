# Current issues — status log

Issues raised during testing and their resolution. Newest at top.

---

## 2026-05-17 — Round 3 (GoalForm + check-in UX)

### Fixed in code

- ✅ **Weightage bar barely visible at small percentages** — was using `bg-destructive/70` faint sliver. Switched to solid colors: amber (in progress), emerald (100%), rose (over-allocated). Added border on track, "Ready to submit" / "Need X% more" copy. ([src/components/goals/WeightageBar.tsx](../src/components/goals/WeightageBar.tsx))

- ✅ **Target field semantics unclear per UoM** — one generic input regardless of UoM was confusing users. Now conditional:
  - **NUMERIC / PERCENT** → number input with placeholder examples
  - **TIMELINE** → text Target hidden; the date picker IS the target. Auto-syncs target_date into the underlying `target` column so the goal list still reads correctly.
  - **ZERO** → text Target hidden, shown as a locked "0" tile with explanation. Auto-set to `"0"` on UoM change.
  - Each UoM also now shows a one-line hint under the UoM dropdown explaining what to enter. ([src/components/goals/GoalForm.tsx](../src/components/goals/GoalForm.tsx))

- ✅ **Mandatory-field validation gaps** — Zod schema upgraded with `superRefine`:
  - TIMELINE goals now require `target_date` (was previously optional)
  - NUMERIC / PERCENT targets must parse as positive numbers (was just `min(1)` on string length)
  - PERCENT target ≤ 100 enforced
  - All required fields marked with `*` in labels
  - Existing `min(10)` / `max(100)` weightage check preserved.

- ✅ **TIMELINE check-in flow gravity** — added an in-context callout in CheckInForm when UoM is TIMELINE explaining that the actual completion date is single-valued across quarters (set in the quarter you finished, blank in unfinished quarters, score compares against the deadline). Same for ZERO goals (quarter = incident count for that quarter). ([src/components/goals/CheckInForm.tsx](../src/components/goals/CheckInForm.tsx))

### Verified

- `npx tsc -b` → 0 errors
- `npm run build` → 1.73s, dist/ produced

### Not fixed (declined as out-of-scope under deadline)

- **"Make it production grade"** — Vague. Concrete sub-items (form UX, validation) addressed above. Larger items like code-splitting the 1.4 MB JS bundle, adding sentry, e2e tests etc. are post-submission work.
- **TIMELINE quarter model redesign** — The BRD specifies quarterly tracking for ALL UoMs. Redesigning the schema to make TIMELINE single-check-in would break the audit model and analytics view. Help text inside the form is the right surface-level fix.

---

## 2026-05-17 — Round 2 (Microsoft 5.1 + 5.2 + 5.3)

### Fixed in code

- ✅ **Switch invisible everywhere** — official shadcn-CLI install used Tailwind 4 `data-checked:` / `data-unchecked:` syntax. This codebase is on Tailwind 3 which needs `data-[state=checked]:`. Same bug class as the earlier Tabs fix. Rewrote `src/components/ui/switch.tsx`.

- ✅ **Reporting-manager dropdown only visible for EMPLOYEE role** — meant managers couldn't have a reporting manager, breaking the L1→L2→L3 chain. Removed the role gate in both create form and edit dialog. ([src/pages/admin/UsersPage.tsx](../src/pages/admin/UsersPage.tsx))

- ✅ **notify gateway returned 401 when called from evaluate-escalations** — evaluator was passing the service-role key as the Authorization bearer. The Supabase verify_jwt gateway rejects that. Fix: evaluator now captures `req.headers.get("Authorization")` (the admin's user JWT from the "Run now" SDK call) and forwards it to notify. JWT verification stays ON for both functions.

- ✅ **Emails to demo addresses bounced silently** — `manager@demo.com`, `employee@demo.com`, `admin@demo.com` are not real mailboxes. Fix is a data patch (profile.email → real gmail addresses); auth.users emails stay so logins still work. Documented in the end-to-end smoke test SQL block.

### Not fixed (data state, not code)

- **Atomberg corporate filter delivers AtomAlign emails to Junk** — this is `vaibhavpardeshi190@gmail.com` (personal Gmail SMTP sender) → `vaibhav.pardeshi@atomberg.com` (corporate Microsoft 365). Corporate filters routinely route personal-to-corporate as Junk. Mark "Not junk" to whitelist; documented as known behaviour for the demo.

- **Duplicate profile rows from iterative testing** — `select role, email from profiles` showed multiple users sharing the same email. Not a code bug — accumulated test users. Cleanup SQL provided in the end-to-end test plan.

- **Slow "create user" perceived UX** — `adminCreateUser` polls up to 1.8s waiting for the `handle_new_user` trigger, then refetches users list. Round-trip ~3-4s on free-tier Supabase. Documented as a known UX cost of doing real auth signup client-side. Not on critical path.

- **Multiple duplicate L2b SKIP_LEVEL escalation rules** — user clicked "Create rule" multiple times during the ~2s save latency, creating 7 copies. Symptom of the same slow-feedback UX as create-user. Cleanup SQL provided. Could add a `disabled-while-saving` state on the Create button in a follow-up.
