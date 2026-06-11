import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { useServerFn } from "@tanstack/react-start";
import { listAvailableTests, type AvailableTest } from "@/lib/tests.functions";

export const Route = createFileRoute("/")({
  head: () => ({
    meta: [
      { title: "Japanese Learning For All — Live Timed Japanese Tests" },
      { name: "description", content: "Take live, timed Japanese MCQ tests online. Auto-graded with letter grades; leaderboards unlock the next morning at 9 AM IST." },
      { property: "og:title", content: "Japanese Learning For All — Live Timed Japanese Tests" },
      { property: "og:description", content: "Take live, timed Japanese MCQ tests online. Leaderboards unlock the next morning." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
    ],
    links: [{ rel: "canonical", href: "/" }],
  }),
  component: Home,
});

function Home() {
  const fetchTests = useServerFn(listAvailableTests);
  const [tests, setTests] = useState<AvailableTest[] | null>(null);
  const [err, setErr] = useState<string | null>(null);

  useEffect(() => {
    fetchTests().then(setTests).catch((e: unknown) => setErr(e instanceof Error ? e.message : "Failed to load tests"));
  }, [fetchTests]);

  return (
    <div className="min-h-screen bg-background text-foreground">
      <main className="mx-auto flex min-h-screen max-w-2xl flex-col px-5 py-12 sm:px-8 sm:py-16">
        <header className="text-center">
          <p className="font-serif-jp text-sm tracking-[0.3em] text-muted-foreground">日本語学習</p>
          <h1 className="mt-3 text-3xl sm:text-4xl font-serif-jp">Japanese Learning For All</h1>
          <span className="accent-line mx-auto mt-5" />
          <p className="mt-5 text-base text-muted-foreground">Take a live, timed test. Submit before time runs out.</p>
        </header>

        <section className="mt-10">
          <h2 className="text-xs uppercase tracking-[0.25em] text-muted-foreground">Available now</h2>
          {err && <p className="mt-4 border border-destructive/30 bg-destructive/5 p-3 text-sm text-destructive">{err}</p>}
          {tests === null && !err && <p className="mt-4 text-sm text-muted-foreground">Loading…</p>}
          {tests && tests.length === 0 && (
            <p className="mt-6 border border-border bg-card p-6 text-center text-sm text-muted-foreground">
              No tests are open right now. Check back soon.
            </p>
          )}
          {tests && tests.length > 0 && (
            <ul className="mt-4 space-y-3">
              {tests.map((t) => <TestCard key={t.id} t={t} />)}
            </ul>
          )}
        </section>

        <footer className="mt-16 flex items-center justify-center gap-6">
          <Link to="/leaderboard" className="text-xs uppercase tracking-[0.3em] text-muted-foreground hover:text-accent">Leaderboard</Link>
          <Link to="/admin" className="text-xs uppercase tracking-[0.3em] text-muted-foreground hover:text-accent">Admin</Link>
        </footer>
      </main>
    </div>
  );
}

function TestCard({ t }: { t: AvailableTest }) {
  const navigate = useNavigate();
  const mins = Math.round(t.duration_seconds / 60);
  return (
    <li className="border border-border bg-card p-5 sm:p-6">
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div className="min-w-0">
          <p className="font-serif-jp text-lg text-foreground">{t.title}</p>
          {t.description && <p className="mt-1 text-sm text-muted-foreground">{t.description}</p>}
          <p className="mt-2 text-xs uppercase tracking-[0.2em] text-muted-foreground">
            {mins} min · closes {new Date(t.available_until).toLocaleString()}
          </p>
        </div>
        <button
          onClick={() => navigate({ to: "/test/$testId", params: { testId: t.id } })}
          className="bg-foreground px-5 py-3 text-xs uppercase tracking-[0.2em] text-background hover:bg-accent"
        >
          Start Test
        </button>
      </div>
    </li>
  );
}
