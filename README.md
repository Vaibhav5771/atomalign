# AtomAlign

In-house portal for company-wide quarterly goal setting, manager approval, achievement tracking, escalations, and HR-level analytics. Built for **AtomQuest Hackathon 1.0**.

**Live demo:** https://atomalignv.netlify.app
**Submission document:** [`docs/SUBMISSION.pdf`](./docs/SUBMISSION.pdf) (single file containing the working link, repo, and architecture diagram)
**Onboarding + email walkthrough:** [`docs/ONBOARDING.md`](./docs/ONBOARDING.md) — step-by-step wizard flow + what emails fire when + how to configure SMTP for a fork
**Architecture diagram:** [`context/architecture.png`](./context/architecture.png)
**Demo credentials walkthrough:** [`context/demo-credentials.md`](./context/demo-credentials.md)
**Master status doc:** [`context/progress-tracker.md`](./context/progress-tracker.md)

---

## For evaluators — start here

There is **one** pre-seeded login. Manager and Employee accounts are created by you, inside the app, in about 2 minutes.

| Role | Email | Password |
|---|---|---|
| Admin / HR | `admin@demo.com` | `Demo@1234` |

**What happens after you sign in:**

1. The **Create Team** wizard auto-opens on `/admin/dashboard` (first visit per browser).
2. **Step 0** — replace `admin@demo.com` with your own email + password. This creates a *new* admin and signs you in as that user. `admin@demo.com / Demo@1234` is preserved untouched as a permanent fallback if anything goes wrong.
3. **Step 1** — add 1–5 managers using real email addresses.
4. **Step 2** — add 1–20 employees, each assigned to a manager from Step 1.
5. **Step 3** — copy the credentials table. Sign in as any of those users to walk the Employee / Manager / Admin journeys.

**Use real email addresses in the wizard.** Welcome emails, goal-event notifications (submitted / approved / returned / check-in saved), and escalation reminders all fire to those addresses via Gmail SMTP through a Supabase Edge Function. Emails may land in Spam — that's expected for a hackathon SMTP relay.

> **Want the full step-by-step?** See [`docs/ONBOARDING.md`](./docs/ONBOARDING.md) — every wizard field explained, every email event listed (who gets what, when), and a complete SMTP setup guide for forkers.

### 5-minute happy-path

1. **Employee** signs in → `/employee/goals/new` → adds 2 goals (e.g. 60% / 40% weightage) → submits.
2. **Manager** signs in → reviews the submission → tweaks one target inline → **Approves**. Sheet locks; employee gets an approval email.
3. **Employee** signs back in → `/employee/checkins` → logs a Q1 actual against a now-locked goal.
4. **Manager** opens `/manager/checkins` → reads the Q1 actual → adds a check-in comment.
5. **Admin** opens `/admin/analytics` (charts populate), `/admin/reports` (exports XLSX), `/admin/users` (full user management), `/admin/escalations` (rule-based reminders).

---

## What's built

| Phase | Module | Status |
|---|---|---|
| Phase 1 | Goal creation, weightage validation, manager approval, shared goals | ✅ |
| Phase 1.5 | Admin user management (create / edit / delete with cascades) | ✅ |
| Phase 2 P1 | Quarterly check-ins with computed scores (Min / Max / Timeline / Zero) | ✅ |
| Phase 2 P2 | Reports — Achievement export (xlsx), completion dashboard, audit trail | ✅ |
| Phase 2 P3 | Analytics — QoQ trends, distribution, team completion, manager effectiveness | ✅ |
| Phase 5.1 | Microsoft Entra ID SSO + Graph org-hierarchy sync (bonus) | ✅ |
| Phase 5.2 | Email notifications via Gmail SMTP — submit / approve / return / check-in / welcome (bonus) | ✅ |
| Phase 5.3 | Rule-based escalations with chained recipients + daily evaluator (bonus) | ✅ |
| Round-7 | Design-system polish — dark-only theme, MagicUI motion, Lottie outcome dialogs across every flow | ✅ |

