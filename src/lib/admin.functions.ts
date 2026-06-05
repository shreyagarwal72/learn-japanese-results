// Frontend-only admin password check (SPA build — no server runtime).
// Set VITE_ADMIN_PASSWORD in your Vercel env vars to override the default.
// WARNING: anyone can inspect the bundle and see this value. For real
// security use Supabase Auth + a role.
const ADMIN_PASSWORD =
  (import.meta.env.VITE_ADMIN_PASSWORD as string | undefined) || "jlfa2025";

export async function verifyAdminPassword({
  data,
}: {
  data: { password: string };
}): Promise<{ ok: true } | { ok: false; error: string }> {
  if (data.password === ADMIN_PASSWORD) return { ok: true };
  return { ok: false, error: "Incorrect password" };
}
