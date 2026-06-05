import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";

export const verifyAdminPassword = createServerFn({ method: "POST" })
  .inputValidator((input: { password: string }) =>
    z.object({ password: z.string().min(1).max(200) }).parse(input),
  )
  .handler(async ({ data }) => {
    const expected = process.env.ADMIN_PASSWORD;
    if (!expected) {
      return { ok: false, error: "Admin password is not configured on the server." };
    }
    if (data.password === expected) return { ok: true as const };
    return { ok: false as const, error: "Incorrect password" };
  });
