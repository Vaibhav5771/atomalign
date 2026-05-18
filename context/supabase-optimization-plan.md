# Supabase + Data Layer Optimization Plan

## Context

Two symptoms drove this plan:

1. **"Loading state stays the same after tab switch — only a reload triggers a refresh."**
   The app uses `useEffect(() => { void store.load(); }, [])` to fetch data on mount. There is no focus/visibility listener anywhere in `src/`. After a tab is backgrounded for a while, the Supabase JWT can expire; the in-flight or next request stalls on a silent token-refresh round-trip. Since the Zustand store sets `loading = true` and only flips it back on success/error, a stalled request leaves the UI stuck on the spinner. **The page only "wakes up" when the user reloads, because reload re-creates the supabase client and re-triggers the mount-only `useEffect`.**

2. **Multiple sequential round-trips per page.** ReportsPage fires 3 store actions that collectively spawn ~15 Supabase queries. `fetchCompletion` alone is 5 sequential round-trips (profiles → managers → sheets → goals → check-ins). `runNow()` re-fetches the full 200-row escalations log after the Edge Function already knows which rows fired.

Confirmed via code audit. Stores: [authStore.ts](src/stores/authStore.ts), [goalSheetStore.ts](src/stores/goalSheetStore.ts), [managerStore.ts](src/stores/managerStore.ts), [escalationsStore.ts](src/stores/escalationsStore.ts), [reportsStore.ts](src/stores/reportsStore.ts), [analyticsStore.ts](src/stores/analyticsStore.ts).

---

## Phase 0 — Stop the bleeding (1 small PR, no library)

Goals: fix the stuck-spinner bug without introducing a new dependency. This unblocks users while we design the full migration.

1. **Add a global `visibilitychange` + `online` handler** that calls each store's `refresh()` action when the tab comes back to foreground after >30 s away. New file: `src/lib/use-window-focus-refresh.ts`. Mounts inside `AppShell` so it runs only for authenticated routes.
2. **Add a request timeout wrapper** in [supabase.ts](src/lib/supabase.ts) — any query that doesn't resolve within 15 s throws instead of hanging. Prevents the stuck-spinner case even when token refresh deadlocks.
3. **Reset `loading: true` on unmount or on every new `fetch*` invocation.** Several stores have stale `loading: true` left over from a prior interrupted fetch. Audit pattern: in each `fetch*` action, set `loading: true` at the start and use `try/finally` to always reset.

This phase is ~150 lines, no new deps, deployable in one day.

---

## Phase 1 — Adopt TanStack Query as the read-data layer

Why TanStack Query specifically, given the symptoms:

| Symptom | TanStack Query feature that fixes it |
|---|---|
| Loading state stuck after tab switch | `refetchOnWindowFocus: true` (default) — when tab regains focus and data is older than `staleTime`, automatically re-fetches in the background |
| Token refresh hangs request | `retry: 3` with exponential backoff + per-query `networkMode: "online"` automatically recovers |
| Same query fires twice on mount (component + store init) | Request deduplication built-in — identical query keys share one in-flight promise |
| `loading: true` never resets after error | Per-query `status: "pending" \| "error" \| "success"` is mandatory; impossible to leave a query "loading" forever |
| Loading flicker on revisit | `staleTime` keeps cached data instantly visible while a background re-fetch runs |

**Migration strategy: strangler pattern, page by page.**

1. Add `@tanstack/react-query` (~13 KB gz). Mount `<QueryClientProvider>` inside [App.tsx](src/App.tsx) at the same level as `<ThemeProvider>`. Defaults: `staleTime: 30_000`, `gcTime: 5 * 60_000`, `refetchOnWindowFocus: true`, `retry: 2`.
2. Create `src/queries/` directory. One file per domain: `useMySheet.ts`, `useTeamSheets.ts`, `useEscalations.ts`, `useReports.ts`, `useAdminStats.ts`. Each exports a typed hook wrapping `useQuery` that calls into the existing store's underlying Supabase code — **don't delete the stores yet**.
3. Migrate one page at a time. Start with **EmployeeDashboard** (lowest blast radius, single query). Replace `useGoalSheetStore` + `useEffect` with `useMySheet()`. Verify, ship. Repeat for ManagerDashboard, AdminDashboard, EscalationsPage, ReportsPage.
4. Once all reads are migrated, gut the read-side of each Zustand store. Keep stores only for **mutations** + cross-cutting state (auth user, theme).

**Devtools**: include `@tanstack/react-query-devtools` in dev. Hugely speeds up debugging the cache state.

**Stores that stay**: [authStore.ts](src/stores/authStore.ts) (session is a singleton, lives in a store), theme-provider context, and a slim "current sheet draft" store if needed for unsaved-edit UX.

---

## Phase 2 — Mutations via TanStack Query + optimistic updates

Pattern for every mutation:

```ts
const queryClient = useQueryClient();
const submitSheet = useMutation({
  mutationFn: (sheetId: string) => goalSheetStore.submitSheet(sheetId),
  onSuccess: (updatedSheet) => {
    queryClient.setQueryData(["sheet", "mine"], updatedSheet);   // merge, don't refetch
    queryClient.invalidateQueries({ queryKey: ["team-sheets"] }); // bust manager's view
  },
});
```

