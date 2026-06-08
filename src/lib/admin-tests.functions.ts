import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { createHash, timingSafeEqual } from "node:crypto";

function assertPassword(password: string) {
  const expected = process.env.ADMIN_PASSWORD;
  if (!expected) throw new Error("Admin password not configured");
  const a = createHash("sha256").update(password).digest();
  const b = createHash("sha256").update(expected).digest();
  if (a.length !== b.length || !timingSafeEqual(a, b)) {
    throw new Error("Invalid admin password");
  }
}

const withPw = <T extends z.ZodTypeAny>(schema: T) =>
  z.object({ password: z.string().min(1) }).and(schema);

export const adminVerifyPassword = createServerFn({ method: "POST" })
  .inputValidator((d: { password: string }) => z.object({ password: z.string().min(1) }).parse(d))
  .handler(async ({ data }) => {
    assertPassword(data.password);
    return { ok: true };
  });

export const adminListTests = createServerFn({ method: "POST" })
  .inputValidator((d: { password: string }) => z.object({ password: z.string().min(1) }).parse(d))
  .handler(async ({ data }) => {
    assertPassword(data.password);
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { data: rows, error } = await supabaseAdmin
      .from("tests")
      .select("id,title,description,duration_seconds,available_from,available_until,created_at")
      .order("created_at", { ascending: false });
    if (error) throw new Error(error.message);
    return rows ?? [];
  });

const testFieldsBase = z.object({
  title: z.string().trim().min(1).max(200),
  description: z.string().trim().max(2000).optional().nullable(),
  duration_seconds: z.number().int().min(30).max(60 * 60 * 6),
  available_from: z.string().datetime({ offset: true }),
  available_until: z.string().datetime({ offset: true }),
});
const windowRefine = (v: { available_from: string; available_until: string }) =>
  new Date(v.available_until).getTime() > new Date(v.available_from).getTime();
const windowMsg = { message: "available_until must be after available_from", path: ["available_until"] };
const testFields = testFieldsBase.refine(windowRefine, windowMsg);

export const adminCreateTest = createServerFn({ method: "POST" })
  .inputValidator((d: z.input<typeof testFields> & { password: string }) =>
    withPw(testFields).parse(d),
  )
  .handler(async ({ data }) => {
    assertPassword(data.password);
    const { password: _p, ...payload } = data;
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { data: row, error } = await supabaseAdmin
      .from("tests").insert(payload).select("*").single();
    if (error) throw new Error(error.message);
    return row;
  });

export const adminUpdateTest = createServerFn({ method: "POST" })
  .inputValidator((d: z.input<typeof testFields> & { id: string; password: string }) =>
    withPw(testFieldsBase.extend({ id: z.string().uuid() }).refine(windowRefine, windowMsg)).parse(d),
  )
  .handler(async ({ data }) => {
    assertPassword(data.password);
    const { password: _p, id, ...rest } = data;
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { data: row, error } = await supabaseAdmin
      .from("tests").update(rest).eq("id", id).select("*").single();
    if (error) throw new Error(error.message);
    return row;
  });

export const adminDeleteTest = createServerFn({ method: "POST" })
  .inputValidator((d: { id: string; password: string }) =>
    z.object({ id: z.string().uuid(), password: z.string().min(1) }).parse(d),
  )
  .handler(async ({ data }) => {
    assertPassword(data.password);
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { error } = await supabaseAdmin.from("tests").delete().eq("id", data.id);
    if (error) throw new Error(error.message);
    return { ok: true };
  });

const optionSchema = z.object({ id: z.string().min(1), text: z.string().min(1).max(500) });
const questionSchema = z.object({
  id: z.string().uuid().optional(),
  position: z.number().int().min(0),
  prompt: z.string().trim().min(1).max(2000),
  options: z.array(optionSchema).min(2).max(8),
  correct_option_id: z.string().min(1),
  marks: z.number().int().min(1).max(100),
});

export const adminListQuestions = createServerFn({ method: "POST" })
  .inputValidator((d: { testId: string; password: string }) =>
    z.object({ testId: z.string().uuid(), password: z.string().min(1) }).parse(d),
  )
  .handler(async ({ data }) => {
    assertPassword(data.password);
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { data: rows, error } = await supabaseAdmin
      .from("questions").select("*").eq("test_id", data.testId).order("position");
    if (error) throw new Error(error.message);
    return rows ?? [];
  });

export const adminSaveQuestions = createServerFn({ method: "POST" })
  .inputValidator((d: { testId: string; password: string; questions: z.input<typeof questionSchema>[] }) =>
    z.object({
      testId: z.string().uuid(),
      password: z.string().min(1),
      questions: z.array(questionSchema),
    }).parse(d),
  )
  .handler(async ({ data }) => {
    assertPassword(data.password);
    for (const q of data.questions) {
      if (!q.options.some((o) => o.id === q.correct_option_id)) {
        throw new Error(`Question "${q.prompt.slice(0, 40)}…" has invalid correct option`);
      }
    }
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { error: delErr } = await supabaseAdmin
      .from("questions").delete().eq("test_id", data.testId);
    if (delErr) throw new Error(delErr.message);

    if (data.questions.length === 0) return { ok: true, count: 0 };

    const payload = data.questions.map((q, i) => ({
      test_id: data.testId,
      position: q.position ?? i,
      prompt: q.prompt,
      options: q.options,
      correct_option_id: q.correct_option_id,
      marks: q.marks,
    }));
    const { error: insErr } = await supabaseAdmin.from("questions").insert(payload);
    if (insErr) throw new Error(insErr.message);
    return { ok: true, count: payload.length };
  });

export const adminListAttempts = createServerFn({ method: "POST" })
  .inputValidator((d: { testId: string; password: string }) =>
    z.object({ testId: z.string().uuid(), password: z.string().min(1) }).parse(d),
  )
  .handler(async ({ data }) => {
    assertPassword(data.password);
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { data: rows, error } = await supabaseAdmin
      .from("attempts")
      .select("id,student_name,score,total,percentage,grade,started_at,submitted_at")
      .eq("test_id", data.testId)
      .order("percentage", { ascending: false, nullsFirst: false })
      .order("submitted_at", { ascending: true });
    if (error) throw new Error(error.message);
    return rows ?? [];
  });