All Phase 1 and Phase 2 validation rules from the BRD are enforced (weightage = 100%, min 10%, max 8 goals, goal lock after approval, shared goal read-only title/target). Soft enforcement on BRD §2.3 quarterly windows — saves aren't hard-blocked outside the window so the demo can exercise all four quarters at any time; a `CyclePhaseBanner` surfaces the currently-open window.

---

## Tech stack

| Layer | Choice |
|---|---|
| Frontend | React 19 + Vite + TypeScript |
| UI | shadcn/ui (Radix primitives) + Tailwind + MagicUI primitives (Meteors / BorderBeam / NumberTicker / AnimatedCircularProgress / BlurFade / Globe / ShimmerButton / AnimatedBeam / AnimatedGridPattern) |
| Motion | framer-motion (respects `prefers-reduced-motion` everywhere) |
| Outcome dialogs | `@lottiefiles/dotlottie-react` with `/success.lottie` and `/error.lottie` |
| State | Zustand (auth, goalSheet, manager, reports, analytics, escalations, ui, mascot) |
| Forms | react-hook-form + zod |
| Charts | Recharts (dark-theme tooltips) |
| Date picker | react-day-picker v10 + date-fns |
| Backend | Supabase (Postgres + Auth + Row Level Security + Edge Functions) |
| Edge Functions | `notify` (Gmail SMTP via denomailer), `evaluate-escalations` (daily cron) |
| Auth | Email/password + Microsoft Entra ID SSO (admin-pre-registered emails only) |
| Export | SheetJS (xlsx) |
| Tests | Vitest + Testing Library + jsdom |
| Hosting | Netlify (SPA fallback via `_redirects` + `netlify.toml`) |

No custom backend service — all business logic lives in Postgres (triggers, RLS, SECURITY DEFINER RPCs) plus two Deno-based Supabase Edge Functions for email and scheduled escalation evaluation.

---

## Design system (round-7)

The app is **dark-only** (`<html class="dark">` is hard-coded; no light-mode toggle). The visual language is locked in around a small set of tokens:

- **Rounding:** `rounded-md` (≈8px) on cards / dialogs / dropdowns; `rounded-sm` (≈6px) on buttons / tabs / pills
- **Surfaces:** solid `bg-card` on every dialog (confirm + outcome); soft `border-border/60` on cards
- **Accent:** warm yellow `--primary` for CTAs and active states; `--destructive` for destructive actions and error glows; `--neon-blue` / `--neon-violet` for decorative gradients on the login screen
- **Feedback model:** validation surfaces inline; write operations route through a centered **Lottie outcome dialog** (`/success.lottie` or `/error.lottie`). Destructive ops (delete user, delete goal, clear-all rules, delete past shared goal, return-for-rework) get a **confirm step** with a snapshot panel; non-destructive create/edit writes skip the confirm and go straight to Supabase + outcome
- **Motion vocabulary:** `BlurFade` for staggered first-paint, `BorderBeam` for accent rings, `Meteors` / `Globe` decoratively on Login, `AnimatedBeam` for the org-tree visualisation in the Create Team wizard, `AnimatedGridPattern` for enterprise empty-state chrome on Analytics / Escalations

See [`context/progress-tracker.md`](./context/progress-tracker.md) → "Round-7 design language overhaul" for the full decisions log (Sections A–S).

---

## Project structure

