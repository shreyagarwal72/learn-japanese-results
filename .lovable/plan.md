## Goal

Replace the self-reported marks flow with live, auto-graded MCQ tests. Each test has a fixed per-attempt duration; once a student submits (or time runs out), their score is recorded. Each test's leaderboard unlocks at 9 AM the day after the test's end date. Also rotate the admin password.

## Database changes

New tables (in `public`, with grants + RLS):

- `tests` — `id`, `title`, `description`, `duration_seconds`, `available_from`, `available_until`, `created_at`
  - Anon/authenticated SELECT only when `now() between available_from and available_until` (for taking) plus a separate "list active/upcoming" policy. Admin (has_role 'admin') full manage.
- `questions` — `id`, `test_id` (FK), `position`, `prompt`, `options` (jsonb array of {id,text}), `correct_option_id`, `marks` (default 1)
  - Students get a sanitized view (without `correct_option_id`) via a server function — don't expose the answer column directly. Admin manages.
- `attempts` — `id`, `test_id`, `student_name`, `started_at`, `submitted_at`, `score`, `total`, `percentage`, `grade`, `answers` (jsonb)
  - Anyone can INSERT (start) and UPDATE their own attempt by id (returned token). Public SELECT only via a server function that enforces the 9 AM-next-day unlock rule.

Keep the existing `results` table untouched for now (legacy); the new flow writes to `attempts`. Leaderboard reads from `attempts`.

Grade boundaries continue to use raw marks per `src/lib/config.ts`.

## Server functions (`createServerFn`)

In `src/lib/tests.functions.ts`:

- `listAvailableTests()` — returns currently-open tests (no answers).
- `getTestForAttempt({ testId })` — returns test + questions stripped of `correct_option_id`. Validates `available_from/until`.
- `startAttempt({ testId, studentName })` — inserts an `attempts` row, returns `{ attemptId, serverStartedAt, durationSeconds, deadline }`. Deadline = min(started_at + duration, available_until).
- `submitAttempt({ attemptId, answers })` — server recomputes score against `correct_option_id`, enforces deadline (reject/auto-zero late answers past grace), writes score/grade, returns result summary.
- `getLeaderboard({ testId })` — returns rows only if `now() >= (available_until::date + 1 day) at 09:00 local`; otherwise returns `{ locked: true, unlocksAt }`.

Admin-only (uses `requireSupabaseAuth` + `has_role admin`) in `src/lib/admin-tests.functions.ts`:

- `adminListTests`, `adminCreateTest`, `adminUpdateTest`, `adminDeleteTest`
- `adminUpsertQuestions(testId, questions[])`
- `adminListAttempts(testId)` (full leaderboard regardless of unlock)

## Routes

- `/` (home) — lists currently-available tests; "Start test" button. Removes the manual marks form.
- `/test/$testId` — pre-test screen: enter name, shows duration + rules, "Begin".
- `/test/$testId/attempt/$attemptId` — live test UI:
  - Server-authoritative countdown derived from `deadline` (client polls/uses serverStartedAt; no trust in local clock).
  - One question per screen or scrollable list (single scrollable list, mobile-first).
  - Auto-submit when timer hits 0.
  - Result screen after submit with grade + Japanese message (reuses existing grade UI).
- `/leaderboard` — pick a test → shows locked countdown to next-day 9 AM, or full ranked list when unlocked. Keeps current medal/rank styling and CSV/XLSX export.
- `/admin` — gated by Supabase Auth + `admin` role:
  - Tests list (create/edit/delete).
  - Question editor (add/edit MCQs with options + mark correct).
  - Per-test attempts viewer with existing exports.

## Admin password change

Admin auth already uses Supabase Auth (per the auth scaffold). To rotate:

1. Update the `ADMIN_PASSWORD` secret via the secrets tool (used as a seed/fallback only — display only, not in client bundle).
2. Reset the admin user's Supabase Auth password via a one-off SQL `UPDATE auth.users` is not allowed; instead use a server function calling `supabaseAdmin.auth.admin.updateUserById` after the user confirms the new password in the secrets prompt.

I'll ask you for the new password through the secret prompt, then run a server-side update for the admin account.

## Technical notes

- Timer integrity: deadline is computed and stored server-side at `startAttempt`; client just renders countdown to `deadline`. `submitAttempt` rejects answers received after deadline + 5 s grace and auto-zeros missing answers.
- Anti-cheat (light): one attempt per (test_id, student_name lowercased) enforced server-side; tab visibility changes logged in `attempts.answers.meta` (no auto-fail).
- Leaderboard unlock uses UTC date math with a configurable timezone constant (default `Asia/Tokyo`) so "next day 9 AM" is deterministic.
- All MCQ correctness checks happen exclusively in server functions; `correct_option_id` is never sent to the browser.
- RLS denies direct client SELECT of `questions.correct_option_id` and direct SELECT of `attempts` after unlock relies on a `SECURITY DEFINER` view/function — clients never query `attempts` directly.

## Out of scope (confirm if you want them)

- Student accounts / one-attempt-per-user enforcement beyond name match.
- Question images, multi-correct answers, negative marking.
- Per-question time limits.
- No i don't want any of it in out password.
- Also add an option in admin panel to set the full test, also store admin password in backend.