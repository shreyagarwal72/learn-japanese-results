import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";

export const Route = createFileRoute("/auth")({
  head: () => ({
    meta: [
      { title: "Admin Sign In — Japanese Learning For All" },
      { name: "robots", content: "noindex" },
    ],
  }),
  component: AuthPage,
});

function AuthPage() {
  const navigate = useNavigate();
  const [mode, setMode] = useState<"signin" | "signup">("signin");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    supabase.auth.getSession().then(({ data }) => {
      if (data.session) navigate({ to: "/admin", replace: true });
    });
  }, [navigate]);

  const onSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setBusy(true);
    setError(null);
    try {
      if (mode === "signin") {
        const { error } = await supabase.auth.signInWithPassword({ email, password });
        if (error) throw error;
        toast.success("Signed in");
        navigate({ to: "/admin", replace: true });
      } else {
        const { error } = await supabase.auth.signUp({
          email,
          password,
          options: { emailRedirectTo: `${window.location.origin}/admin` },
        });
        if (error) throw error;
        toast.success("Account created. Check your email if confirmation is required, then sign in.");
        setMode("signin");
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : "Authentication failed");
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="min-h-screen bg-background text-foreground">
      <div className="mx-auto max-w-sm px-5 py-10 sm:px-8">
        <Link to="/" className="text-xs uppercase tracking-[0.3em] text-muted-foreground hover:text-accent">
          ← Back
        </Link>

        <div className="mt-16 border border-border bg-card p-6 sm:p-8">
          <p className="text-center font-serif-jp text-sm tracking-[0.3em] text-muted-foreground">管理者</p>
          <h1 className="mt-2 text-center text-2xl font-serif-jp">
            {mode === "signin" ? "Admin Sign In" : "Create Admin Account"}
          </h1>
          <span className="accent-line mx-auto mt-4" />

          <form onSubmit={onSubmit} className="mt-8 space-y-4">
            <label className="block">
              <span className="text-xs uppercase tracking-[0.2em] text-muted-foreground">Email</span>
              <input
                type="email"
                required
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                className="mt-2 w-full border-b border-border bg-transparent px-1 py-2 outline-none focus:border-accent"
                autoComplete="email"
              />
            </label>
            <label className="block">
              <span className="text-xs uppercase tracking-[0.2em] text-muted-foreground">Password</span>
              <input
                type="password"
                required
                minLength={6}
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                className="mt-2 w-full border-b border-border bg-transparent px-1 py-2 outline-none focus:border-accent"
                autoComplete={mode === "signin" ? "current-password" : "new-password"}
              />
            </label>

            {error && <p className="text-xs text-destructive">{error}</p>}

            <button
              type="submit"
              disabled={busy}
              className="w-full bg-foreground py-3 text-sm font-medium uppercase tracking-[0.2em] text-background hover:bg-accent disabled:opacity-60"
            >
              {busy ? "Please wait…" : mode === "signin" ? "Sign In" : "Sign Up"}
            </button>
          </form>

          <button
            type="button"
            onClick={() => {
              setMode(mode === "signin" ? "signup" : "signin");
              setError(null);
            }}
            className="mt-6 block w-full text-center text-xs uppercase tracking-[0.2em] text-muted-foreground hover:text-accent"
          >
            {mode === "signin" ? "Need an account? Sign up" : "Have an account? Sign in"}
          </button>
        </div>

        <p className="mt-6 text-center text-xs text-muted-foreground">
          After signing up, an existing admin must grant you the admin role before you can access the admin panel.
        </p>
      </div>
    </div>
  );
}