```
src/
  components/
    admin/         Create Team wizard, ViewTeamDialog, TeamTree (AnimatedBeam-based),
                   AnalyticsDashboard, AnalyticsEmptyState, EditUserDialog,
                   DeleteUserDialog, EscalationRuleDialog, ReviewGoalSheet panels
    goals/         GoalForm, GoalList (with Edit + Delete-confirm dialogs),
                   WeightageBar, CheckInForm, CheckInScoreCard,
                   QuarterSelector, CyclePhaseBanner
    layout/        AppShell, Sidebar (collapsible, persisted), LogoutDialog
                   (Lottie-driven), Mascot, ProtectedRoute
    manager/       TeamTable, ReviewPanel (inline blur-to-save), ManagerCheckInView
    shared/        StatCard, StatusBadge, RoleBadge, NumericStepper
    ui/            shadcn primitives (button, card, dialog, select, slider,
                   popover, calendar, tabs, dropdown-menu, toast, …)
    ui/magicui/    Meteors, BorderBeam, NumberTicker, BlurFade, WordFadeIn,
                   MagicCard, AnimatedCircularProgress, BentoGrid, ShimmerButton,
                   Globe, AvatarBeam, WordRotate, PulsatingButton, AnimatedBeam,
                   AnimatedGridPattern, DotPattern
  pages/
    auth/          LoginPage, AuthCallbackPage
    employee/      EmployeeDashboard, GoalSheetPage, NewGoalSheetPage, CheckInsPage
    manager/       ManagerDashboard, ReviewGoalSheet, ManagerCheckInsPage
    admin/         AdminDashboard, UsersPage, SharedGoalsPage (with Past-shared
                   dialog + delete), ReportsPage, AnalyticsPage, EscalationsPage
  stores/          authStore, goalSheetStore, managerStore, reportsStore,
                   analyticsStore, escalationsStore, uiStore, mascotStore
  lib/             supabase client (15s AbortController timeout), score functions,
                   notify, use-focus-refresh, use-prefers-reduced-motion
  types/           shared TypeScript interfaces

supabase/
  migrations/      0001 … 0012 — apply in numeric order
  functions/
    notify/                 Gmail SMTP notifier (denomailer); also routes the
                            optional Teams adaptive-card webhook
    evaluate-escalations/   Daily cron — scans submissions/approvals/check-ins,
                            fires escalations per admin-configured rule chain

context/          phase plans, demo creds, deployment, problem statement,
                  master progress tracker
public/           success.lottie, error.lottie, spaceman.lottie, mascot.lottie
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

# 3. apply migrations (in numeric order, 0001 → 0012)
#    Supabase Dashboard → SQL Editor → paste each file under
#    supabase/migrations/ → Run

# 4. seed the fallback admin (skip if you are only using the live demo)
#    Supabase Dashboard → Authentication → Users → "Add user"
#    Create admin@demo.com / Demo@1234 with "Auto-confirm user" ON.
#    Then promote to ADMIN via SQL:
#      update profiles set role = 'ADMIN' where email = 'admin@demo.com';
#    Managers and employees are created from the Create Team wizard
#    inside the app once you're signed in.

# 5. deploy edge functions (optional but required for email + escalations)
supabase functions deploy notify
supabase functions deploy evaluate-escalations

# 6. dev server
npm run dev   # http://localhost:5173

# 7. tests
npm test      # vitest

# 8. production build
npm run build   # outputs to dist/
npm run preview # serves the built bundle
```

**Auth setting:** Supabase → Authentication → Settings → "Confirm email" **OFF** (required so admin-created users can sign in immediately).

**For Microsoft sign-in (Phase 5.1):** configure an Azure AD app, set the Microsoft provider in Supabase Auth, and ensure migration `0009_restrict_azure_signup.sql` is applied so only admin-pre-registered emails can complete SSO.

**For email notifications (Phase 5.2):** set the `notify` Edge Function secrets — Gmail SMTP credentials. Optionally set `TEAMS_WEBHOOK_URL` to receive adaptive-card duplicates.

---

## Database schema (summary)

Twelve migration files, applied in numeric order:

