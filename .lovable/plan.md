# Japanese Learning For All — Build Plan

## Stack

React (TanStack Start template already in place) + Tailwind v4 + Lovable Cloud (Supabase). No extra deps needed beyond what's installed.

## Design system (src/styles.css)

- Background `#ffffff`, foreground near-black `#111111`, accent red `#C0392B`, muted grey for secondary text.
- Fonts loaded via Google Fonts `<link>` in `__root.tsx` head: "Noto Serif JP" (headings, `font-serif-jp`), "DM Sans" (body, default).
- Reusable decorative element: a thin 40px red horizontal line (`<span class="block h-px w-10 bg-[--accent]" />`) placed under headings.
- Generous whitespace, no gradients, no shadows beyond a soft 1px border on the card.

## Routes

- `/` — `src/routes/index.tsx` — submission page
- `/admin` — `src/routes/admin.tsx` — password gate + dashboard

No navbar. Small grey "Admin" link at the bottom of `/`. "← Back" link top-left on `/admin`.

## Database (Lovable Cloud / Supabase)

Migration creates `public.results`:

- `id` uuid pk default `gen_random_uuid()`
- `name` text not null
- `total_marks` int not null
- `marks_obtained` int not null
- `percentage` numeric(5,2) not null
- `grade` text not null
- `submitted_at` timestamptz not null default `now()`

Grants + RLS:

- `GRANT SELECT, INSERT ON public.results TO anon, authenticated;`
- RLS enabled. Policies: anyone can INSERT; anyone can SELECT (the admin gate is the password — acceptable per the spec, which says "simple hardcoded password check on the frontend").

Client: use existing `@/integrations/supabase/client` (browser client, anon key). No server functions needed.

## Home page (`/`)

- Centered card (max-w-md, 1px border, generous padding).
- Heading "Japanese Learning For All" in Noto Serif JP + red accent line + subheading "Submit Your Test Results".
- If GitHub config has an `activeTest` with `name`/`totalMarks`, prefill and lock the Total Marks field and show the test name above the form. Otherwise Total Marks is editable.
- Fields: Student Name, Total Marks, Marks Obtained. Inline validation (zod):
  - All fields required (non-empty, trimmed name).
  - Total Marks > 0.
  - 0 ≤ Marks Obtained ≤ Total Marks.
- On submit: compute percentage (2 decimals) and grade via threshold table from config (with built-in defaults: S 90+, A 75+, B 60+, C 40+, F <40). Insert into `results`. Show success toast.
- Result panel below form: percentage, grade letter, Japanese label, and motivational message (from config, defaults provided in spec). Grade letter color-coded (S dark green, A green, B blue, C orange, F red) using semantic tokens.

## Admin page (`/admin`)

- Password screen (single input). On submit, compare to `"jlfa2025"`; on match, set local state to show dashboard. No persistence.
- Dashboard:
  - Heading "Admin Panel — All Submissions" + red accent line.
  - Total count + Refresh button + Export CSV button.
  - Table columns: #, Name, Marks Obtained, Total Marks, Percentage, Grade (color-coded badge), Date (formatted).
  - Data fetched via `supabase.from('results').select('*').order('submitted_at', { ascending: false })`.
  - CSV export builds a Blob from currently loaded rows and triggers download (`results-YYYY-MM-DD.csv`).
- Mobile: table wrapped in horizontal scroll container; padding tightened.

## GitHub-hosted JSON config

- One source of truth for both test info and site content.
- Fetched on every page load (no cache) from a raw GitHub URL.
- Default URL constant: `https://raw.githubusercontent.com/shreyagarwal72/jlfa-config/main/config.json` (overridable via `VITE_CONFIG_URL` env var if you want).
- Shape:
  ```json
  {
    "activeTest": { "name": "Test 1 — Hiragana", "totalMarks": 100 },
    "site": {
      "title": "Japanese Learning For All",
      "subtitle": "Submit Your Test Results"
    },
    "grades": [
      { "min": 90, "letter": "S", "jp": "優秀", "en": "Excellent", "message": "素晴らしい！継続してください！" },
      { "min": 75, "letter": "A", "jp": "良い", "en": "Good", "message": "よくできました！" },
      { "min": 60, "letter": "B", "jp": "普通", "en": "Average", "message": "いい調子です！" },
      { "min": 40, "letter": "C", "jp": "もう少し", "en": "Needs Improvement", "message": "もっと頑張れます！" },
      { "min": 0,  "letter": "F", "jp": "不合格", "en": "Fail", "message": "あきらめないで！" }
    ]
  }
  ```
- A `useConfig()` hook uses TanStack Query (`staleTime: 0`) to fetch on each mount; falls back to hard-coded defaults if the fetch fails so the site never breaks.
- README note included with the exact repo/file path the user needs to create on GitHub for live updates.

## Mobile responsiveness

- Card switches to full-width with side padding under `sm`.
- Admin table wrapped in `overflow-x-auto`.
- Buttons stack on small screens.

## Files to create/modify

- `src/styles.css` — tokens + Noto Serif JP/DM Sans utility classes
- `src/routes/__root.tsx` — Google Fonts link tags
- `src/routes/index.tsx` — submission page
- `src/routes/admin.tsx` — password gate + dashboard
- `src/lib/config.ts` — GitHub JSON fetcher + defaults + `useConfig` hook
- `src/lib/grading.ts` — percentage/grade helpers
- Migration creating `public.results` table with grants + RLS

## Out of scope

- No server functions, no auth, no edit/delete in admin.
- Password gate is intentionally client-side per the spec.