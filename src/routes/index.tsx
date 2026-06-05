import { createFileRoute, Link } from "@tanstack/react-router";
import { useMemo, useState } from "react";
import { z } from "zod";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { useConfig, gradeFor, gradeColorClass, type GradeDef } from "@/lib/config";

export const Route = createFileRoute("/")({
  head: () => ({
    meta: [
      { title: "Japanese Learning For All — Submit Results" },
      { name: "description", content: "Submit your Japanese test results and instantly see your percentage and grade." },
    ],
  }),
  component: Index,
});

type FormState = { name: string; total: string; obtained: string };
type FormErrors = Partial<Record<keyof FormState, string>>;

type ResultView = {
  percentage: number;
  grade: GradeDef;
};

function Index() {
  const { data: config } = useConfig();
  const activeTest = config?.activeTest ?? null;

  const [form, setForm] = useState<FormState>({
    name: "",
    total: activeTest ? String(activeTest.totalMarks) : "",
    obtained: "",
  });
  const [errors, setErrors] = useState<FormErrors>({});
  const [submitting, setSubmitting] = useState(false);
  const [result, setResult] = useState<ResultView | null>(null);

  const schema = useMemo(
    () =>
      z
        .object({
          name: z.string().trim().min(1, "Please enter the student name").max(100),
          total: z
            .string()
            .min(1, "Total marks is required")
            .refine((v) => Number.isFinite(Number(v)) && Number(v) > 0, "Total marks must be greater than 0"),
          obtained: z
            .string()
            .min(1, "Marks obtained is required")
            .refine((v) => Number.isFinite(Number(v)) && Number(v) >= 0, "Marks obtained cannot be negative"),
        })
        .refine((d) => Number(d.obtained) <= Number(d.total), {
          message: "Marks obtained cannot exceed total marks",
          path: ["obtained"],
        }),
    [],
  );

  const handleChange = (k: keyof FormState) => (e: React.ChangeEvent<HTMLInputElement>) => {
    setForm((f) => ({ ...f, [k]: e.target.value }));
    setErrors((er) => ({ ...er, [k]: undefined }));
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setResult(null);

    const parsed = schema.safeParse(form);
    if (!parsed.success) {
      const next: FormErrors = {};
      for (const issue of parsed.error.issues) {
        const k = issue.path[0] as keyof FormState | undefined;
        if (k && !next[k]) next[k] = issue.message;
      }
      setErrors(next);
      return;
    }

    const total = Number(parsed.data.total);
    const obtained = Number(parsed.data.obtained);
    const percentage = Math.round(((obtained / total) * 100) * 100) / 100;
    const grade = gradeFor(percentage, config?.grades ?? []);

    setSubmitting(true);
    const { error } = await supabase.from("results").insert({
      name: parsed.data.name.trim(),
      total_marks: total,
      marks_obtained: obtained,
      percentage,
      grade: grade.letter,
    });
    setSubmitting(false);

    if (error) {
      toast.error("Could not save your result. Please try again.");
      return;
    }

    toast.success("Result submitted");
    setResult({ percentage, grade });
  };

  return (
    <div className="min-h-screen bg-background text-foreground">
      <main className="mx-auto flex min-h-screen max-w-xl flex-col items-stretch justify-center px-5 py-16 sm:px-8">
        <header className="mb-10 text-center">
          <p className="font-serif-jp text-sm tracking-[0.3em] text-muted-foreground">日本語学習</p>
          <h1 className="mt-3 text-3xl sm:text-4xl font-serif-jp text-foreground">
            {config?.site.title ?? "Japanese Learning For All"}
          </h1>
          <span className="accent-line mx-auto mt-5" />
          <p className="mt-5 text-base text-muted-foreground">
            {config?.site.subtitle ?? "Submit Your Test Results"}
          </p>
          {activeTest && (
            <p className="mt-3 text-xs uppercase tracking-widest text-muted-foreground">
              Current test · <span className="text-foreground">{activeTest.name}</span>
            </p>
          )}
        </header>

        <section className="border border-border bg-card p-6 sm:p-10">
          <form onSubmit={handleSubmit} className="space-y-6" noValidate>
            <Field
              label="Student Name"
              error={errors.name}
              input={
                <input
                  type="text"
                  value={form.name}
                  onChange={handleChange("name")}
                  placeholder="e.g. Sato Yuki"
                  className="w-full border-b border-border bg-transparent px-1 py-2 text-foreground outline-none focus:border-accent"
                />
              }
            />
            <Field
              label="Total Marks"
              error={errors.total}
              hint={activeTest ? "Set by the current test configuration" : undefined}
              input={
                <input
                  type="number"
                  inputMode="numeric"
                  min={1}
                  value={form.total}
                  onChange={handleChange("total")}
                  placeholder="100"
                  disabled={!!activeTest}
                  className="w-full border-b border-border bg-transparent px-1 py-2 text-foreground outline-none focus:border-accent disabled:cursor-not-allowed disabled:opacity-70"
                />
              }
            />
            <Field
              label="Marks Obtained"
              error={errors.obtained}
              input={
                <input
                  type="number"
                  inputMode="numeric"
                  min={0}
                  value={form.obtained}
                  onChange={handleChange("obtained")}
                  placeholder="e.g. 82"
                  className="w-full border-b border-border bg-transparent px-1 py-2 text-foreground outline-none focus:border-accent"
                />
              }
            />

            <button
              type="submit"
              disabled={submitting}
              className="w-full bg-foreground py-3 text-sm font-medium uppercase tracking-[0.2em] text-background transition hover:bg-accent disabled:opacity-60"
            >
              {submitting ? "Submitting…" : "Calculate & Submit"}
            </button>
          </form>

          {result && (
            <div className="mt-10 border-t border-border pt-8 text-center">
              <p className="text-xs uppercase tracking-[0.3em] text-muted-foreground">Your Result</p>
              <p className="mt-4 font-serif-jp text-5xl text-foreground">{result.percentage.toFixed(2)}%</p>
              <p className={`mt-3 font-serif-jp text-3xl ${gradeColorClass(result.grade.letter)}`}>
                {result.grade.letter}
              </p>
              <p className="mt-2 text-sm text-muted-foreground">
                <span className="font-serif-jp">{result.grade.jp}</span> · {result.grade.en}
              </p>
              <span className="accent-line mx-auto mt-5" />
              <p className="mt-5 font-serif-jp text-lg text-foreground">{result.grade.message}</p>
            </div>
          )}
        </section>

        <footer className="mt-16 text-center">
          <Link to="/admin" className="text-xs uppercase tracking-[0.3em] text-muted-foreground hover:text-accent">
            Admin
          </Link>
        </footer>
      </main>
    </div>
  );
}

function Field({
  label,
  input,
  error,
  hint,
}: {
  label: string;
  input: React.ReactNode;
  error?: string;
  hint?: string;
}) {
  return (
    <label className="block">
      <span className="text-xs uppercase tracking-[0.2em] text-muted-foreground">{label}</span>
      <div className="mt-2">{input}</div>
      {error ? (
        <span className="mt-1 block text-xs text-destructive">{error}</span>
      ) : hint ? (
        <span className="mt-1 block text-xs text-muted-foreground">{hint}</span>
      ) : null}
    </label>
  );
}
