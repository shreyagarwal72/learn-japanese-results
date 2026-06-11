import { createFileRoute, Link } from "@tanstack/react-router";
import { useCallback, useEffect, useMemo, useState } from "react";
import { useServerFn } from "@tanstack/react-start";
import * as XLSX from "xlsx";
import {
  adminVerifyPassword,
  adminListTests, adminCreateTest, adminUpdateTest, adminDeleteTest,
  adminListQuestions, adminSaveQuestions, adminListAttempts,
  adminListAudit, adminLogExport,
  type AuditEntry,
} from "@/lib/admin-tests.functions";
import { gradeColorClass } from "@/lib/config";

export const Route = createFileRoute("/admin")({
  head: () => ({ meta: [{ title: "Admin — Japanese Learning For All" }, { name: "robots", content: "noindex" }] }),
  component: AdminPage,
});

const PW_KEY = "jl_admin_pw";
const LABEL_KEY = "jl_admin_label";
const getPw = () => (typeof window !== "undefined" ? sessionStorage.getItem(PW_KEY) ?? "" : "");
const setPw = (pw: string) => sessionStorage.setItem(PW_KEY, pw);
const clearPw = () => { sessionStorage.removeItem(PW_KEY); sessionStorage.removeItem(LABEL_KEY); };
const getLabel = () => (typeof window !== "undefined" ? sessionStorage.getItem(LABEL_KEY) ?? "admin" : "admin");
const setLabel = (l: string) => sessionStorage.setItem(LABEL_KEY, l);
const auth = () => ({ password: getPw(), actorLabel: getLabel() });

function AdminPage() {
  const [ready, setReady] = useState(false);
  const [authed, setAuthed] = useState(false);
  const verify = useServerFn(adminVerifyPassword);

  useEffect(() => {
    const pw = getPw();
    if (!pw) { setReady(true); return; }
    verify({ data: { password: pw } })
      .then(() => setAuthed(true))
      .catch(() => clearPw())
      .finally(() => setReady(true));
  }, [verify]);

  if (!ready) return null;
  if (!authed) return <PasswordGate onOk={() => setAuthed(true)} />;
  return <AdminDashboard onSignOut={() => { clearPw(); setAuthed(false); }} />;
}

function PasswordGate({ onOk }: { onOk: () => void }) {
  const verify = useServerFn(adminVerifyPassword);
  const [pw, setPwState] = useState("");
  const [label, setLabelState] = useState(getLabel() === "admin" ? "" : getLabel());
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<string | null>(null);

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    setBusy(true); setErr(null);
    try {
      const actorLabel = label.trim() || "admin";
      await verify({ data: { password: pw, actorLabel } });
      setPw(pw);
      setLabel(actorLabel);
      onOk();
    } catch (e) {
      setErr(e instanceof Error ? e.message : "Invalid password");
    } finally { setBusy(false); }
  };

  return (
    <div className="min-h-screen bg-background text-foreground">
      <div className="mx-auto flex min-h-screen max-w-sm flex-col justify-center px-5 py-12">
        <Link to="/" className="text-xs uppercase tracking-[0.3em] text-muted-foreground hover:text-accent">← Home</Link>
        <header className="mt-8 text-center">
          <p className="font-serif-jp text-sm tracking-[0.3em] text-muted-foreground">管理</p>
          <h1 className="mt-2 text-2xl font-serif-jp">Admin Access</h1>
          <span className="accent-line mx-auto mt-3" />
        </header>
        <form onSubmit={submit} className="mt-8 space-y-4 border border-border bg-card p-6">
          <label className="block">
            <span className="text-xs uppercase tracking-[0.2em] text-muted-foreground">Your name / initials</span>
            <input
              type="text" autoFocus value={label} maxLength={80}
              placeholder="e.g. Riya M."
              onChange={(e) => setLabelState(e.target.value)}
              className="mt-2 w-full border-b border-border bg-transparent px-1 py-2 text-sm outline-none focus:border-accent"
            />
            <span className="mt-1 block text-[10px] text-muted-foreground">Recorded on every action in the audit log.</span>
          </label>
          <label className="block">
            <span className="text-xs uppercase tracking-[0.2em] text-muted-foreground">Password</span>
            <input
              type="password" value={pw}
              onChange={(e) => setPwState(e.target.value)}
              className="mt-2 w-full border-b border-border bg-transparent px-1 py-2 text-sm outline-none focus:border-accent"
            />
          </label>
          {err && <p className="text-xs text-destructive">{err}</p>}
          <button type="submit" disabled={busy || !pw} className="w-full bg-foreground py-3 text-xs uppercase tracking-[0.2em] text-background hover:bg-accent disabled:opacity-60">
            {busy ? "Verifying…" : "Enter"}
          </button>
        </form>
      </div>
    </div>
  );
}

