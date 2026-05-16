# Deployment & Submission Tracker

**Owner:** Vaibhav · **Repo:** [Vaibhav5771/in-house-goal-setting-progress-tracker](https://github.com/Vaibhav5771/in-house-goal-setting-progress-tracker) · **Target:** hackathon submission

Status legend: ⬜ pending · 🔄 in progress · ✅ done · ⚠️ blocked

---

## 0. Decisions Required Before We Start

These choices drive every later step. Answer these first.

| # | Question | Options | Pick |
|---|---|---|---|
| Q1 | Where do we host? | **Firebase Hosting** (mentioned in tracker, generous free tier), **Vercel** (zero-config for Vite, easiest), **Netlify** (similar to Vercel), **Cloudflare Pages** | ❓ |
| Q2 | Same Supabase project for the live demo, or fresh "demo" project? | **Same** (faster, existing data + users) · **Fresh** (clean state, risk of missed migration) | ❓ |
| Q3 | Are the three demo creds still valid? `employee@demo.com / manager@demo.com / admin@demo.com` (all `Demo@1234`) | Yes / No / partially | ❓ |
| Q4 | Architecture diagram tool? | Excalidraw, draw.io, Figma, hand-sketch | ❓ |
| Q5 | Submission deadline + form link? | _____ | ❓ |
| Q6 | Do we attempt Azure SSO bonus **after** deployment, or skip? | Tier A (90 min) / Tier B (4-6 hr) / Skip | ❓ |

**Recommendation if you want to move fast:** Vercel + same Supabase project + Excalidraw diagram. Vercel auto-detects Vite, deploys on push, and gives you a URL in ~3 min. Decide on Azure SSO only after deployment is green.

---

## 1. Pre-flight Checks (do locally before pushing)

- [ ] `npm run build` exits 0 with no TypeScript errors → confirms the production bundle compiles
- [ ] `npm run preview` serves the built `dist/` and the app works against live Supabase
- [ ] Browser console is clean on all three role journeys (no red errors)
- [ ] Verify all six migrations are applied in the target Supabase project:
  - [ ] `0001_phase1_schema.sql`
  - [ ] `0002_phase1_test_fixes.sql`
  - [ ] `0003_admin_reopen.sql`
  - [ ] `0004_phase2_checkins.sql`
  - [ ] `0005_admin_delete_user.sql`
  - [ ] `0006_analytics_summary.sql`
- [ ] Supabase Auth → Settings → "Confirm email" is **OFF** (admin-created users must log in immediately)
- [ ] Confirm three demo users exist with linkage: `employee.manager_id` → manager profile id

---

## 2. Hosting Setup

Pick **one** track below based on Q1.

### Track A — Vercel (recommended for speed)

- [ ] Sign in at vercel.com with the GitHub account that owns the repo
- [ ] Import `Vaibhav5771/in-house-goal-setting-progress-tracker`
- [ ] Framework preset: **Vite** (auto-detected)
- [ ] Build command: `npm run build` · Output dir: `dist` (auto-filled)
- [ ] Add env vars in Vercel project settings → Environment Variables:
  - [ ] `VITE_SUPABASE_URL` = (paste from local `.env`)
  - [ ] `VITE_SUPABASE_PUBLISHABLE_KEY` = (paste from local `.env`)
- [ ] Deploy → wait for green build → copy the `*.vercel.app` URL
- [ ] In Supabase Dashboard → Auth → URL Configuration → add the Vercel URL to "Site URL" + "Redirect URLs"

### Track B — Firebase Hosting

- [ ] `npm i -g firebase-tools` (if not installed)
- [ ] `firebase login`
- [ ] `firebase init hosting` → choose existing/new project → public dir `dist` → SPA: **Yes** → don't overwrite `index.html`
- [ ] Build vars: Firebase Hosting doesn't inject build-time env. Either:
  - Run `npm run build` locally with `.env` populated (vars baked into bundle), then `firebase deploy --only hosting`, **or**
  - Use a GitHub Action with secrets
- [ ] After deploy, add the `*.web.app` URL to Supabase Auth → URL Configuration

### Track C — Netlify (similar to Vercel)

- [ ] Import repo at netlify.com → build cmd `npm run build` → publish dir `dist`
- [ ] Add the two `VITE_*` env vars
- [ ] Deploy → add the URL to Supabase Auth → URL Configuration

---

## 3. Post-deploy Smoke Test (on live URL)

Run all three role journeys against the **deployed** URL, not localhost.

### Employee journey
- [ ] Login as `employee@demo.com` → lands on `/employee/dashboard`
- [ ] Create new goal sheet → add ≥ 1 goal → weightage bar reflects total
- [ ] Try to submit with weightage ≠ 100% → blocked
- [ ] Submit with weightage = 100% → status moves to SUBMITTED
- [ ] After manager approves (run in parallel tab), goals are locked
- [ ] Open `/employee/checkins` → log a Q1 actual on the approved goal
- [ ] Session persists across hard refresh

### Manager journey
- [ ] Login as `manager@demo.com` → team dashboard lists employee submission
- [ ] Open review page → edit a target inline → approve
- [ ] Goals lock; audit row created
- [ ] Open `/manager/checkins` → view employee's Q1 actual → save a comment

### Admin journey
- [ ] Login as `admin@demo.com` → admin dashboard loads
- [ ] `/admin/users` → create one new EMPLOYEE → linkage works
- [ ] `/admin/shared-goals` → push a shared goal to ≥ 1 employee
- [ ] `/admin/reports` → all three tabs render; xlsx export downloads
- [ ] `/admin/analytics` → all four charts render with data

### Cross-cutting
- [ ] Wrong-role route guards (employee tries `/admin/*` → redirected)
- [ ] Sign out clears session; refreshing returns to `/login`

---

## 4. Submission Deliverables (Section 8 of problem statement)

- [ ] **Live URL** — paste here once deployed: `__________________`
- [ ] **Source code repo** — https://github.com/Vaibhav5771/in-house-goal-setting-progress-tracker
  - [ ] Replace boilerplate `README.md` with: project summary, tech stack, setup steps, env vars, link to migrations, demo creds (or pointer to creds doc)
  - [ ] All migrations committed under `supabase/migrations/`
  - [ ] `.env` is gitignored; verify with `git check-ignore .env`
  - [ ] Final commit + push to `main`
- [ ] **Architecture diagram** (PDF/PNG) — show: React SPA · Vite build · Supabase (Postgres + Auth + RLS) · hosting provider · third-party libs (Recharts, shadcn). Save to `context/architecture.png` and link from README.
- [ ] **Demo credentials doc** — `context/demo-credentials.md` with the 3 emails + passwords + role + a note that "Confirm email" is OFF
- [ ] **Submission form filled** — live URL · repo link · diagram link · creds link

---

## 5. Optional — Azure SSO Bonus (Section 5.1)

Skip unless deployment is green and there's time on the clock. See verdict in earlier chat: Tier A (SSO button only, ~90 min) or Tier B (SSO + AAD group-role mapping + AAD manager-attribute sync, ~4-6 hr).

- [ ] Decided: Tier ___ / Skip
- [ ] Azure portal app registration with deployed URL as redirect URI
- [ ] Supabase Auth → Providers → Azure enabled
- [ ] Login page: "Sign in with Microsoft" button
- [ ] Trigger patch: handle `raw_user_meta_data->>'name'` from Azure (Phase 1 trigger only reads `full_name`)
- [ ] (Tier B) Post-signin Edge Function: fetch `/me/memberOf` → map AAD group ID → `profiles.role`
- [ ] (Tier B) Post-signin: fetch `/me/manager` → resolve to `profiles.id` → set `manager_id`
- [ ] Verified on deployed URL with at least one AAD user

---

## 6. Progress Log

| Date | What | Status |
|---|---|---|
| 2026-05-16 | Phase 1.5 manual admin tests verified | ✅ |
| 2026-05-16 | Deployment plan drafted | ✅ |
| 2026-05-16 | Hosting chosen: Vercel · same Supabase reused · demo creds confirmed | ✅ |
| 2026-05-16 | Local pre-flight: `npm run build` clean, `.gitignore` patched, `.env.example` added, README rewritten, demo-creds + arch spec drafted | ✅ |
| 2026-05-16 | First deploy: https://in-house-goal-setting-progress-trac.vercel.app | ✅ |
| 2026-05-16 | Supabase Site URL + Redirect URLs set to Vercel URL | ✅ |
| ___ | `.env` untracked + git commit + push (Option A) | ⬜ |
| ___ | All role journeys passing on live URL | ⬜ |
| ___ | architecture.png drawn and saved to `context/` | ⬜ |
| ___ | Publishable key rotated (Option B — before submission) | ⬜ |
| ___ | Submission form filled | ⬜ |
