import { createFileRoute, Link } from "@tanstack/react-router";
import { useEffect, useState, useCallback } from "react";
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

const ADMIN_PASSWORD = (import.meta.env.VITE_ADMIN_PASSWORD as string | undefined) ?? "jlfa2025";
const STORAGE_KEY = "jlfa_admin_ok";

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
  const [authed, setAuthed] = useState<boolean>(() => {
    if (typeof window === "undefined") return false;
    return sessionStorage.getItem(STORAGE_KEY) === "1";
  });
  const [pw, setPw] = useState("");
  const [error, setError] = useState<string | null>(null);

  const onSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (pw === ADMIN_PASSWORD) {
      sessionStorage.setItem(STORAGE_KEY, "1");
      setAuthed(true);
      setError(null);
    } else {
      setError("Incorrect password.");
    }
  };

  if (!authed) {
    return (
      <div className="min-h-screen bg-background text-foreground">
        <div className="mx-auto max-w-sm px-5 py-10 sm:px-8">
          <Link to="/" className="text-xs uppercase tracking-[0.3em] text-muted-foreground hover:text-accent">
            ← Back
          </Link>
          <div className="mt-16 border border-border bg-card p-6 sm:p-8">
            <p className="text-center font-serif-jp text-sm tracking-[0.3em] text-muted-foreground">管理者</p>
            <h1 className="mt-2 text-center text-2xl font-serif-jp">Admin Access</h1>
            <span className="accent-line mx-auto mt-4" />
            <form onSubmit={onSubmit} className="mt-8 space-y-4">
              <label className="block">
                <span className="text-xs uppercase tracking-[0.2em] text-muted-foreground">Password</span>
                <input
                  type="password"
                  required
                  autoFocus
                  value={pw}
                  onChange={(e) => setPw(e.target.value)}
                  className="mt-2 w-full border-b border-border bg-transparent px-1 py-2 outline-none focus:border-accent"
                  autoComplete="current-password"
                />
              </label>
              {error && <p className="text-xs text-destructive">{error}</p>}
              <button
                type="submit"
                className="w-full bg-foreground py-3 text-sm font-medium uppercase tracking-[0.2em] text-background hover:bg-accent"
              >
                Enter
              </button>
            </form>
          </div>
        </div>
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
            onClick={() => {
              sessionStorage.removeItem(STORAGE_KEY);
              setAuthed(false);
              setPw("");
            }}
            className="text-xs uppercase tracking-[0.2em] text-muted-foreground hover:text-accent"
          >
            Log Out
          </button>
        </div>
        <Dashboard />
      </div>
    </div>
  );
}

function Dashboard() {
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