type Test = Awaited<ReturnType<typeof adminListTests>>[number];
type Question = Awaited<ReturnType<typeof adminListQuestions>>[number];
type Attempt = Awaited<ReturnType<typeof adminListAttempts>>[number];
type Tab = "tests" | "questions" | "attempts";

function AdminDashboard({ onSignOut }: { onSignOut: () => void }) {
  const [tab, setTab] = useState<Tab>("tests");
  const [tests, setTests] = useState<Test[]>([]);
  const [selectedTestId, setSelectedTestId] = useState<string | null>(null);
  const [err, setErr] = useState<string | null>(null);

  const listTests = useServerFn(adminListTests);
  const reload = useCallback(async () => {
    try {
      const rows = await listTests({ data: auth() });
      setTests(rows);
      setSelectedTestId((prev) => prev && rows.some(r => r.id === prev) ? prev : (rows[0]?.id ?? null));
    } catch (e) {
      setErr(e instanceof Error ? e.message : "Failed to load");
    }
  }, [listTests]);

  useEffect(() => { void reload(); }, [reload]);

  return (
    <div className="min-h-screen bg-background text-foreground">
      <div className="mx-auto max-w-6xl px-4 py-6 sm:px-8 sm:py-10">
        <div className="flex items-center justify-between gap-3">
          <Link to="/" className="text-xs uppercase tracking-[0.3em] text-muted-foreground hover:text-accent">← Site</Link>
          <button onClick={onSignOut} className="text-xs uppercase tracking-[0.2em] text-muted-foreground hover:text-accent">Lock</button>
        </div>
        <header className="mt-6">
          <p className="font-serif-jp text-sm tracking-[0.3em] text-muted-foreground">管理</p>
          <h1 className="mt-1 text-2xl sm:text-3xl font-serif-jp">Admin Panel</h1>
          <span className="accent-line mt-3 block" />
        </header>

        <nav className="mt-6 flex flex-wrap gap-2 border-b border-border">
          {(["tests", "questions", "attempts"] as const).map((t) => (
            <button
              key={t}
              onClick={() => setTab(t)}
              className={`px-4 py-2 text-xs uppercase tracking-[0.2em] border-b-2 -mb-px ${tab === t ? "border-accent text-accent" : "border-transparent text-muted-foreground hover:text-foreground"}`}
            >{t}</button>
          ))}
        </nav>

        {err && <p className="mt-4 border border-destructive/30 bg-destructive/5 p-3 text-sm text-destructive">{err}</p>}

        {tests.length > 0 && (tab === "questions" || tab === "attempts") && (
          <div className="mt-6">
            <label className="text-xs uppercase tracking-[0.2em] text-muted-foreground">Test</label>
            <select
              value={selectedTestId ?? ""}
              onChange={(e) => setSelectedTestId(e.target.value)}
              className="ml-3 border border-border bg-card px-3 py-2 text-sm"
            >
              {tests.map((t) => <option key={t.id} value={t.id}>{t.title}</option>)}
            </select>
          </div>
        )}

        <div className="mt-6">
          {tab === "tests" && <TestsTab tests={tests} onChange={reload} />}
          {tab === "questions" && selectedTestId && <QuestionsTab key={selectedTestId} testId={selectedTestId} />}
          {tab === "attempts" && selectedTestId && <AttemptsTab key={selectedTestId} testId={selectedTestId} test={tests.find(t => t.id === selectedTestId)} />}
          {tab !== "tests" && tests.length === 0 && (
            <p className="text-sm text-muted-foreground">Create a test first.</p>
          )}
        </div>
      </div>
    </div>
  );
}

