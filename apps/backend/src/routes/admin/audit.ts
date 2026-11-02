import type { FastifyInstance } from "fastify";
import { z } from "zod";
import { requireRole } from "../../plugins/roles.js";
import { getAuditEntry, listAuditLog } from "../../services/admin-audit.service.js";

const PG_INT_MAX = 2147483647;
const dateStr = z
  .string()
  .regex(/^\d{4}-\d{2}-\d{2}$/)
  .refine((s) => !Number.isNaN(Date.parse(s)), "Некорректная дата");
const intId = z.coerce.number().int().positive().max(PG_INT_MAX);

const listQuery = z.object({
  admin: z.string().trim().max(32).optional(),
  action: z.string().trim().max(64).optional(),
  targetType: z.string().trim().max(32).optional(),
  targetId: z.string().trim().max(64).optional(),
  from: dateStr.optional(),
  to: dateStr.optional(),
  cursor: intId.optional(),
  limit: z.coerce.number().int().min(1).max(100).default(25),
});

// Журнал только для чтения: здесь нет и не должно быть POST/PATCH/PUT/DELETE
export default async function adminAuditRoutes(app: FastifyInstance) {
  app.addHook("onRequest", requireRole("admin"));

  app.get("/", async (request, reply) => {
    const parsed = listQuery.safeParse(request.query);
    if (!parsed.success) return reply.code(400).send({ error: parsed.error.flatten() });
    return listAuditLog(parsed.data);
  });

  app.get("/:id", async (request, reply) => {
    const params = z.object({ id: intId }).safeParse(request.params);
    if (!params.success) return reply.code(400).send({ error: "Некорректный id" });
    const entry = await getAuditEntry(params.data.id);
    if (!entry) return reply.code(404).send({ error: "Запись не найдена" });
    return { entry };
  });
}