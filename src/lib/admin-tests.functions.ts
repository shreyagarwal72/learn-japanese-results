import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";

async function assertAdmin(userId: string) {
  const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
  const { data, error } = await supabaseAdmin
    .from("user_roles").select("role").eq("user_id", userId).eq("role", "admin").maybeSingle();
  if (error) throw new Error(error.message);
  if (!data) throw new Error("Forbidden: admin role required");
}

const testInput = z.object({
  title: z.string().trim().min(1).max(200),
  description: z.string().trim().max(2000).optional().nullable(),
  duration_seconds: z.number().int().min(30).max(60 * 60 * 6),
  available_from: z.string(),
  available_until: z.string(),
});

export const adminListTests = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    await assertAdmin(context.userId);
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { data, error } = await supabaseAdmin
      .from("tests")
      .select("id,title,description,duration_seconds,available_from,available_until,created_at")
      .order("created_at", { ascending: false });
    if (error) throw new Error(error.message);
    return data ?? [];
  });

export const adminCreateTest = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: z.input<typeof testInput>) => testInput.parse(d))
  .handler(async ({ data, context }) => {
    await assertAdmin(context.userId);
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { data: row, error } = await supabaseAdmin
      .from("tests").insert(data).select("*").single();
    if (error) throw new Error(error.message);
    return row;
  });

export const adminUpdateTest = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: z.input<typeof testInput> & { id: string }) =>
    testInput.extend({ id: z.string().uuid() }).parse(d),
  )
  .handler(async ({ data, context }) => {
    await assertAdmin(context.userId);
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { id, ...rest } = data;
    const { data: row, error } = await supabaseAdmin
      .from("tests").update(rest).eq("id", id).select("*").single();
    if (error) throw new Error(error.message);
    return row;
  });

export const adminDeleteTest = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: { id: string }) => z.object({ id: z.string().uuid() }).parse(d))
  .handler(async ({ data, context }) => {
    await assertAdmin(context.userId);
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

export const adminListQuestions = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: { testId: string }) => z.object({ testId: z.string().uuid() }).parse(d))
  .handler(async ({ data, context }) => {
    await assertAdmin(context.userId);
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { data: rows, error } = await supabaseAdmin
      .from("questions").select("*").eq("test_id", data.testId).order("position");
    if (error) throw new Error(error.message);
    return rows ?? [];
  });

export const adminSaveQuestions = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: { testId: string; questions: z.input<typeof questionSchema>[] }) =>
    z.object({ testId: z.string().uuid(), questions: z.array(questionSchema) }).parse(d),
  )
  .handler(async ({ data, context }) => {
    await assertAdmin(context.userId);
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    // validate each correct_option_id exists in options
    for (const q of data.questions) {
      if (!q.options.some((o) => o.id === q.correct_option_id)) {
        throw new Error(`Question "${q.prompt.slice(0, 40)}…" has invalid correct option`);
      }
    }
    // replace strategy: delete all, then insert
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

export const adminListAttempts = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: { testId: string }) => z.object({ testId: z.string().uuid() }).parse(d))
  .handler(async ({ data, context }) => {
    await assertAdmin(context.userId);
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

export const adminChangePassword = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: { newPassword: string }) =>
    z.object({ newPassword: z.string().min(8).max(128) }).parse(d),
  )
  .handler(async ({ data, context }) => {
    await assertAdmin(context.userId);
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { error } = await supabaseAdmin.auth.admin.updateUserById(context.userId, {
      password: data.newPassword,
    });
    if (error) throw new Error(error.message);
    return { ok: true };
  });
