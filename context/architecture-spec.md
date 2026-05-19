# Architecture Diagram — Layout Spec

Use this as a script to draw the diagram in Excalidraw (excalidraw.com — no signup needed). Export as PNG when done, save as `context/architecture.png`, and link from README.

**Estimated time: 8-10 minutes.**

---

## Diagram layout (top-to-bottom, 3 horizontal layers)

### Layer 1 — Users (top, 3 boxes side-by-side)

```
┌──────────────────┐   ┌──────────────────┐   ┌──────────────────┐
│   👤 Employee    │   │  👥 Manager (L1) │   │   ⚙️ Admin / HR  │
│                  │   │                  │   │                  │
│ Create goals     │   │ Approve goals    │   │ User mgmt        │
│ Quarterly        │   │ Inline edit      │   │ Shared goals     │
│ check-ins        │   │ Check-in review  │   │ Reports + audit  │
│                  │   │                  │   │ Analytics        │
└────────┬─────────┘   └────────┬─────────┘   └────────┬─────────┘
         │                      │                      │
         └──────────────────────┼──────────────────────┘
                                ▼
                    [HTTPS — Browser]
```

### Layer 2 — Frontend (single big box, hosted on Netlify)

```
┌───────────────────────────────────────────────────────────────┐
│  🌐 Netlify — Static Hosting (CDN-edge)                       │
│  ───────────────────────────────────────────────────────────  │
│                                                               │
│   React 19  +  Vite 8  +  TypeScript                          │
│                                                               │
│   ┌─────────────┐ ┌─────────────┐ ┌─────────────┐             │
│   │ Pages       │ │ Components  │ │ Zustand     │             │
│   │ employee/   │ │ shadcn/ui   │ │ stores      │             │
│   │ manager/    │ │ Recharts    │ │ auth,       │             │
│   │ admin/      │ │ Tailwind    │ │ goalSheet,  │             │
│   │             │ │             │ │ manager,    │             │
│   │             │ │             │ │ reports,    │             │
│   │             │ │             │ │ analytics   │             │
│   └─────────────┘ └─────────────┘ └─────────────┘             │
│                                                               │
│   ── supabase-js client (auth + REST + Realtime) ──           │
└─────────────────────────────┬─────────────────────────────────┘
                              │ HTTPS — JWT bearer
                              ▼
```

### Layer 3 — Backend (single box, Supabase managed)

```
┌───────────────────────────────────────────────────────────────┐
│  ☁️  Supabase (managed Postgres + Auth, free tier)            │
│  ───────────────────────────────────────────────────────────  │
│                                                               │
│   ┌────────────┐    ┌─────────────────────────────────────┐   │
│   │ Auth       │    │ Postgres                            │   │
│   │ email/pwd  │    │                                     │   │
│   │ JWT tokens │    │ Tables:                             │   │
│   │ auth.users │◄──►│   profiles                          │   │
│   └────────────┘    │   goal_sheets                       │   │
│                     │   goals                             │   │
│                     │   shared_goals                      │   │
│                     │   check_ins                         │   │
│                     │   audit_logs                        │   │
│                     │   escalation_rules · escalations    │   │
│                     │                                     │   │
│                     │ Triggers:                           │   │
│                     │   handle_new_user                   │   │
│                     │   enforce_goal_cap (max 8)          │   │
│                     │   enforce_shared_goal_lock          │   │
│                     │   touch_updated_at                  │   │
│                     │                                     │   │
│                     │ RPCs:                               │   │
│                     │   admin_delete_user (SECURITY       │   │
│                     │     DEFINER)                        │   │
│                     │   update_admin · set_my_email_      │   │
│                     │     immediate                       │   │
│                     │   get_completion_report             │   │
│                     │                                     │   │
│                     │ View:                               │   │
│                     │   analytics_summary                 │   │
│                     │                                     │   │
│                     │ Edge Functions (Deno):              │   │
│                     │   notify — Gmail SMTP +             │   │
│                     │     Teams webhook                   │   │
│                     │   evaluate-escalations — daily      │   │
│                     │     pg_cron, fires notify per match │   │
│                     │                                     │   │
│                     │ ── Row Level Security on every      │   │
│                     │    table (auth.uid() + role check)  │   │
│                     └─────────────────────────────────────┘   │
└───────────────────────────────────────────────────────────────┘
```

### Side annotation (right of Layer 3, single box)

```
┌──────────────────────┐
│ Security boundary    │
│                      │
│ • RLS enforces       │
│   data isolation     │
│ • No custom backend  │
│ • Publishable (anon) │
│   key in client      │
│ • SECURITY DEFINER   │
│   for admin ops      │
└──────────────────────┘
```

---

## Steps to draw in Excalidraw

1. Open https://excalidraw.com
2. Three rows of rectangles top-to-bottom (Users / Frontend / Backend)
3. Use the rectangle + text tools — round corners on shape style
4. Color suggestion: Users = blue, Frontend = green, Backend = orange (or stick with mono)
5. Arrows from Users → Frontend → Backend
6. Add the side annotation box on the right
7. **Top of page heading:** "AtomAlign — Architecture"
8. **Bottom-right of page:** small text "AtomQuest Hackathon 1.0 · Vaibhav"
9. File → Export image → PNG → check "Embed scene" off → Download
10. Save as `context/architecture.png`

---

## Key things the diagram should communicate

- **Three distinct user roles** with clearly different responsibilities
- **No custom backend** — Netlify only hosts static files; all logic is in Postgres + Supabase Edge Functions
- **RLS is the security boundary**, not application code
- **Free-tier stack** — single Supabase project + Netlify free hosting, ~$0 infra cost (relevant to evaluation criterion #6 cost optimisation)
- **Vite static build** → CDN-edge delivery via Netlify = fast page loads