Key wins:
- **No more `await fetchLog()` after `runNow()`.** The Edge Function should return the fired escalations; we `setQueryData` to splice them into the cached log, then `invalidateQueries` if rules-tab also depends on it. Saves 1 full refetch + hydration sub-queries every time the user clicks "Run now."
- **Approve/Return sheet**: the mutation already returns the updated row; with `setQueryData` we update the manager's team list locally and invalidate only the specific sheet detail.
- **Save check-in**: optimistic update — splice the new check-in into the cached list immediately, rollback `onError`.

---

## Phase 3 — Batch the read waterfalls (Supabase RPCs)

These are the highest-impact server-side consolidations. Each replaces N round-trips with one.

### 3.1 — `get_employee_dashboard(employee_id, cycle_year)` RPC
Current: [goalSheetStore.ts:83–164](src/stores/goalSheetStore.ts#L83) — up to 4 round-trips (sheet → goals + shared_goals in parallel → sharer profiles if any). Replace with one RPC that returns `{ sheet, goals, shared_assignments, sharer_profiles }` in a single JSON payload.

### 3.2 — `get_manager_dashboard(manager_id)` RPC
Current: [managerStore.ts:46–117](src/stores/managerStore.ts#L46) — 2 sequential queries (reports, then sheets), plus a per-row reopener profile fetch buried at line 147. One RPC returning the full team view with reopener metadata embedded.

### 3.3 — `get_admin_overview()` RPC
Current: [AdminDashboard.tsx:36–39](src/pages/admin/AdminDashboard.tsx#L36) — two parallel scans of `profiles` and `goal_sheets`, then client-side aggregation. Move the aggregation to Postgres. Returns `{ employees, managers, sheets, byStatus }` in one call. Bonus: cached by Postgres as a materialized view if needed.

### 3.4 — `get_completion_report(cycle_year)` RPC (highest impact)
Current: [reportsStore.ts:97–199](src/stores/reportsStore.ts#L97) — **5 sequential queries** (profiles → managers → sheets → goals → check-ins). Each row of the final report needs joining all five. This is exactly what SQL was built for. One RPC, one row-set, one round-trip.

### 3.5 — `get_achievement_report(cycle_year)` RPC
Current: [reportsStore.ts:207–305](src/stores/reportsStore.ts#L207) — 4 unfiltered table scans then client-side join. Same fix.

### 3.6 — `escalate_evaluate_and_return()` Edge Function tweak
Today: [escalationsStore.ts:141–168](src/stores/escalationsStore.ts#L141) calls the Edge Function then runs a full `fetchLog()` (200 rows + 2 hydration queries). Have the Edge Function return the rows it fired in the same response, then `setQueryData` to prepend them to the cached log. Zero follow-up round-trips.

---

## Phase 4 — Per-query payload diet

[escalationsStore.ts:117](src/stores/escalationsStore.ts#L117) selects `*` from `profiles` then displays 3 fields. Same pattern in several places. Audit every `.select("*")` and narrow to the columns the UI actually consumes. Cheap network win — usually 50–80% bandwidth reduction per query.

---

## Phase 5 — Realtime (optional, only if needed)

If after Phases 0–4 there's still a "data feels stale" complaint, add `supabase.channel()` subscriptions on `goal_sheets` for the manager dashboard and `escalations` for the admin escalations page. TanStack Query plays nicely — the channel callback calls `queryClient.invalidateQueries` for the affected keys.

Don't do this in Phase 1. Realtime is a big surface area; the focus-refetch + 30s staleTime is enough for almost every workflow this app does.

---

## What we're explicitly NOT doing

- **Server-side rendering / Next.js migration.** Out of scope; Vite + React stays.
- **Replacing Zustand entirely.** Zustand keeps mutations, auth, and any local-only state (theme, draft UI). Only the read-side moves to TanStack Query.
- **Optimistic everything.** Only mutations where the rollback is cheap (check-in save, escalation resolve). Sheet approval/return stay non-optimistic because the cost of a rollback (wrong status badge) is too visible.
- **Custom retry policies per query.** Use the global defaults until something proves them wrong.

---

## Verification plan

For each phase:

- **Phase 0**: open DevTools → Network → throttle to Slow 3G → trigger a fetch → background the tab for 90 s → bring it back. Expect the stuck spinner to clear within 15 s (timeout). Expect a fresh fetch on focus return.
- **Phase 1**: install TanStack Devtools, observe one EmployeeDashboard mount → see exactly one query fire. Switch tabs → see `refetchOnWindowFocus` event. Reload → see hot cache hit and instant render.
- **Phase 2**: click "Approve" on a sheet, watch the team list update without a network round-trip.
- **Phase 3**: in DevTools Network, ReportsPage mount goes from ~15 requests to 3.
- **Phase 4**: payload size per `escalations log` request drops from ~120 KB to <20 KB.

---

## Suggested PR breakdown

1. **PR-data-1**: Phase 0 only — visibilitychange listener + 15s timeout + `loading` reset audit. (~150 LOC.)
2. **PR-data-2**: Phase 1 setup — add TanStack Query + Devtools, migrate EmployeeDashboard as proof. (~200 LOC.)
3. **PR-data-3..7**: One PR per remaining page migration.
4. **PR-data-8..N**: Per-RPC backend additions + corresponding query swaps (paired migration + supabase migration file each time).

Don't try to land Phases 1 and 3 together — keep the front-end migration clean of schema changes so we can roll back independently if a RPC misbehaves.
