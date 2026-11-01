import type { FastifyInstance } from "fastify";
import { z } from "zod";
import { createReport, ReportError } from "../services/reports.service.js";

const bodySchema = z
  .object({
    targetType: z.enum(["post", "comment", "user", "message"]),
    targetId: z.string().trim().min(1).max(64),
    reason: z.enum(["spam", "abuse", "illegal", "other"]),
    comment: z.string().trim().max(500).optional(),
  })
  .superRefine((v, ctx) => {
    const validId =
      v.targetType === "message"
        ? /^[1-9]\d{0,8}$/.test(v.targetId)
        : z.string().uuid().safeParse(v.targetId).success;
    if (!validId) ctx.addIssue({ code: "custom", path: ["targetId"], message: "Некорректный id" });
    if (v.reason === "other" && (v.comment?.length ?? 0) < 3) {
      ctx.addIssue({ code: "custom", path: ["comment"], message: "Опишите причину" });
    }
  });

export default async function reportsRoutes(app: FastifyInstance) {
  app.post("/", { preHandler: [app.authenticate] }, async (request, reply) => {
    const parsed = bodySchema.safeParse(request.body);
    if (!parsed.success) return reply.code(400).send({ error: parsed.error.flatten() });

    const payload = request.user as { sub: string };
    try {
      const { id } = await createReport(payload.sub, {
        ...parsed.data,
        comment: parsed.data.comment || null,
      });
      return reply.code(201).send({ id });
    } catch (err) {
      if (err instanceof ReportError) return reply.code(err.status).send({ error: err.message });
      throw err;
    }
  });
}