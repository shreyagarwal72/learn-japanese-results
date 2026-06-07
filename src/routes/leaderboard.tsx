import { createFileRoute, Link } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { useServerFn } from "@tanstack/react-start";
import { listAllTests, getLeaderboard, type AvailableTest, type LeaderboardRow } from "@/lib/tests.functions";
import { gradeColorClass } from "@/lib/config";

export const Route = createFileRoute("/leaderboard")({
  head: () => ({
    meta: [
      { title: "Leaderboard — Japanese Learning For All" },
      { name: "description", content: "Test leaderboards unlock the next day at 9 AM." },
    ],
  }),
  component: LeaderboardPage,
});

function LeaderboardPage() {
  const fetchTests = useServerFn(listAllTests);
  const [tests, setTests] = useState<AvailableTest[] | null>(null);
  const [selected, setSelected] = useState<string | null>(null);

  useEffect(() => {
    fetchTests().then((rows) => {
      setTests(rows);
      if (rows.length > 0) setSelected(rows[0].id);
    });
  }, [fetchTests]);

  return (
    <div className="min-h-screen bg-background text-foreground">
      <main className="mx-auto max-w-4xl px-4 py-8 sm:px-8 sm:py-12">
        <Link to="/" className="text-xs uppercase tracking-[0.3em] text-muted-foreground hover:text-accent">← Home</Link>
        <header className="mt-6 text-center">
          <p className="font-serif-jp text-sm tracking-[0.3em] text-muted-foreground">順位表</p>
          <h1 className="mt-2 text-3xl sm:text-4xl font-serif-jp">Leaderboard</h1>
          <span className="accent-line mx-auto mt-4" />
          <p className="mt-3 text-sm text-muted-foreground">Each test's results unlock the next day at 9:00 AM.</p>
        </header>

        {tests === null ? (
          <p className="mt-12 text-center text-sm text-muted-foreground">Loading…</p>
        ) : tests.length === 0 ? (
          <p className="mt-12 text-center text-sm text-muted-foreground">No tests yet.</p>
        ) : (
          <>
            <div className="mt-8 flex justify-center">
              <select
                value={selected ?? ""}
                onChange={(e) => setSelected(e.target.value)}
                className="border border-border bg-card px-3 py-2 text-sm"
              >
                {tests.map((t) => (
                  <option key={t.id} value={t.id}>{t.title}</option>
                ))}
              </select>
            </div>
            {selected && <Board key={selected} testId={selected} />}
          </>
        )}
      </main>
    </div>
  );
}

function Board({ testId }: { testId: string }) {
  const fetchBoard = useServerFn(getLeaderboard);
  const [state, setState] = useState<{ locked: boolean; unlocksAt: string; rows: LeaderboardRow[] } | null>(null);
  const [err, setErr] = useState<string | null>(null);
  const [now, setNow] = useState(Date.now());

  useEffect(() => {
    fetchBoard({ data: { testId } }).then((r) => setState({ locked: r.locked, unlocksAt: r.unlocksAt, rows: r.rows }))
      .catch((e: unknown) => setErr(e instanceof Error ? e.message : "Failed to load"));
  }, [fetchBoard, testId]);

  useEffect(() => {
    const id = setInterval(() => setNow(Date.now()), 1000);
    return () => clearInterval(id);
  }, []);

  if (err) return <p className="mt-10 border border-destructive/30 bg-destructive/5 p-4 text-center text-sm text-destructive">{err}</p>;
  if (!state) return <p className="mt-10 text-center text-sm text-muted-foreground">Loading…</p>;

  if (state.locked) {
    const remaining = new Date(state.unlocksAt).getTime() - now;
    return (
      <div className="mt-10 border border-border bg-card p-8 text-center">
        <p className="text-[10px] uppercase tracking-[0.3em] text-muted-foreground">Unlocks In</p>
        <p className="mt-2 font-serif-jp text-4xl tabular-nums">{formatCountdown(remaining)}</p>
        <p className="mt-3 text-xs text-muted-foreground">{new Date(state.unlocksAt).toLocaleString()}</p>
      </div>
    );
  }

  if (state.rows.length === 0) {
    return <p className="mt-10 text-center text-sm text-muted-foreground">No submissions for this test.</p>;
  }

  // dense rank
  let lastPct: number | null = null;
  let lastRank = 0;
  const ranked = state.rows.map((r, i) => {
    const rank = lastPct !== null && r.percentage === lastPct ? lastRank : i + 1;
    lastPct = r.percentage; lastRank = rank;
    return { ...r, rank };
  });

  return (
    <ol className="mt-8 space-y-2">
      {ranked.map((r) => (
        <li key={r.id} className={`flex items-center gap-4 border border-border px-4 py-3 ${rowHighlight(r.rank)}`}>
          <RankBadge rank={r.rank} />
          <div className="min-w-0 flex-1">
            <p className="truncate text-sm font-medium">{r.student_name}</p>
            <p className="mt-1 text-xs text-muted-foreground">{r.score} / {r.total} · {r.percentage.toFixed(1)}%</p>
          </div>
          <div className={`font-serif-jp text-2xl ${gradeColorClass(r.grade as "S" | "A" | "B" | "C" | "D" | "F")}`}>{r.grade}</div>
        </li>
      ))}
    </ol>
  );
}

function formatCountdown(ms: number) {
  if (ms <= 0) return "00:00:00";
  const s = Math.floor(ms / 1000);
  const h = String(Math.floor(s / 3600)).padStart(2, "0");
  const m = String(Math.floor((s % 3600) / 60)).padStart(2, "0");
  const sec = String(s % 60).padStart(2, "0");
  return `${h}:${m}:${sec}`;
}

function RankBadge({ rank }: { rank: number }) {
  if (rank === 1) return <span className="inline-flex h-9 w-9 items-center justify-center rounded-full bg-yellow-500/15 text-base">🥇</span>;
  if (rank === 2) return <span className="inline-flex h-9 w-9 items-center justify-center rounded-full bg-zinc-400/15 text-base">🥈</span>;
  if (rank === 3) return <span className="inline-flex h-9 w-9 items-center justify-center rounded-full bg-amber-700/15 text-base">🥉</span>;
  return <span className="inline-flex h-9 w-9 items-center justify-center rounded-full border border-border text-xs text-muted-foreground">{rank}</span>;
}

function rowHighlight(rank: number) {
  if (rank === 1) return "bg-yellow-500/5";
  if (rank === 2) return "bg-zinc-400/5";
  if (rank === 3) return "bg-amber-700/5";
  return "";
}
