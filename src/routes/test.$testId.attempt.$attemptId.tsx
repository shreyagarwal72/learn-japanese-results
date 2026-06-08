import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useEffect, useMemo, useRef, useState } from "react";
import { useServerFn } from "@tanstack/react-start";
import { submitAttempt, type PublicQuestion } from "@/lib/tests.functions";
import { SITE_CONFIG, gradeFor, gradeColorClass } from "@/lib/config";


export const Route = createFileRoute("/test/$testId/attempt/$attemptId")({
  head: () => ({ meta: [{ title: "Live Test — Japanese Learning For All" }, { name: "robots", content: "noindex" }] }),
  component: LiveTest,
});

type AttemptData = {
  attemptId: string;
  attemptSecret: string;
  startedAt: string;
  deadline: string;
  durationSeconds: number;
  questions: PublicQuestion[];
  total: number;
  title: string;
};


function LiveTest() {
  const { testId, attemptId } = Route.useParams();
  const navigate = useNavigate();
  const submitFn = useServerFn(submitAttempt);

  // We rely on session-storage to remember the attempt payload across reloads
  // (server doesn't expose questions after start). If missing, send user back to /test/$testId.
  const storageKey = `attempt:${attemptId}`;
  const [data, setData] = useState<AttemptData | null>(() => {
    if (typeof window === "undefined") return null;
    const raw = sessionStorage.getItem(storageKey);
    if (!raw) return null;
    try { return JSON.parse(raw) as AttemptData; } catch { return null; }
  });

  useEffect(() => {
    if (!data) {
      navigate({ to: "/test/$testId", params: { testId }, replace: true });
    }
  }, [data, navigate, testId]);

  if (!data) return null;
  return <TestRunner storageKey={storageKey} data={data} attemptId={attemptId} attemptSecret={data.attemptSecret} onFinish={() => sessionStorage.removeItem(storageKey)} submitFn={submitFn} />;
}

// Stash data when /test/$testId starts an attempt — but routes don't share state.
// Workaround: pre-test page navigates here AFTER calling startAttempt; persist via
// a tiny global handoff using sessionStorage keyed by attempt id, populated from
// the pre-test page navigation. To keep the diff small, we duplicate the call there.
// (Implemented in test.$testId.tsx update below.)

type Result = { score: number; total: number; percentage: number; grade: string; late: boolean };

