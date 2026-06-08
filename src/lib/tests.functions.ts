import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { randomBytes, timingSafeEqual } from "node:crypto";
import { SITE_CONFIG, gradeFor } from "@/lib/config";

// "Next day 9 AM" in IST (UTC+5:30). Adjust offset if you want a different TZ.
const TZ_OFFSET_MIN = 330;

export function computeUnlockAt(availableUntilIso: string): Date {
  const t = new Date(availableUntilIso).getTime();
  // shift to local TZ
  const local = new Date(t + TZ_OFFSET_MIN * 60_000);
  local.setUTCHours(9, 0, 0, 0);
  local.setUTCDate(local.getUTCDate() + 1);
  return new Date(local.getTime() - TZ_OFFSET_MIN * 60_000);
}

export type PublicOption = { id: string; text: string };
export type PublicQuestion = { id: string; position: number; prompt: string; options: PublicOption[]; marks: number };
export type AvailableTest = {
  id: string;
  title: string;
  description: string | null;
  duration_seconds: number;
  available_from: string;
  available_until: string;
};

export const listAvailableTests = createServerFn({ method: "GET" }).handler(async () => {
  const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
  const nowIso = new Date().toISOString();
  const { data, error } = await supabaseAdmin
    .from("tests")
    .select("id,title,description,duration_seconds,available_from,available_until")
    .lte("available_from", nowIso)
    .gte("available_until", nowIso)
    .order("available_from", { ascending: false });
  if (error) throw new Error(error.message);
  return (data ?? []) as AvailableTest[];
});

export const listAllTests = createServerFn({ method: "GET" }).handler(async () => {
  const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
  const { data, error } = await supabaseAdmin
    .from("tests")
    .select("id,title,description,duration_seconds,available_from,available_until")
    .order("available_from", { ascending: false });
  if (error) throw new Error(error.message);
  return (data ?? []) as AvailableTest[];
});

export const getTestMeta = createServerFn({ method: "GET" })
  .inputValidator((d: { testId: string }) => z.object({ testId: z.string().uuid() }).parse(d))
  .handler(async ({ data }) => {
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { data: test, error } = await supabaseAdmin
      .from("tests").select("*").eq("id", data.testId).maybeSingle();
    if (error) throw new Error(error.message);
    if (!test) throw new Error("Test not found");
    const { count } = await supabaseAdmin
      .from("questions").select("id", { count: "exact", head: true }).eq("test_id", data.testId);
    return { test: test as AvailableTest, questionCount: count ?? 0 };
  });

export const startAttempt = createServerFn({ method: "POST" })
  .inputValidator((d: { testId: string; studentName: string }) =>
    z.object({
      testId: z.string().uuid(),
      studentName: z.string().trim().min(1).max(100),
    }).parse(d),
  )
  .handler(async ({ data }) => {
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const now = new Date();
    const { data: test, error: tErr } = await supabaseAdmin
      .from("tests").select("*").eq("id", data.testId).maybeSingle();
    if (tErr) throw new Error(tErr.message);
    if (!test) throw new Error("Test not found");
    const from = new Date(test.available_from);
    const until = new Date(test.available_until);
    if (now < from) throw new Error("Test has not started yet");
    if (now > until) throw new Error("Test window has closed");

    const deadlineFromDuration = new Date(now.getTime() + test.duration_seconds * 1000);
    const deadline = deadlineFromDuration < until ? deadlineFromDuration : until;

    const { data: qs, error: qErr } = await supabaseAdmin
      .from("questions")
      .select("id,position,prompt,options,marks")
      .eq("test_id", data.testId)
      .order("position", { ascending: true });
    if (qErr) throw new Error(qErr.message);
    if (!qs || qs.length === 0) throw new Error("This test has no questions yet");

    const total = qs.reduce((s, q) => s + q.marks, 0);

    const attemptSecret = randomBytes(32).toString("hex");
    const { data: att, error: aErr } = await supabaseAdmin
      .from("attempts")
      .insert({
        test_id: data.testId,
        student_name: data.studentName.trim(),
        started_at: now.toISOString(),
        deadline: deadline.toISOString(),
        total,
        attempt_secret: attemptSecret,
      })
      .select("id,started_at,deadline")
      .single();
    if (aErr) throw new Error(aErr.message);

    return {
      attemptId: att.id,
      attemptSecret,
      startedAt: att.started_at,
      deadline: att.deadline,
      durationSeconds: test.duration_seconds,
      questions: qs.map((q) => ({
        id: q.id,
        position: q.position,
        prompt: q.prompt,
        options: q.options as PublicOption[],
        marks: q.marks,
      })) as PublicQuestion[],
      total,
      title: test.title,
    };
  });

