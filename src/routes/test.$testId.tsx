import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { useServerFn } from "@tanstack/react-start";
import { getTestMeta, startAttempt, type AvailableTest } from "@/lib/tests.functions";

export const Route = createFileRoute("/test/$testId")({
  head: () => ({ meta: [{ title: "Start Test — Japanese Learning For All" }, { name: "robots", content: "noindex" }] }),
  component: PreTest,
});

function PreTest() {
  const { testId } = Route.useParams();
  const navigate = useNavigate();
  const fetchMeta = useServerFn(getTestMeta);
  const beginFn = useServerFn(startAttempt);
  const [meta, setMeta] = useState<{ test: AvailableTest; questionCount: number } | null>(null);
  const [err, setErr] = useState<string | null>(null);
  const [name, setName] = useState("");
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    fetchMeta({ data: { testId } }).then(setMeta).catch((e: unknown) => setErr(e instanceof Error ? e.message : "Failed to load test"));
  }, [fetchMeta, testId]);

  const onBegin = async (e: React.FormEvent) => {
    e.preventDefault();
    setErr(null);
    if (!name.trim()) { setErr("Enter your name to begin."); return; }
    setBusy(true);
    try {
      const r = await beginFn({ data: { testId, studentName: name.trim() } });
      sessionStorage.setItem(`attempt:${r.attemptId}`, JSON.stringify(r));
      navigate({ to: "/test/$testId/attempt/$attemptId", params: { testId, attemptId: r.attemptId } });
    } catch (e) {
      setErr(e instanceof Error ? e.message : "Could not start test");
    } finally {
      setBusy(false);
    }
  };


  return (
    <div className="min-h-screen bg-background text-foreground">
      <div className="mx-auto max-w-xl px-5 py-10 sm:px-8 sm:py-16">
        <Link to="/" className="text-xs uppercase tracking-[0.3em] text-muted-foreground hover:text-accent">← Home</Link>
        <div className="mt-8 border border-border bg-card p-6 sm:p-10">
          {err && !meta && <p className="text-sm text-destructive">{err}</p>}
          {!meta && !err && <p className="text-sm text-muted-foreground">Loading test…</p>}
          {meta && (
            <>
              <p className="font-serif-jp text-sm tracking-[0.3em] text-muted-foreground">試験</p>
              <h1 className="mt-2 font-serif-jp text-2xl">{meta.test.title}</h1>
              <span className="accent-line mt-4 block" />
              {meta.test.description && <p className="mt-4 text-sm text-muted-foreground">{meta.test.description}</p>}
              <dl className="mt-6 grid grid-cols-2 gap-3 text-xs">
                <Stat label="Duration" value={`${Math.round(meta.test.duration_seconds / 60)} min`} />
                <Stat label="Questions" value={String(meta.questionCount)} />
                <Stat label="Opens" value={new Date(meta.test.available_from).toLocaleString()} />
                <Stat label="Closes" value={new Date(meta.test.available_until).toLocaleString()} />
              </dl>

              <form onSubmit={onBegin} className="mt-8 space-y-4">
                <label className="block">
                  <span className="text-xs uppercase tracking-[0.2em] text-muted-foreground">Your Name</span>
                  <input
                    value={name}
                    onChange={(e) => setName(e.target.value)}
                    placeholder="e.g. Sato Yuki"
                    className="mt-2 w-full border-b border-border bg-transparent px-1 py-2 outline-none focus:border-accent"
                  />
                </label>
                {err && <p className="text-xs text-destructive">{err}</p>}
                <p className="text-xs text-muted-foreground">
                  Timer starts the moment you click <b>Begin</b>. Don't close the tab — auto-submits at zero.
                </p>
                <button
                  type="submit"
                  disabled={busy || meta.questionCount === 0}
                  className="w-full bg-foreground py-3 text-sm uppercase tracking-[0.2em] text-background hover:bg-accent disabled:opacity-60"
                >
                  {busy ? "Starting…" : meta.questionCount === 0 ? "No questions yet" : "Begin Test"}
                </button>
              </form>
            </>
          )}
        </div>
      </div>
    </div>
  );
}

function Stat({ label, value }: { label: string; value: string }) {
  return (
    <div className="border border-border p-3">
      <p className="text-[10px] uppercase tracking-[0.2em] text-muted-foreground">{label}</p>
      <p className="mt-1 text-foreground">{value}</p>
    </div>
  );
}
