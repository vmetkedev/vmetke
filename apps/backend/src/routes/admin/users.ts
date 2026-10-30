import type { FastifyInstance, FastifyReply } from "fastify";
import { z } from "zod";
import { requireRole } from "../../plugins/roles.js";
import {
  AdminActionError,
  banUser,
  changeRole,
  forceLogout,
  getUserDetail,
  listUsers,
  unbanUser,
} from "../../services/admin-users.service.js";

const idParam = z.object({ id: z.string().uuid() });
const listQuery = z.object({
  q: z.string().trim().max(100).optional(),
  role: z.enum(["user", "moderator", "admin"]).optional(),
  banned: z.enum(["true", "false"]).optional(),
  cursor: z.string().uuid().optional(),
  limit: z.coerce.number().int().min(1).max(100).default(25),
});
const banBody = z.object({ reason: z.string().trim().min(3, "укажите причину").max(500) });
const roleBody = z.object({ role: z.enum(["user", "moderator", "admin"]) });

function handleError(err: unknown, reply: FastifyReply) {
  if (err instanceof AdminActionError) return reply.code(err.status).send({ error: err.message });
  throw err;
}

export default async function adminUsersRoutes(app: FastifyInstance) {
  app.addHook("onRequest", requireRole("admin"));

  const actorId = (request: { user: unknown }) => (request.user as { sub: string }).sub;

  app.get("/", async (request, reply) => {
    const parsed = listQuery.safeParse(request.query);
    if (!parsed.success) return reply.code(400).send({ error: parsed.error.flatten() });
    const { banned, ...rest } = parsed.data;
    return listUsers({ ...rest, banned: banned === undefined ? undefined : banned === "true" });
  });

  app.get("/:id", async (request, reply) => {
    const params = idParam.safeParse(request.params);
    if (!params.success) return reply.code(400).send({ error: "Некорректный id" });
    const user = await getUserDetail(params.data.id);
    if (!user) return reply.code(404).send({ error: "Пользователь не найден" });
    return { user };
  });

  app.post("/:id/ban", async (request, reply) => {
    const params = idParam.safeParse(request.params);
    if (!params.success) return reply.code(400).send({ error: "Некорректный id" });
    const body = banBody.safeParse(request.body);
    if (!body.success) return reply.code(400).send({ error: body.error.flatten() });
    try {
      await banUser(actorId(request), params.data.id, body.data.reason);
      return { success: true };
    } catch (err) {
      return handleError(err, reply);
    }
  });

  app.post("/:id/unban", async (request, reply) => {
    const params = idParam.safeParse(request.params);
    if (!params.success) return reply.code(400).send({ error: "Некорректный id" });
    try {
      await unbanUser(actorId(request), params.data.id);
      return { success: true };
    } catch (err) {
      return handleError(err, reply);
    }
  });

  app.patch("/:id/role", async (request, reply) => {
    const params = idParam.safeParse(request.params);
    if (!params.success) return reply.code(400).send({ error: "Некорректный id" });
    const body = roleBody.safeParse(request.body);
    if (!body.success) return reply.code(400).send({ error: body.error.flatten() });
    try {
      await changeRole(actorId(request), params.data.id, body.data.role);
      return { success: true };
    } catch (err) {
      return handleError(err, reply);
    }
  });

  app.post("/:id/logout", async (request, reply) => {
    const params = idParam.safeParse(request.params);
    if (!params.success) return reply.code(400).send({ error: "Некорректный id" });
    try {
      await forceLogout(actorId(request), params.data.id);
      return { success: true };
    } catch (err) {
      return handleError(err, reply);
    }
  });
}