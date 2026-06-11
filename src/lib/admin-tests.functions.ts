import { createServerFn } from "@tanstack/react-start";
import { getRequest } from "@tanstack/react-start/server";
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

function getActorIp(): string | null {
  try {
    const req = getRequest();
    const h = req.headers;
    return (
      h.get("cf-connecting-ip") ??
      h.get("x-forwarded-for")?.split(",")[0]?.trim() ??
      h.get("x-real-ip") ??
      null
    );
  } catch {
    return null;
  }
}

async function logAudit(input: {
  action: string;
  actorLabel: string;
  targetType?: string | null;
  targetId?: string | null;
  details?: Record<string, unknown>;
}) {
  try {
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    await supabaseAdmin.from("admin_audit_log").insert({
      action: input.action,
      actor_label: (input.actorLabel || "admin").slice(0, 80),
      actor_ip: getActorIp(),
      target_type: input.targetType ?? null,
      target_id: input.targetId ?? null,
      details: input.details ?? {},
    });
  } catch (e) {
    // never block the admin action on logging failure
    console.error("[audit] failed to log", e);
  }
}

const baseAuth = z.object({
  password: z.string().min(1),
  actorLabel: z.string().trim().min(1).max(80).default("admin"),
});

const withAuth = <T extends z.ZodTypeAny>(schema: T) => baseAuth.and(schema);

export const adminVerifyPassword = createServerFn({ method: "POST" })
  .inputValidator((d: { password: string; actorLabel?: string }) =>
    baseAuth.parse({ actorLabel: "admin", ...d }),
  )
  .handler(async ({ data }) => {
    assertPassword(data.password);
    await logAudit({ action: "auth.login", actorLabel: data.actorLabel });
    return { ok: true };
  });

export const adminListTests = createServerFn({ method: "POST" })
  .inputValidator((d: { password: string; actorLabel?: string }) =>
    baseAuth.parse({ actorLabel: "admin", ...d }),
  )
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
  .inputValidator((d: z.input<typeof testFields> & { password: string; actorLabel?: string }) =>
    withAuth(testFields).parse({ actorLabel: "admin", ...d }),
  )
  .handler(async ({ data }) => {
    assertPassword(data.password);
    const { password: _p, actorLabel, ...payload } = data;
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { data: row, error } = await supabaseAdmin
      .from("tests").insert(payload).select("*").single();
    if (error) throw new Error(error.message);
    await logAudit({
      action: "test.create",
      actorLabel,
      targetType: "test",
      targetId: row.id,
      details: { title: row.title, available_from: row.available_from, available_until: row.available_until, duration_seconds: row.duration_seconds },
    });
    return row;
  });

export const adminUpdateTest = createServerFn({ method: "POST" })
  .inputValidator((d: z.input<typeof testFields> & { id: string; password: string; actorLabel?: string }) =>
    withAuth(testFieldsBase.extend({ id: z.string().uuid() }).refine(windowRefine, windowMsg)).parse({ actorLabel: "admin", ...d }),
  )
  .handler(async ({ data }) => {
    assertPassword(data.password);
    const { password: _p, actorLabel, id, ...rest } = data;
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { data: row, error } = await supabaseAdmin
      .from("tests").update(rest).eq("id", id).select("*").single();
    if (error) throw new Error(error.message);
    await logAudit({
      action: "test.update",
      actorLabel,
      targetType: "test",
      targetId: id,
      details: { title: row.title, available_from: row.available_from, available_until: row.available_until, duration_seconds: row.duration_seconds },
    });
    return row;
  });

export const adminDeleteTest = createServerFn({ method: "POST" })
  .inputValidator((d: { id: string; password: string; actorLabel?: string }) =>
    baseAuth.and(z.object({ id: z.string().uuid() })).parse({ actorLabel: "admin", ...d }),
  )
  .handler(async ({ data }) => {
    assertPassword(data.password);
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { data: existing } = await supabaseAdmin
      .from("tests").select("title").eq("id", data.id).maybeSingle();
    const { error } = await supabaseAdmin.from("tests").delete().eq("id", data.id);
    if (error) throw new Error(error.message);
    await logAudit({
      action: "test.delete",
      actorLabel: data.actorLabel,
      targetType: "test",
      targetId: data.id,
      details: { title: existing?.title ?? null },
    });
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
  .inputValidator((d: { testId: string; password: string; actorLabel?: string }) =>
    baseAuth.and(z.object({ testId: z.string().uuid() })).parse({ actorLabel: "admin", ...d }),
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
  .inputValidator((d: { testId: string; password: string; actorLabel?: string; questions: z.input<typeof questionSchema>[] }) =>
    baseAuth.and(z.object({
      testId: z.string().uuid(),
      questions: z.array(questionSchema),
    })).parse({ actorLabel: "admin", ...d }),
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

    if (data.questions.length === 0) {
      await logAudit({
        action: "questions.save",
        actorLabel: data.actorLabel,
        targetType: "test",
        targetId: data.testId,
        details: { count: 0 },
      });
      return { ok: true, count: 0 };
    }

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
    await logAudit({
      action: "questions.save",
      actorLabel: data.actorLabel,
      targetType: "test",
      targetId: data.testId,
      details: { count: payload.length },
    });
    return { ok: true, count: payload.length };
  });

export const adminListAttempts = createServerFn({ method: "POST" })
  .inputValidator((d: { testId: string; password: string; actorLabel?: string }) =>
    baseAuth.and(z.object({ testId: z.string().uuid() })).parse({ actorLabel: "admin", ...d }),
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

export const adminLogExport = createServerFn({ method: "POST" })
  .inputValidator((d: { testId: string; rowCount: number; password: string; actorLabel?: string }) =>
    baseAuth.and(z.object({
      testId: z.string().uuid(),
      rowCount: z.number().int().min(0),
    })).parse({ actorLabel: "admin", ...d }),
  )
  .handler(async ({ data }) => {
    assertPassword(data.password);
    await logAudit({
      action: "attempts.export",
      actorLabel: data.actorLabel,
      targetType: "test",
      targetId: data.testId,
      details: { rowCount: data.rowCount, format: "xlsx" },
    });
    return { ok: true };
  });

export type AuditEntry = {
  id: string;
  action: string;
  target_type: string | null;
  target_id: string | null;
  actor_label: string;
  actor_ip: string | null;
  details: Record<string, unknown>;
  created_at: string;
};

export const adminListAudit = createServerFn({ method: "POST" })
  .inputValidator((d: { password: string; actorLabel?: string; limit?: number }) =>
    baseAuth.and(z.object({ limit: z.number().int().min(1).max(500).default(200) })).parse({
      actorLabel: "admin", limit: 200, ...d,
    }),
  )
  .handler(async ({ data }) => {
    assertPassword(data.password);
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { data: rows, error } = await supabaseAdmin
      .from("admin_audit_log")
      .select("id,action,target_type,target_id,actor_label,actor_ip,details,created_at")
      .order("created_at", { ascending: false })
      .limit(data.limit);
    if (error) throw new Error(error.message);
    return (rows ?? []) as AuditEntry[];
  });
