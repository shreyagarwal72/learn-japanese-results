# Deployment

## Recommended: Lovable Publish (works out of the box)

Click **Publish** in the Lovable editor. You get a working URL at
`*.lovable.app` with:
- Server functions (admin password check via `ADMIN_PASSWORD` secret)
- Supabase database + auth
- The test PDF served from Lovable's CDN

No extra config required.

## Vercel (limited — no server functions)

This project is built with **TanStack Start** (a full-stack framework with
a Nitro server). Vercel's static hosting can serve the client bundle, but
the admin password server function will not work there because the server
runtime isn't deployed.

If you still want to deploy the static frontend to Vercel:

1. In Vercel project settings:
   - **Build command:** `bun run build`
   - **Output directory:** `.output/public`
   - **Install command:** `bun install`
2. The `vercel.json` in this repo already sets these and adds an SPA
   rewrite to `/index.html`.
3. The admin page won't be able to verify the password without the server
   runtime. Either:
   - keep admin-only on Lovable, or
   - move admin auth to Supabase Auth (proper login), or
   - hardcode a frontend-only password (insecure; not recommended).

If your current Vercel URL shows a blank page or error, it's most likely
because Vercel was using the wrong output directory. Update the project's
**Output Directory** to `.output/public` and redeploy.
