import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useEffect, useState, useCallback } from "react";
import type { User } from "@supabase/supabase-js";
import { supabase } from "@/integrations/supabase/client";
import { gradeColorClass } from "@/lib/config";

export const Route = createFileRoute("/admin")({
  head: () => ({
    meta: [
      { title: "Admin — Japanese Learning For All" },
      { name: "description", content: "Admin panel for viewing all submitted Japanese test results." },
      { name: "robots", content: "noindex" },
    ],
  }),
  component: AdminPage,
});

type ResultRow = {
  id: string;
  name: string;
  total_marks: number;
  marks_obtained: number;
  percentage: number;
  grade: "S" | "A" | "B" | "C" | "F";
  submitted_at: string;
};

function AdminPage() {
  const navigate = useNavigate();
  const [user, setUser] = useState<User | null>(null);
  const [isAdmin, setIsAdmin] = useState<boolean | null>(null);
  const [loadingAuth, setLoadingAuth] = useState(true);

  const checkRole = useCallback(async (uid: string) => {
    const { data, error } = await supabase
      .from("user_roles")
      .select("role")
      .eq("user_id", uid)
      .eq("role", "admin")
      .maybeSingle();
    setIsAdmin(!error && !!data);
  }, []);

  useEffect(() => {
    let cancelled = false;
    supabase.auth.getSession().then(({ data }) => {
      if (cancelled) return;
      const u = data.session?.user ?? null;
      setUser(u);
      if (u) checkRole(u.id);
      else setIsAdmin(false);
      setLoadingAuth(false);
    });
    const { data: sub } = supabase.auth.onAuthStateChange((_evt, session) => {
      const u = session?.user ?? null;
      setUser(u);
      if (u) checkRole(u.id);
      else setIsAdmin(false);
    });
    return () => {
      cancelled = true;
      sub.subscription.unsubscribe();
    };
  }, [checkRole]);

  if (loadingAuth) {
    return (
      <div className="min-h-screen bg-background text-foreground flex items-center justify-center">
        <p className="text-sm text-muted-foreground">Loading…</p>
      </div>
    );
  }

  if (!user) {
    return (
      <div className="min-h-screen bg-background text-foreground flex items-center justify-center px-5">
        <div className="max-w-sm text-center">
          <p className="font-serif-jp text-sm tracking-[0.3em] text-muted-foreground">管理者</p>
          <h1 className="mt-2 text-2xl font-serif-jp">Admin Access</h1>
          <p className="mt-4 text-sm text-muted-foreground">You need to sign in to view the admin panel.</p>
          <button
            onClick={() => navigate({ to: "/auth" })}
            className="mt-6 bg-foreground px-6 py-3 text-xs uppercase tracking-[0.2em] text-background hover:bg-accent"
          >
            Sign In
          </button>
        </div>
      </div>
    );
  }

  if (isAdmin === false) {
    return (
      <div className="min-h-screen bg-background text-foreground flex items-center justify-center px-5">
        <div className="max-w-sm text-center">
          <p className="font-serif-jp text-sm tracking-[0.3em] text-muted-foreground">権限なし</p>
          <h1 className="mt-2 text-2xl font-serif-jp">Not Authorized</h1>
          <p className="mt-4 text-sm text-muted-foreground">
            Signed in as <span className="text-foreground">{user.email}</span>, but you don't have admin access.
          </p>
          <div className="mt-6 flex flex-col gap-2 sm:flex-row sm:justify-center">
            <Link to="/" className="border border-border px-4 py-2 text-xs uppercase tracking-[0.2em] hover:border-accent hover:text-accent">
              Home
            </Link>
            <button
              onClick={async () => {
                await supabase.auth.signOut();
                navigate({ to: "/auth" });
              }}
              className="bg-foreground px-4 py-2 text-xs uppercase tracking-[0.2em] text-background hover:bg-accent"
            >
              Sign Out
            </button>
          </div>
        </div>
      </div>
    );
  }

  if (isAdmin === null) {
    return (
      <div className="min-h-screen bg-background text-foreground flex items-center justify-center">
        <p className="text-sm text-muted-foreground">Checking permissions…</p>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background text-foreground">
      <div className="mx-auto max-w-6xl px-4 py-8 sm:px-8 sm:py-10">
        <div className="flex items-center justify-between gap-3">
          <Link to="/" className="text-xs uppercase tracking-[0.3em] text-muted-foreground hover:text-accent">
            ← Back
          </Link>
          <button
            onClick={async () => {
              await supabase.auth.signOut();
              navigate({ to: "/auth" });
            }}
            className="text-xs uppercase tracking-[0.2em] text-muted-foreground hover:text-accent"
          >
            Sign Out
          </button>
        </div>
        <Dashboard userEmail={user.email ?? ""} />
      </div>
    </div>
  );
}

function Dashboard({ userEmail }: { userEmail: string }) {
  const [rows, setRows] = useState<ResultRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    const { data, error } = await supabase
      .from("results")
      .select("*")
      .order("submitted_at", { ascending: false })
      .limit(1000);
    if (error) {
      setError(error.message);
      setRows([]);
    } else {
      setRows((data ?? []) as ResultRow[]);
    }
    setLoading(false);
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  const exportCsv = () => {
    const header = ["#", "Name", "Marks Obtained", "Total Marks", "Percentage", "Grade", "Submitted At"];
    const lines = [header.join(",")];
    rows.forEach((r, i) => {
      const cells = [
        String(i + 1),
        csvCell(r.name),
        String(r.marks_obtained),
        String(r.total_marks),
        Number(r.percentage).toFixed(2),
        r.grade,
        new Date(r.submitted_at).toISOString(),
      ];
      lines.push(cells.join(","));
    });
    const blob = new Blob([lines.join("\n")], { type: "text/csv;charset=utf-8;" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `results-${new Date().toISOString().slice(0, 10)}.csv`;
    a.click();
    URL.revokeObjectURL(url);
  };

  return (
    <div className="mt-6 sm:mt-8">
      <header className="mb-6 sm:mb-8">
        <p className="font-serif-jp text-sm tracking-[0.3em] text-muted-foreground">提出物</p>
        <h1 className="mt-2 text-xl sm:text-3xl font-serif-jp">Admin Panel — All Submissions</h1>
        <span className="accent-line mt-4 block" />
        <p className="mt-3 text-xs text-muted-foreground truncate">Signed in as {userEmail}</p>
      </header>

      <div className="mb-6 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <p className="text-sm text-muted-foreground">
          Total submissions: <span className="font-medium text-foreground">{rows.length}</span>
        </p>
        <div className="flex flex-wrap gap-2">
          <button
            onClick={load}
            disabled={loading}
            className="flex-1 sm:flex-none border border-border px-4 py-2 text-xs uppercase tracking-[0.2em] hover:border-accent hover:text-accent disabled:opacity-60"
          >
            {loading ? "Refreshing…" : "Refresh"}
          </button>
          <button
            onClick={exportCsv}
            disabled={rows.length === 0}
            className="flex-1 sm:flex-none bg-foreground px-4 py-2 text-xs uppercase tracking-[0.2em] text-background hover:bg-accent disabled:opacity-60"
          >
            Export CSV
          </button>
        </div>
      </div>

      {error && (
        <div className="mb-4 border border-destructive/30 bg-destructive/5 p-4 text-sm text-destructive">
          {error}
        </div>
      )}

      {/* Desktop / tablet: table */}
      <div className="hidden md:block overflow-x-auto border border-border">
        <table className="w-full text-sm">
          <thead className="bg-secondary text-left text-xs uppercase tracking-[0.15em] text-muted-foreground">
            <tr>
              <th className="px-4 py-3 font-normal">#</th>
              <th className="px-4 py-3 font-normal">Name</th>
              <th className="px-4 py-3 font-normal">Obtained</th>
              <th className="px-4 py-3 font-normal">Total</th>
              <th className="px-4 py-3 font-normal">Percentage</th>
              <th className="px-4 py-3 font-normal">Grade</th>
              <th className="px-4 py-3 font-normal">Date</th>
            </tr>
          </thead>
          <tbody>
            {loading && rows.length === 0 ? (
              <tr><td colSpan={7} className="px-4 py-12 text-center text-muted-foreground">Loading…</td></tr>
            ) : rows.length === 0 ? (
              <tr><td colSpan={7} className="px-4 py-12 text-center text-muted-foreground">No submissions yet.</td></tr>
            ) : (
              rows.map((r, i) => (
                <tr key={r.id} className="border-t border-border">
                  <td className="px-4 py-3 text-muted-foreground">{i + 1}</td>
                  <td className="px-4 py-3 text-foreground">{r.name}</td>
                  <td className="px-4 py-3">{r.marks_obtained}</td>
                  <td className="px-4 py-3">{r.total_marks}</td>
                  <td className="px-4 py-3">{Number(r.percentage).toFixed(2)}%</td>
                  <td className={`px-4 py-3 font-serif-jp text-lg ${gradeColorClass(r.grade)}`}>{r.grade}</td>
                  <td className="px-4 py-3 text-muted-foreground">{new Date(r.submitted_at).toLocaleString()}</td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>

      {/* Mobile: cards */}
      <div className="md:hidden space-y-3">
        {loading && rows.length === 0 ? (
          <p className="border border-border p-6 text-center text-sm text-muted-foreground">Loading…</p>
        ) : rows.length === 0 ? (
          <p className="border border-border p-6 text-center text-sm text-muted-foreground">No submissions yet.</p>
        ) : (
          rows.map((r, i) => (
            <div key={r.id} className="border border-border p-4">
              <div className="flex items-start justify-between gap-3">
                <div className="min-w-0 flex-1">
                  <p className="text-xs text-muted-foreground">#{i + 1}</p>
                  <p className="mt-1 text-sm font-medium text-foreground break-words">{r.name}</p>
                </div>
                <div className={`font-serif-jp text-3xl leading-none ${gradeColorClass(r.grade)}`}>{r.grade}</div>
              </div>
              <div className="mt-3 grid grid-cols-2 gap-2 text-xs">
                <div>
                  <p className="text-muted-foreground uppercase tracking-[0.15em]">Score</p>
                  <p className="mt-1 text-foreground">{r.marks_obtained} / {r.total_marks}</p>
                </div>
                <div>
                  <p className="text-muted-foreground uppercase tracking-[0.15em]">Percentage</p>
                  <p className="mt-1 text-foreground">{Number(r.percentage).toFixed(2)}%</p>
                </div>
              </div>
              <p className="mt-3 text-[11px] text-muted-foreground">
                {new Date(r.submitted_at).toLocaleString()}
              </p>
            </div>
          ))
        )}
      </div>
    </div>
  );
}

function csvCell(s: string) {
  if (s.includes(",") || s.includes('"') || s.includes("\n")) {
    return `"${s.replace(/"/g, '""')}"`;
  }
  return s;
}
