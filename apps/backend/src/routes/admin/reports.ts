import type { FastifyInstance, FastifyReply } from "fastify";
import { z } from "zod";
import type { UserRole } from "../../db/schema/index.js";
import { AdminActionError } from "../../services/admin-users.service.js";
import { getReportDetail, listReports, resolveReport } from "../../services/admin-reports.service.js";

const idParam = z.object({ id: z.string().uuid() });
const listQuery = z.object({
  status: z.enum(["open", "resolved", "dismissed", "all"]).default("open"),
  targetType: z.enum(["post", "comment", "user", "message"]).optional(),
  cursor: z.string().uuid().optional(),
  limit: z.coerce.number().int().min(1).max(100).default(25),
});
const resolveBody = z
  .object({
    action: z.enum(["delete_content", "ban_author", "dismiss"]),
    reason: z.string().trim().max(500).optional(),
  })
  .superRefine((v, ctx) => {
    if (v.action !== "dismiss" && (v.reason?.length ?? 0) < 3) {
      ctx.addIssue({ code: "custom", path: ["reason"], message: "укажите причину" });
    }
  });

function handleError(err: unknown, reply: FastifyReply) {
  if (err instanceof AdminActionError) return reply.code(err.status).send({ error: err.message });
  throw err;
}

export default async function adminReportsRoutes(app: FastifyInstance) {
  // Хуки родителя (authenticate + минимум «модератор») наследуются
  const actor = (request: { user: unknown; staffRole?: UserRole }) => ({
    id: (request.user as { sub: string }).sub,
    role: request.staffRole!,
  });

  app.get("/", async (request, reply) => {
    const parsed = listQuery.safeParse(request.query);
    if (!parsed.success) return reply.code(400).send({ error: parsed.error.flatten() });
    return listReports(parsed.data);
  });

  app.get("/:id", async (request, reply) => {
    const params = idParam.safeParse(request.params);
    if (!params.success) return reply.code(400).send({ error: "Некорректный id" });
    const report = await getReportDetail(params.data.id);
    if (!report) return reply.code(404).send({ error: "Жалоба не найдена" });
    return { report };
  });

  app.post("/:id/resolve", async (request, reply) => {
    const params = idParam.safeParse(request.params);
    if (!params.success) return reply.code(400).send({ error: "Некорректный id" });
    const body = resolveBody.safeParse(request.body);
    if (!body.success) return reply.code(400).send({ error: body.error.flatten() });
    try {
      await resolveReport(actor(request), params.data.id, {
        action: body.data.action,
        reason: body.data.reason || undefined,
      });
      return { success: true };
    } catch (err) {
      return handleError(err, reply);
    }
  });
}