| File | What it adds |
|---|---|
| `0001_phase1_schema.sql` | Core tables (`profiles`, `goal_sheets`, `goals`, `shared_goals`, `audit_logs`), enums, `handle_new_user` trigger, full RLS policy set |
| `0002_phase1_test_fixes.sql` | `goals.shared_by` FK + `enforce_shared_goal_lock` trigger |
| `0003_admin_reopen.sql` | `goal_sheets.reopened_by` / `reopened_at`, admin update RLS, plus `goals_delete_admin` policy used by the Past-shared-goals delete flow |
| `0004_phase2_checkins.sql` | `check_ins` table, `goals.direction` (HIGHER/LOWER), check-in RLS |
| `0005_admin_delete_user.sql` | `admin_delete_user(uuid)` SECURITY DEFINER RPC |
| `0006_analytics_summary.sql` | `analytics_summary` view (SECURITY INVOKER) |
| `0007_microsoft_integration.sql` | Org-hierarchy sync from Azure AD via Graph API |
| `0008_escalations.sql` | `escalation_rules` + `escalations` tables, default SUBMIT_OVERDUE 3-step chain |
| `0009_restrict_azure_signup.sql` | Rejects Azure provider sign-ups whose email isn't already in `profiles` |
| `0010_set_my_email_immediate.sql` | `set_my_email_immediate()` RPC used by admin self-edit flow |
| `0011_update_my_account_immediate.sql` | `update_admin()` RPC for the wizard's Step 0 account update |
| `0012_get_completion_report.sql` | `get_completion_report()` SECURITY DEFINER RPC — collapses 5 client requests into 1 for the Reports → Completion tab |

Row Level Security is the security boundary: employees see only their own data, managers see their reports, admins see everything. `current_role()` SQL helper reads `profiles.role`.

---

## Routes

| Route | Role |
|---|---|
| `/login` · `/auth/callback` | All |
| `/employee/dashboard`, `/employee/goals`, `/employee/goals/new`, `/employee/checkins` | Employee |
| `/manager/dashboard`, `/manager/review/:sheetId`, `/manager/checkins` | Manager |
| `/admin/dashboard`, `/admin/users`, `/admin/shared-goals`, `/admin/reports`, `/admin/analytics`, `/admin/escalations` | Admin |

`ProtectedRoute` redirects unauthenticated users to `/login` and blocks cross-role access. Backgrounded tabs returning to focus refresh page data via `useFocusRefresh` (30s threshold + online-event listener), and every Supabase HTTP call carries a 15s `AbortController` timeout so cold-starts never hang.

---

## Hackathon mapping

| Problem statement section | Implementation |
|---|---|
| 2.1 Phase 1 — Goal creation & approval | ✅ Employee/Manager/Admin flows, validation, shared goals, admin reopen |
| 2.2 Phase 2 — Achievement tracking | ✅ Quarterly check-ins, score formulas (Min/Max/Timeline/Zero), manager comments |
| 4 — Reporting & governance | ✅ Achievement export (xlsx), completion dashboard, audit trail |
| 5.1 — Microsoft Entra ID SSO (bonus) | ✅ Live · Entra app + Graph API org sync · admin-pre-registered emails only |
| 5.2 — Email / Teams integration (bonus) | ✅ Gmail SMTP via `notify` Edge Function (submit / approve / return / check-in / welcome / escalation) · Teams card builder code-ready (set `TEAMS_WEBHOOK_URL` to activate) |
| 5.3 — Escalation module (bonus) | ✅ Rule-based engine — admin chains by L1/L2/Admin, daily `evaluate-escalations` cron · log + manual "Run now" trigger |
| 5.4 — Analytics module (bonus) | ✅ 4 charts: QoQ trend, distribution, team completion, manager effectiveness |

---

## Docs

- [`context/progress-tracker.md`](./context/progress-tracker.md) — master status, design-system decisions log (Sections A–S), every round's fix-log
- [`context/01-phase-1.md`](./context/01-phase-1.md) — Phase 1 plan
- [`context/02-phase-2.md`](./context/02-phase-2.md) — Phase 2 plan (P1 / P2 / P3)
- [`context/demo-credentials.md`](./context/demo-credentials.md) — judge walkthrough + "create your own team" guide
- [`context/deployment.md`](./context/deployment.md) — deployment checklist
- [`context/6a06fcd06885a_AtomQuest_Hackathon_1.0_Problem_Statement_.docx`](./context/6a06fcd06885a_AtomQuest_Hackathon_1.0_Problem_Statement_.docx) — original problem statement