export const submitAttempt = createServerFn({ method: "POST" })
  .inputValidator((d: { attemptId: string; attemptSecret: string; answers: Record<string, string> }) =>
    z.object({
      attemptId: z.string().uuid(),
      attemptSecret: z.string().min(16).max(256),
      answers: z.record(z.string(), z.string()),
    }).parse(d),
  )
  .handler(async ({ data }) => {
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");

    const { data: att, error: aErr } = await supabaseAdmin
      .from("attempts").select("*").eq("id", data.attemptId).maybeSingle();
    if (aErr) throw new Error(aErr.message);
    if (!att) throw new Error("Attempt not found");

    const storedSecret = (att as { attempt_secret: string | null }).attempt_secret ?? "";
    const provided = Buffer.from(data.attemptSecret);
    const expected = Buffer.from(storedSecret);
    if (
      storedSecret.length === 0 ||
      provided.length !== expected.length ||
      !timingSafeEqual(provided, expected)
    ) {
      throw new Error("Invalid attempt credentials");
    }

    if (att.submitted_at) {
      return existingResult(att);
    }

    const now = new Date();
    const deadline = new Date(att.deadline);
    const graceMs = 5_000;
    const late = now.getTime() > deadline.getTime() + graceMs;

    const { data: qs, error: qErr } = await supabaseAdmin
      .from("questions")
      .select("id,correct_option_id,marks")
      .eq("test_id", att.test_id);
    if (qErr) throw new Error(qErr.message);

    let score = 0;
    let total = 0;
    for (const q of qs ?? []) {
      total += q.marks;
      if (!late && data.answers[q.id] === q.correct_option_id) score += q.marks;
    }
    const percentage = total > 0 ? Math.round((score / total) * 10000) / 100 : 0;
    const grade = gradeFor(score, SITE_CONFIG.grades).letter;

    const { error: uErr } = await supabaseAdmin
      .from("attempts")
      .update({
        submitted_at: now.toISOString(),
        score,
        total,
        percentage,
        grade,
        answers: { responses: data.answers, late },
      })
      .eq("id", data.attemptId);
    if (uErr) throw new Error(uErr.message);

    return { score, total, percentage, grade, late };
  });

function existingResult(att: { score: number | null; total: number | null; percentage: number | null; grade: string | null }) {
  return {
    score: att.score ?? 0,
    total: att.total ?? 0,
    percentage: Number(att.percentage ?? 0),
    grade: (att.grade ?? "F"),
    late: false,
  };
}

export type LeaderboardRow = {
  id: string;
  student_name: string;
  score: number;
  total: number;
  percentage: number;
  grade: string;
  submitted_at: string;
};

export const getLeaderboard = createServerFn({ method: "GET" })
  .inputValidator((d: { testId: string }) => z.object({ testId: z.string().uuid() }).parse(d))
  .handler(async ({ data }) => {
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { data: test, error: tErr } = await supabaseAdmin
      .from("tests").select("id,title,available_until").eq("id", data.testId).maybeSingle();
    if (tErr) throw new Error(tErr.message);
    if (!test) throw new Error("Test not found");

    const unlockAt = computeUnlockAt(test.available_until);
    const now = new Date();
    if (now < unlockAt) {
      return { locked: true as const, unlocksAt: unlockAt.toISOString(), title: test.title, rows: [] as LeaderboardRow[] };
    }

    const { data: rows, error } = await supabaseAdmin
      .from("attempts")
      .select("id,student_name,score,total,percentage,grade,submitted_at")
      .eq("test_id", data.testId)
      .not("submitted_at", "is", null)
      .order("percentage", { ascending: false })
      .order("submitted_at", { ascending: true })
      .limit(1000);
    if (error) throw new Error(error.message);

    return {
      locked: false as const,
      unlocksAt: unlockAt.toISOString(),
      title: test.title,
      rows: (rows ?? []).map((r) => ({
        ...r,
        score: r.score ?? 0,
        total: r.total ?? 0,
        percentage: Number(r.percentage ?? 0),
        grade: r.grade ?? "F",
        submitted_at: r.submitted_at!,
      })) as LeaderboardRow[],
    };
  });
