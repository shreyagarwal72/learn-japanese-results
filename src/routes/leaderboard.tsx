import { createFileRoute, Link } from "@tanstack/react-router";
import { useEffect, useMemo, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { gradeColorClass } from "@/lib/config";

export const Route = createFileRoute("/leaderboard")({
  head: () => ({
    meta: [
      { title: "Leaderboard — Japanese Learning For All" },
      { name: "description", content: "Daily leaderboard of Japanese test results — unlocks every day at 9 AM." },
    ],
  }),
  component: LeaderboardPage,
});

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

// Daily public unlock time (local browser time).
const UNLOCK_HOUR = 9;

function isUnlocked(now: Date) {
  return now.getHours() >= UNLOCK_HOUR;
}

function nextUnlock(now: Date) {
  const target = new Date(now);
  target.setHours(UNLOCK_HOUR, 0, 0, 0);
  if (now.getHours() >= UNLOCK_HOUR) target.setDate(target.getDate() + 1);
  return target;
}

function formatCountdown(ms: number) {
  if (ms <= 0) return "00:00:00";
  const s = Math.floor(ms / 1000);
  const h = String(Math.floor(s / 3600)).padStart(2, "0");
  const m = String(Math.floor((s % 3600) / 60)).padStart(2, "0");
  const sec = String(s % 60).padStart(2, "0");
  return `${h}:${m}:${sec}`;
}

function LeaderboardPage() {
  const [now, setNow] = useState(() => new Date());

  useEffect(() => {
    const id = setInterval(() => setNow(new Date()), 1000);
    return () => clearInterval(id);
  }, []);

  const unlocked = isUnlocked(now);

  if (!unlocked) {
    const target = nextUnlock(now);
    const remaining = target.getTime() - now.getTime();
    return (
      <div className="min-h-screen bg-background text-foreground">
        <main className="mx-auto flex min-h-screen max-w-md flex-col items-center justify-center px-5 py-16 text-center">
          <Link to="/" className="text-xs uppercase tracking-[0.3em] text-muted-foreground hover:text-accent">
            ← Home
          </Link>
          <p className="mt-12 font-serif-jp text-sm tracking-[0.3em] text-muted-foreground">順位表</p>
          <h1 className="mt-2 text-3xl font-serif-jp">Leaderboard Locked</h1>
          <span className="accent-line mx-auto mt-5" />
          <p className="mt-6 text-sm text-muted-foreground">
            The public leaderboard opens daily at 9:00 AM.
          </p>
          <div className="mt-8 border border-border bg-card px-8 py-6">
            <p className="text-[10px] uppercase tracking-[0.3em] text-muted-foreground">Opens In</p>
            <p className="mt-2 font-serif-jp text-4xl tabular-nums text-foreground">
              {formatCountdown(remaining)}
            </p>
          </div>
        </main>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background text-foreground">
      <main className="mx-auto max-w-4xl px-4 py-10 sm:px-8">
        <Link to="/" className="text-xs uppercase tracking-[0.3em] text-muted-foreground hover:text-accent">
          ← Home
        </Link>
        <header className="mt-8 text-center">
          <p className="font-serif-jp text-sm tracking-[0.3em] text-muted-foreground">順位表</p>
          <h1 className="mt-2 text-3xl sm:text-4xl font-serif-jp">Leaderboard</h1>
          <span className="accent-line mx-auto mt-5" />
          <p className="mt-3 text-sm text-muted-foreground">Today's rankings · updated live</p>
        </header>
        <LeaderboardList />
      </main>
    </div>
  );
}

function LeaderboardList() {
  const [rows, setRows] = useState<ResultRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      setLoading(true);
      const { data, error } = await supabase
        .from("results")
        .select("*")
        .order("submitted_at", { ascending: false })
        .limit(1000);
      if (cancelled) return;
      if (error) {
        setError(error.message);
        setRows([]);
      } else {
        setRows((data ?? []) as ResultRow[]);
      }
      setLoading(false);
    })();
    return () => { cancelled = true; };
  }, []);

  const ranked = useMemo<RankedRow[]>(() => {
    const sorted = rows.slice().sort((a, b) => {
      if (b.percentage !== a.percentage) return b.percentage - a.percentage;
      return new Date(a.submitted_at).getTime() - new Date(b.submitted_at).getTime();
    });
    let lastPct: number | null = null;
    let lastRank = 0;
    return sorted.map((r, i) => {
      const rank = lastPct !== null && r.percentage === lastPct ? lastRank : i + 1;
      lastPct = r.percentage;
      lastRank = rank;
      return { ...r, rank };
    });
  }, [rows]);

  if (loading) {
    return <p className="mt-10 text-center text-sm text-muted-foreground">Loading…</p>;
  }
  if (error) {
    return (
      <p className="mt-10 border border-destructive/30 bg-destructive/5 p-4 text-center text-sm text-destructive">
        {error}
      </p>
    );
  }
  if (ranked.length === 0) {
    return <p className="mt-10 text-center text-sm text-muted-foreground">No submissions yet.</p>;
  }

  return (
    <ol className="mt-8 space-y-2">
      {ranked.map((r) => (
        <li
          key={r.id}
          className={`flex items-center gap-4 border border-border px-4 py-3 ${rowHighlight(r.rank)}`}
        >
          <RankBadge rank={r.rank} />
          <div className="min-w-0 flex-1">
            <p className="truncate text-sm font-medium text-foreground">{r.name}</p>
            <p className="mt-1 text-xs text-muted-foreground">
              {r.marks_obtained} / {r.total_marks} · {Number(r.percentage).toFixed(1)}%
            </p>
          </div>
          <div className={`font-serif-jp text-2xl ${gradeColorClass(r.grade)}`}>{r.grade}</div>
        </li>
      ))}
    </ol>
  );
}

function RankBadge({ rank }: { rank: number }) {
  if (rank === 1) return <span className="inline-flex h-9 w-9 items-center justify-center rounded-full bg-yellow-500/15 text-base">🥇</span>;
  if (rank === 2) return <span className="inline-flex h-9 w-9 items-center justify-center rounded-full bg-zinc-400/15 text-base">🥈</span>;
  if (rank === 3) return <span className="inline-flex h-9 w-9 items-center justify-center rounded-full bg-amber-700/15 text-base">🥉</span>;
  return (
    <span className="inline-flex h-9 w-9 items-center justify-center rounded-full border border-border text-xs text-muted-foreground">
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
