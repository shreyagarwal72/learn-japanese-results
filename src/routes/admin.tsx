import { createFileRoute, Link } from "@tanstack/react-router";
import { useEffect, useState, useCallback, useMemo } from "react";
import * as XLSX from "xlsx";
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
  grade: "S" | "A" | "B" | "C" | "D" | "F";
  submitted_at: string;
};

type RankedRow = ResultRow & { rank: number };

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
  const [query, setQuery] = useState("");

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

  // Rank by percentage (desc), tie-break: earlier submission wins.
  const ranked = useMemo<RankedRow[]>(() => {
    const sorted = rows.slice().sort((a, b) => {
      if (b.percentage !== a.percentage) return b.percentage - a.percentage;
      return new Date(a.submitted_at).getTime() - new Date(b.submitted_at).getTime();
    });
    // Dense ranking on percentage (ties share rank).
    let lastPct: number | null = null;
    let lastRank = 0;
    return sorted.map((r, i) => {
      const rank = lastPct !== null && r.percentage === lastPct ? lastRank : i + 1;
      lastPct = r.percentage;
      lastRank = rank;
      return { ...r, rank };
    });
  }, [rows]);

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return ranked;
    return ranked.filter((r) => r.name.toLowerCase().includes(q) || r.grade.toLowerCase() === q);
  }, [ranked, query]);

  const stats = useMemo(() => {
    if (ranked.length === 0) return null;
    const avg = ranked.reduce((s, r) => s + Number(r.percentage), 0) / ranked.length;
    const top = ranked[0];
    const passed = ranked.filter((r) => r.grade !== "F").length;
    return { avg, top, passed, total: ranked.length };
  }, [ranked]);

  const exportXlsx = () => {
    const sheetData = filtered.map((r) => ({
      Rank: r.rank,
      Name: r.name,
      "Marks Obtained": r.marks_obtained,
      "Total Marks": r.total_marks,
      "Percentage (%)": Number(Number(r.percentage).toFixed(2)),
      Grade: r.grade,
      "Submitted At": new Date(r.submitted_at).toLocaleString(),
    }));
    const ws = XLSX.utils.json_to_sheet(sheetData);
    ws["!cols"] = [
      { wch: 6 }, { wch: 28 }, { wch: 14 }, { wch: 12 }, { wch: 14 }, { wch: 8 }, { wch: 22 },
    ];
    // Freeze header row
    ws["!freeze"] = { xSplit: 0, ySplit: 1 } as never;
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, "Leaderboard");
    XLSX.writeFile(wb, `leaderboard-${new Date().toISOString().slice(0, 10)}.xlsx`);
  };

  const exportCsv = () => {
    const header = ["Rank", "Name", "Marks Obtained", "Total Marks", "Percentage", "Grade", "Submitted At"];
    const lines = [header.join(",")];
    filtered.forEach((r) => {
      lines.push([
        String(r.rank),
        csvCell(r.name),
        String(r.marks_obtained),
        String(r.total_marks),
        Number(r.percentage).toFixed(2),
        r.grade,
        new Date(r.submitted_at).toISOString(),
      ].join(","));
    });
    const blob = new Blob(["\ufeff" + lines.join("\n")], { type: "text/csv;charset=utf-8;" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `leaderboard-${new Date().toISOString().slice(0, 10)}.csv`;
    a.click();
    URL.revokeObjectURL(url);
  };

  return (
    <div className="mt-6 sm:mt-8">
      <header className="mb-6 sm:mb-8">
        <p className="font-serif-jp text-sm tracking-[0.3em] text-muted-foreground">順位表</p>
        <h1 className="mt-2 text-xl sm:text-3xl font-serif-jp">Leaderboard</h1>
        <span className="accent-line mt-4 block" />
      </header>

      {/* Stats */}
      {stats && (
        <div className="mb-6 grid grid-cols-2 gap-3 sm:grid-cols-4">
          <StatCard label="Submissions" value={String(stats.total)} />
          <StatCard label="Passed" value={`${stats.passed} / ${stats.total}`} />
          <StatCard label="Average" value={`${stats.avg.toFixed(1)}%`} />
          <StatCard label="Top Score" value={`${Number(stats.top.percentage).toFixed(1)}%`} sub={stats.top.name} />
        </div>
      )}

      {/* Controls */}
      <div className="mb-6 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <input
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          placeholder="Search name or grade (S/A/B/C/F)…"
          className="w-full sm:max-w-xs border-b border-border bg-transparent px-1 py-2 text-sm outline-none focus:border-accent"
        />
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
            disabled={filtered.length === 0}
            className="flex-1 sm:flex-none border border-border px-4 py-2 text-xs uppercase tracking-[0.2em] hover:border-accent hover:text-accent disabled:opacity-60"
          >
            CSV
          </button>
          <button
            onClick={exportXlsx}
            disabled={filtered.length === 0}
            className="flex-1 sm:flex-none bg-foreground px-4 py-2 text-xs uppercase tracking-[0.2em] text-background hover:bg-accent disabled:opacity-60"
          >
            Export XLSX
          </button>
        </div>
      </div>

      {error && (
        <div className="mb-4 border border-destructive/30 bg-destructive/5 p-4 text-sm text-destructive">
          {error}
        </div>
      )}

      {/* Desktop table */}
      <div className="hidden md:block overflow-x-auto border border-border">
        <table className="w-full text-sm">
          <thead className="bg-secondary text-left text-xs uppercase tracking-[0.15em] text-muted-foreground">
            <tr>
              <th className="px-4 py-3 font-normal w-16">Rank</th>
              <th className="px-4 py-3 font-normal">Name</th>
              <th className="px-4 py-3 font-normal">Score</th>
              <th className="px-4 py-3 font-normal">Percentage</th>
              <th className="px-4 py-3 font-normal">Grade</th>
              <th className="px-4 py-3 font-normal">Date</th>
            </tr>
          </thead>
          <tbody>
            {loading && filtered.length === 0 ? (
              <tr><td colSpan={6} className="px-4 py-12 text-center text-muted-foreground">Loading…</td></tr>
            ) : filtered.length === 0 ? (
              <tr><td colSpan={6} className="px-4 py-12 text-center text-muted-foreground">No submissions.</td></tr>
            ) : (
              filtered.map((r) => (
                <tr key={r.id} className={`border-t border-border ${rowHighlight(r.rank)}`}>
                  <td className="px-4 py-3"><RankBadge rank={r.rank} /></td>
                  <td className="px-4 py-3 text-foreground font-medium">{r.name}</td>
                  <td className="px-4 py-3 text-muted-foreground">{r.marks_obtained} / {r.total_marks}</td>
                  <td className="px-4 py-3">{Number(r.percentage).toFixed(2)}%</td>
                  <td className={`px-4 py-3 font-serif-jp text-lg ${gradeColorClass(r.grade)}`}>{r.grade}</td>
                  <td className="px-4 py-3 text-muted-foreground">{new Date(r.submitted_at).toLocaleString()}</td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>

      {/* Mobile cards */}
      <div className="md:hidden space-y-3">
        {loading && filtered.length === 0 ? (
          <p className="border border-border p-6 text-center text-sm text-muted-foreground">Loading…</p>
        ) : filtered.length === 0 ? (
          <p className="border border-border p-6 text-center text-sm text-muted-foreground">No submissions.</p>
        ) : (
          filtered.map((r) => (
            <div key={r.id} className={`border border-border p-4 ${rowHighlight(r.rank)}`}>
              <div className="flex items-start justify-between gap-3">
                <div className="flex items-center gap-3 min-w-0 flex-1">
                  <RankBadge rank={r.rank} />
                  <p className="text-sm font-medium text-foreground break-words">{r.name}</p>
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

function StatCard({ label, value, sub }: { label: string; value: string; sub?: string }) {
  return (
    <div className="border border-border p-4">
      <p className="text-[10px] uppercase tracking-[0.2em] text-muted-foreground">{label}</p>
      <p className="mt-2 text-xl font-serif-jp text-foreground">{value}</p>
      {sub && <p className="mt-1 text-xs text-muted-foreground truncate">{sub}</p>}
    </div>
  );
}

function RankBadge({ rank }: { rank: number }) {
  if (rank === 1) {
    return <span className="inline-flex h-8 w-8 items-center justify-center rounded-full bg-yellow-500/15 text-yellow-500 text-base">🥇</span>;
  }
  if (rank === 2) {
    return <span className="inline-flex h-8 w-8 items-center justify-center rounded-full bg-zinc-400/15 text-zinc-300 text-base">🥈</span>;
  }
  if (rank === 3) {
    return <span className="inline-flex h-8 w-8 items-center justify-center rounded-full bg-amber-700/15 text-amber-600 text-base">🥉</span>;
  }
  return (
    <span className="inline-flex h-8 w-8 items-center justify-center rounded-full border border-border text-xs text-muted-foreground">
      {rank}
    </span>
  );
}

function rowHighlight(rank: number) {
  if (rank === 1) return "bg-yellow-500/5";
  if (rank === 2) return "bg-zinc-400/5";
  if (rank === 3) return "bg-amber-700/5";
  return "";
}

function csvCell(s: string) {
  if (s.includes(",") || s.includes('"') || s.includes("\n")) {
    return `"${s.replace(/"/g, '""')}"`;
  }
  return s;
}
