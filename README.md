# Japanese Learning For All

A timed online testing platform for Japanese language learners. Admins
schedule MCQ tests, students take them by name only, and per-test
leaderboards unlock the next day at 9:00 AM IST.

## Features

- **Scheduled MCQ tests** with a fixed countdown per attempt and a
  publish window (auto-listed on the home page while open).
- **No student auth** — students enter their name and start.
- **Password-only admin** — single shared password, verified server-side
  with a timing-safe comparison.
- **Auto-graded** with percentage + letter grade (S/A/B/C/D/F).
- **Per-test leaderboard** that unlocks at 9:00 AM IST the day after
  the test closes.
- **Admin dashboard** with Tests, Questions, Attempts (XLSX export),
  and a full **Audit Log** of every admin action.

## Tech stack

- **Frontend / SSR:** TanStack Start v1 (React 19, Vite 7)
- **Styling:** Tailwind CSS v4 with semantic design tokens
- **Backend:** Lovable Cloud (Postgres + RLS, edge runtime)
- **Server logic:** `createServerFn` (typed RPC) — no Edge Functions
  for app-internal logic
- **Deployment target:** Cloudflare Workers (edge)

## Project layout

```
src/
  routes/                  TanStack file-based routes
    index.tsx              Home — lists live tests
    test.$testId.tsx       Pre-test landing (name entry)
    test.$testId.attempt.$attemptId.tsx   Timed attempt
    leaderboard.tsx        Per-test leaderboard
    admin.tsx              Password-gated dashboard
  lib/
    tests.functions.ts     Student-facing server fns
    admin-tests.functions.ts  Admin server fns + audit logging
    config.ts              Grade boundaries, site config
  integrations/supabase/   Auto-generated clients (do not edit)
supabase/migrations/       Schema + RLS + audit log
```

## Environment

Server-only secrets (set in Lovable Cloud):

| Name | Purpose |
| --- | --- |
| `ADMIN_PASSWORD` | Shared admin password (timing-safe checked) |
| `SUPABASE_URL` | Backend URL |
| `SUPABASE_SERVICE_ROLE_KEY` | Server-side admin client |
| `LOVABLE_API_KEY` | AI gateway (reserved) |

Client-visible:

| Name | Purpose |
| --- | --- |
| `VITE_SUPABASE_URL` | Public backend URL |
| `VITE_SUPABASE_PUBLISHABLE_KEY` | Public anon key |

## Admin

1. Visit `/admin`.
2. Enter the admin password and an **actor label** (your name or
   initials) — every action you take is recorded in the audit log
   with this label, your IP, and a timestamp.
3. Use the tabs:
   - **Tests** — schedule, edit, delete tests (open/close times,
     duration). Tests auto-publish to the home page during their
     window.
   - **Questions** — add MCQ prompts, 2–8 options, mark the correct
     one, set per-question marks. Save All commits the set.
   - **Attempts** — view ranked results and export to XLSX.
   - **Audit Log** — read-only history of every admin action.

The audit log records: `auth.login`, `test.create`, `test.update`,
`test.delete`, `questions.save`, and `attempts.export`.

## Security model

- **Student-facing reads/writes** all go through `createServerFn`
  handlers using the service role; RLS bypass is intentional and the
  trust boundary is the server function.
- `questions.correct_option_id` is never returned to clients.
- **Attempt integrity:** each `startAttempt` returns a one-time
  `attempt_secret`; `submitAttempt` requires it and compares with
  `crypto.timingSafeEqual`.
- **Admin password** is compared with `crypto.timingSafeEqual` over
  SHA-256 digests.
- **Audit log** is admin-readable via RLS (`has_role`) and
  service-role-writable; entries are immutable from the app.

## Local development

```
bun install
bun run dev
```

Migrations live in `supabase/migrations/` and are applied through the
Lovable Cloud workflow.

## License

Proprietary — internal project.