// -------- Tests tab --------

function statusOf(t: Test): { label: string; tone: string } {
  const now = Date.now();
  const from = new Date(t.available_from).getTime();
  const until = new Date(t.available_until).getTime();
  if (now < from) return { label: "Scheduled", tone: "text-muted-foreground border-border" };
  if (now > until) return { label: "Closed", tone: "text-muted-foreground border-border" };
  return { label: "Live", tone: "text-accent border-accent" };
}

function TestsTab({ tests, onChange }: { tests: Test[]; onChange: () => void }) {
  const [editing, setEditing] = useState<Test | "new" | null>(null);
  const del = useServerFn(adminDeleteTest);

  return (
    <section>
      <div className="flex items-center justify-between">
        <h2 className="text-sm uppercase tracking-[0.2em] text-muted-foreground">All Tests</h2>
        <button onClick={() => setEditing("new")} className="bg-foreground px-4 py-2 text-xs uppercase tracking-[0.2em] text-background hover:bg-accent">+ New Test</button>
      </div>

      <ul className="mt-4 space-y-2">
        {tests.length === 0 && <li className="border border-border bg-card p-4 text-sm text-muted-foreground">No tests yet. Click "+ New Test" to schedule one.</li>}
        {tests.map((t) => {
          const s = statusOf(t);
          return (
            <li key={t.id} className="border border-border bg-card p-4">
              <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
                <div className="min-w-0">
                  <div className="flex items-center gap-2">
                    <p className="font-serif-jp text-base truncate">{t.title}</p>
                    <span className={`shrink-0 border px-2 py-0.5 text-[10px] uppercase tracking-[0.2em] ${s.tone}`}>{s.label}</span>
                  </div>
                  <p className="mt-1 text-xs text-muted-foreground">
                    {Math.round(t.duration_seconds / 60)} min · {new Date(t.available_from).toLocaleString()} → {new Date(t.available_until).toLocaleString()}
                  </p>
                </div>
                <div className="flex gap-2">
                  <button onClick={() => setEditing(t)} className="border border-border px-3 py-1.5 text-xs uppercase tracking-[0.2em] hover:border-accent hover:text-accent">Edit</button>
                  <button
                    onClick={async () => {
                      if (!confirm(`Delete "${t.title}"? This removes all questions and attempts.`)) return;
                      await del({ data: { id: t.id, ...auth() } });
                      onChange();
                    }}
                    className="border border-destructive/40 px-3 py-1.5 text-xs uppercase tracking-[0.2em] text-destructive hover:bg-destructive/10"
                  >Delete</button>
                </div>
              </div>
            </li>
          );
        })}
      </ul>

      {editing && <TestEditor test={editing === "new" ? null : editing} onClose={() => setEditing(null)} onSaved={() => { setEditing(null); onChange(); }} />}
    </section>
  );
}