function TestRunner({
  data, attemptId, attemptSecret, storageKey, onFinish, submitFn,
}: {
  data: { questions: PublicQuestion[]; deadline: string; title: string; total: number };
  attemptId: string;
  attemptSecret: string;
  storageKey: string;
  onFinish: () => void;
  submitFn: ReturnType<typeof useServerFn<typeof submitAttempt>>;
}) {
  const [answers, setAnswers] = useState<Record<string, string>>({});
  const [now, setNow] = useState(() => Date.now());
  const [submitting, setSubmitting] = useState(false);
  const [result, setResult] = useState<Result | null>(null);
  const [err, setErr] = useState<string | null>(null);
  const submitted = useRef(false);

  const deadlineMs = useMemo(() => new Date(data.deadline).getTime(), [data.deadline]);
  const remainingMs = Math.max(0, deadlineMs - now);

  useEffect(() => {
    const id = setInterval(() => setNow(Date.now()), 500);
    return () => clearInterval(id);
  }, []);

  const doSubmit = async (auto = false) => {
    if (submitted.current) return;
    submitted.current = true;
    setSubmitting(true);
    setErr(null);
    try {
      const r = await submitFn({ data: { attemptId, attemptSecret, answers } });
      setResult(r);
      onFinish();
    } catch (e) {
      submitted.current = false;
      setErr(e instanceof Error ? e.message : "Submit failed");
      if (!auto) setSubmitting(false);
    } finally {
      if (auto) setSubmitting(false);
    }
  };

  useEffect(() => {
    if (remainingMs === 0 && !submitted.current && !result) {
      void doSubmit(true);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [remainingMs]);

  if (result) {
    const grade = SITE_CONFIG.grades.find((g) => g.letter === result.grade) ?? gradeFor(result.score, SITE_CONFIG.grades);
    return (
      <div className="min-h-screen bg-background text-foreground">
        <main className="mx-auto max-w-md px-5 py-16 text-center">
          <p className="font-serif-jp text-sm tracking-[0.3em] text-muted-foreground">結果</p>
          <h1 className="mt-2 font-serif-jp text-3xl">{data.title}</h1>
          <span className="accent-line mx-auto mt-5" />
          <p className="mt-6 font-serif-jp text-5xl">{result.score} / {result.total}</p>
          <p className="mt-1 text-sm text-muted-foreground">{result.percentage.toFixed(2)}%</p>
          <p className={`mt-4 font-serif-jp text-4xl ${gradeColorClass(grade.letter)}`}>{grade.letter}</p>
          <p className="mt-2 text-sm text-muted-foreground"><span className="font-serif-jp">{grade.jp}</span> · {grade.en}</p>
          <div className="mx-auto mt-6 max-w-xs border border-accent/30 bg-secondary p-4">
            <p className="text-[10px] uppercase tracking-[0.3em] text-muted-foreground">応援メッセージ</p>
            <p className="mt-2 font-serif-jp text-lg">{grade.message}</p>
          </div>
          {result.late && <p className="mt-4 text-xs text-destructive">Submitted after the deadline — no points awarded.</p>}
          <p className="mt-8 text-xs text-muted-foreground">Leaderboard unlocks the next day at 9:00 AM.</p>
          <div className="mt-6 flex justify-center gap-4">
            <Link to="/" className="border border-border px-4 py-2 text-xs uppercase tracking-[0.2em] hover:border-accent hover:text-accent">Home</Link>
            <Link to="/leaderboard" className="bg-foreground px-4 py-2 text-xs uppercase tracking-[0.2em] text-background hover:bg-accent">Leaderboard</Link>
          </div>
        </main>
      </div>
    );
  }

  const mm = String(Math.floor(remainingMs / 60000)).padStart(2, "0");
  const ss = String(Math.floor((remainingMs % 60000) / 1000)).padStart(2, "0");
  const answered = Object.keys(answers).length;

  return (
    <div className="min-h-screen bg-background text-foreground">
      <header className="sticky top-0 z-10 border-b border-border bg-background/95 backdrop-blur">
        <div className="mx-auto flex max-w-3xl items-center justify-between px-4 py-3 sm:px-8">
          <div className="min-w-0">
            <p className="font-serif-jp text-sm truncate">{data.title}</p>
            <p className="text-[11px] uppercase tracking-[0.2em] text-muted-foreground">{answered} / {data.questions.length} answered</p>
          </div>
          <div className={`font-serif-jp text-2xl tabular-nums ${remainingMs < 60_000 ? "text-destructive" : "text-foreground"}`}>
            {mm}:{ss}
          </div>
        </div>
      </header>

      <main className="mx-auto max-w-3xl px-4 py-6 sm:px-8 sm:py-10">
        {err && <p className="mb-4 border border-destructive/30 bg-destructive/5 p-3 text-sm text-destructive">{err}</p>}
        <ol className="space-y-6">
          {data.questions.map((q, i) => (
            <li key={q.id} className="border border-border bg-card p-5">
              <p className="text-xs uppercase tracking-[0.2em] text-muted-foreground">Question {i + 1} · {q.marks} mark{q.marks === 1 ? "" : "s"}</p>
              <p className="mt-2 text-base text-foreground whitespace-pre-wrap">{q.prompt}</p>
              <div className="mt-4 space-y-2">
                {q.options.map((o) => {
                  const checked = answers[q.id] === o.id;
                  return (
                    <label
                      key={o.id}
                      className={`flex cursor-pointer items-start gap-3 border px-3 py-2 ${checked ? "border-accent bg-secondary" : "border-border hover:border-foreground"}`}
                    >
                      <input
                        type="radio"
                        name={q.id}
                        value={o.id}
                        checked={checked}
                        onChange={() => setAnswers((a) => ({ ...a, [q.id]: o.id }))}
                        className="mt-1"
                      />
                      <span className="text-sm">{o.text}</span>
                    </label>
                  );
                })}
              </div>
            </li>
          ))}
        </ol>

        <div className="mt-8 flex flex-col items-stretch gap-3 sm:flex-row sm:items-center sm:justify-end">
          <button
            onClick={() => doSubmit(false)}
            disabled={submitting}
            className="bg-foreground px-6 py-3 text-sm uppercase tracking-[0.2em] text-background hover:bg-accent disabled:opacity-60"
          >
            {submitting ? "Submitting…" : "Submit Test"}
          </button>
        </div>
      </main>
    </div>
  );
}