function toLocalInput(iso: string) {
  const d = new Date(iso);
  const pad = (n: number) => String(n).padStart(2, "0");
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`;
}

function TestEditor({ test, onClose, onSaved }: { test: Test | null; onClose: () => void; onSaved: () => void }) {
  const create = useServerFn(adminCreateTest);
  const update = useServerFn(adminUpdateTest);
  const now = new Date();
  const oneHr = new Date(now.getTime() + 60 * 60 * 1000);
  const [title, setTitle] = useState(test?.title ?? "");
  const [description, setDescription] = useState(test?.description ?? "");
  const [duration, setDuration] = useState(test ? Math.round(test.duration_seconds / 60) : 30);
  const [from, setFrom] = useState(test ? toLocalInput(test.available_from) : toLocalInput(now.toISOString()));
  const [until, setUntil] = useState(test ? toLocalInput(test.available_until) : toLocalInput(oneHr.toISOString()));
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<string | null>(null);

  const save = async () => {
    setErr(null);
    if (new Date(until) <= new Date(from)) { setErr("Close time must be after open time."); return; }
    setBusy(true);
    try {
      const payload = {
        title, description: description || null,
        duration_seconds: Math.max(30, Math.round(duration * 60)),
        available_from: new Date(from).toISOString(),
        available_until: new Date(until).toISOString(),
      };
      const password = getPw();
      if (test) await update({ data: { id: test.id, password, ...payload } });
      else await create({ data: { password, ...payload } });
      onSaved();
    } catch (e) {
      setErr(e instanceof Error ? e.message : "Save failed");
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4" onClick={onClose}>
      <div className="w-full max-w-lg border border-border bg-card p-6" onClick={(e) => e.stopPropagation()}>
        <h3 className="font-serif-jp text-xl">{test ? "Edit Test" : "Schedule New Test"}</h3>
        <p className="mt-1 text-xs text-muted-foreground">Test auto-publishes to the home page during its window.</p>
        <div className="mt-4 space-y-3">
          <Input label="Title" value={title} onChange={setTitle} />
          <label className="block">
            <span className="text-xs uppercase tracking-[0.2em] text-muted-foreground">Description</span>
            <textarea value={description ?? ""} onChange={(e) => setDescription(e.target.value)} rows={2}
              className="mt-2 w-full border border-border bg-transparent px-2 py-2 text-sm outline-none focus:border-accent" />
          </label>
          <div className="grid grid-cols-2 gap-3">
            <Input label="Duration (min)" type="number" value={String(duration)} onChange={(v) => setDuration(Number(v))} />
            <div />
            <Input label="Opens at" type="datetime-local" value={from} onChange={setFrom} />
            <Input label="Closes at" type="datetime-local" value={until} onChange={setUntil} />
          </div>
        </div>
        {err && <p className="mt-3 text-xs text-destructive">{err}</p>}
        <div className="mt-6 flex justify-end gap-2">
          <button onClick={onClose} className="border border-border px-4 py-2 text-xs uppercase tracking-[0.2em]">Cancel</button>
          <button onClick={save} disabled={busy || !title} className="bg-foreground px-4 py-2 text-xs uppercase tracking-[0.2em] text-background hover:bg-accent disabled:opacity-60">{busy ? "Saving…" : "Save"}</button>
        </div>
      </div>
    </div>
  );
}

function Input({ label, value, onChange, type = "text" }: { label: string; value: string; onChange: (v: string) => void; type?: string }) {
  return (
    <label className="block">
      <span className="text-xs uppercase tracking-[0.2em] text-muted-foreground">{label}</span>
      <input type={type} value={value} onChange={(e) => onChange(e.target.value)}
        className="mt-2 w-full border-b border-border bg-transparent px-1 py-2 text-sm outline-none focus:border-accent" />
    </label>
  );
}

// -------- Questions tab --------

type DraftOption = { id: string; text: string };
type DraftQuestion = { id?: string; position: number; prompt: string; options: DraftOption[]; correct_option_id: string; marks: number };

function QuestionsTab({ testId }: { testId: string }) {
  const list = useServerFn(adminListQuestions);
  const save = useServerFn(adminSaveQuestions);
  const [items, setItems] = useState<DraftQuestion[] | null>(null);
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState<string | null>(null);

  useEffect(() => {
    list({ data: { testId, ...auth() } }).then((rows: Question[]) =>
      setItems(rows.map((r) => ({
        id: r.id, position: r.position, prompt: r.prompt,
        options: r.options as DraftOption[], correct_option_id: r.correct_option_id, marks: r.marks,
      }))));
  }, [list, testId]);

  if (!items) return <p className="text-sm text-muted-foreground">Loading…</p>;

  const addQ = () => setItems([...items, {
    position: items.length, prompt: "", marks: 1,
    options: [{ id: "a", text: "" }, { id: "b", text: "" }, { id: "c", text: "" }, { id: "d", text: "" }],
    correct_option_id: "a",
  }]);

  const upd = (i: number, patch: Partial<DraftQuestion>) => {
    const next = items.slice();
    next[i] = { ...next[i], ...patch };
    setItems(next);
  };
  const del = (i: number) => setItems(items.filter((_, j) => j !== i).map((q, j) => ({ ...q, position: j })));

  const onSave = async () => {
    setBusy(true); setMsg(null);
    try {
      await save({ data: { testId, ...auth(), questions: items.map((q, i) => ({ ...q, position: i })) } });
      setMsg("Saved.");
    } catch (e) {
      setMsg(e instanceof Error ? e.message : "Save failed");
    } finally { setBusy(false); }
  };

  return (
    <section>
      <div className="flex items-center justify-between">
        <h2 className="text-sm uppercase tracking-[0.2em] text-muted-foreground">Questions ({items.length})</h2>
        <div className="flex gap-2">
          <button onClick={addQ} className="border border-border px-3 py-2 text-xs uppercase tracking-[0.2em] hover:border-accent hover:text-accent">+ Add</button>
          <button onClick={onSave} disabled={busy} className="bg-foreground px-4 py-2 text-xs uppercase tracking-[0.2em] text-background hover:bg-accent disabled:opacity-60">{busy ? "Saving…" : "Save All"}</button>
        </div>
      </div>
      {msg && <p className="mt-3 text-xs text-muted-foreground">{msg}</p>}

      <ol className="mt-4 space-y-4">
        {items.length === 0 && <li className="border border-border bg-card p-4 text-sm text-muted-foreground">No questions yet. Click "+ Add" to create one.</li>}
        {items.map((q, i) => (
          <li key={i} className="border border-border bg-card p-4">
            <div className="flex items-start justify-between gap-3">
              <p className="text-xs uppercase tracking-[0.2em] text-muted-foreground">Q{i + 1}</p>
              <button onClick={() => del(i)} className="text-xs uppercase tracking-[0.2em] text-destructive hover:underline">Remove</button>
            </div>
            <textarea
              value={q.prompt} onChange={(e) => upd(i, { prompt: e.target.value })}
              placeholder="Question prompt" rows={2}
              className="mt-2 w-full border border-border bg-transparent px-2 py-2 text-sm outline-none focus:border-accent"
            />
            <div className="mt-3 grid gap-2">
              {q.options.map((o, oi) => (
                <div key={o.id} className="flex items-center gap-2">
                  <input
                    type="radio" name={`correct-${i}`} checked={q.correct_option_id === o.id}
                    onChange={() => upd(i, { correct_option_id: o.id })}
                  />
                  <span className="w-6 text-xs uppercase text-muted-foreground">{o.id})</span>
                  <input
                    value={o.text}
                    onChange={(e) => {
                      const opts = q.options.slice(); opts[oi] = { ...o, text: e.target.value };
                      upd(i, { options: opts });
                    }}
                    placeholder="Option text"
                    className="flex-1 border-b border-border bg-transparent px-1 py-1 text-sm outline-none focus:border-accent"
                  />
                </div>
              ))}
            </div>
            <div className="mt-3">
              <label className="text-xs uppercase tracking-[0.2em] text-muted-foreground">
                Marks
                <input
                  type="number" min={1} value={q.marks}
                  onChange={(e) => upd(i, { marks: Math.max(1, Number(e.target.value) || 1) })}
                  className="ml-3 w-20 border-b border-border bg-transparent px-1 py-1 text-sm outline-none focus:border-accent"
                />
              </label>
            </div>
          </li>
        ))}
      </ol>
    </section>
  );
}

// -------- Attempts tab --------

function AttemptsTab({ testId, test }: { testId: string; test?: Test }) {
  const list = useServerFn(adminListAttempts);
  const [rows, setRows] = useState<Attempt[] | null>(null);

  useEffect(() => { list({ data: { testId, ...auth() } }).then(setRows); }, [list, testId]);

  const ranked = useMemo(() => {
    if (!rows) return [];
    const submitted = rows.filter((r) => r.submitted_at);
    let lp: number | null = null, lr = 0;
    return submitted.map((r, i) => {
      const pct = Number(r.percentage ?? 0);
      const rank = lp !== null && pct === lp ? lr : i + 1;
      lp = pct; lr = rank;
      return { ...r, rank, percentage: pct };
    });
  }, [rows]);

  const exportXlsx = () => {
    const sheet = ranked.map((r) => ({
      Rank: r.rank, Name: r.student_name, Score: r.score, Total: r.total,
      "Percentage (%)": Number((r.percentage ?? 0).toFixed(2)), Grade: r.grade,
      "Submitted At": r.submitted_at ? new Date(r.submitted_at).toLocaleString() : "",
    }));
    const ws = XLSX.utils.json_to_sheet(sheet);
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, "Attempts");
    XLSX.writeFile(wb, `attempts-${(test?.title ?? "test").replace(/\s+/g, "_")}-${new Date().toISOString().slice(0, 10)}.xlsx`);
  };

  if (!rows) return <p className="text-sm text-muted-foreground">Loading…</p>;

  return (
    <section>
      <div className="flex items-center justify-between">
        <h2 className="text-sm uppercase tracking-[0.2em] text-muted-foreground">Attempts ({ranked.length})</h2>
        <button onClick={exportXlsx} disabled={ranked.length === 0} className="bg-foreground px-4 py-2 text-xs uppercase tracking-[0.2em] text-background hover:bg-accent disabled:opacity-60">Export XLSX</button>
      </div>

      <div className="mt-4 overflow-x-auto border border-border">
        <table className="w-full text-sm">
          <thead className="bg-secondary text-left text-xs uppercase tracking-[0.15em] text-muted-foreground">
            <tr>
              <th className="px-3 py-2 font-normal">Rank</th>
              <th className="px-3 py-2 font-normal">Name</th>
              <th className="px-3 py-2 font-normal">Score</th>
              <th className="px-3 py-2 font-normal">%</th>
              <th className="px-3 py-2 font-normal">Grade</th>
              <th className="px-3 py-2 font-normal">Submitted</th>
            </tr>
          </thead>
          <tbody>
            {ranked.length === 0 ? (
              <tr><td colSpan={6} className="px-3 py-8 text-center text-muted-foreground">No submissions yet.</td></tr>
            ) : ranked.map((r) => (
              <tr key={r.id} className="border-t border-border">
                <td className="px-3 py-2">{r.rank}</td>
                <td className="px-3 py-2">{r.student_name}</td>
                <td className="px-3 py-2 text-muted-foreground">{r.score} / {r.total}</td>
                <td className="px-3 py-2">{r.percentage.toFixed(1)}%</td>
                <td className={`px-3 py-2 font-serif-jp text-lg ${gradeColorClass((r.grade ?? "F") as "S" | "A" | "B" | "C" | "D" | "F")}`}>{r.grade}</td>
                <td className="px-3 py-2 text-muted-foreground">{r.submitted_at ? new Date(r.submitted_at).toLocaleString() : "—"}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </section>
  );
}
