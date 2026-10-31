import type { FastifyInstance, FastifyReply } from "fastify";
import { z } from "zod";
import { AdminActionError } from "../../services/admin-users.service.js";
import {
  deleteComment,
  deletePost,
  getPostDetail,
  listComments,
  listPosts,
} from "../../services/admin-content.service.js";
import type { UserRole } from "../../db/schema/index.js";

const idParam = z.object({ id: z.string().uuid() });
const dateStr = z
  .string()
  .regex(/^\d{4}-\d{2}-\d{2}$/)
  .refine((s) => !Number.isNaN(Date.parse(s)), "Некорректная дата");
const listQuery = z.object({
  q: z.string().trim().max(100).optional(),
  author: z.string().trim().max(32).optional(),
  from: dateStr.optional(),
  to: dateStr.optional(),
  cursor: z.string().uuid().optional(),
  limit: z.coerce.number().int().min(1).max(100).default(25),
});
const deleteBody = z.object({ reason: z.string().trim().min(3, "укажите причину").max(500) });

const actor = (request: { user: unknown; staffRole?: UserRole }) => ({
  id: (request.user as { sub: string }).sub,
  role: request.staffRole!,
});

function handleError(err: unknown, reply: FastifyReply) {
  if (err instanceof AdminActionError) return reply.code(err.status).send({ error: err.message });
  throw err;
}

export default async function adminContentRoutes(app: FastifyInstance) {
  // Хуки родителя (authenticate + минимум «модератор») наследуются
  const actorId = (request: { user: unknown }) => (request.user as { sub: string }).sub;

  app.get("/posts", async (request, reply) => {
    const parsed = listQuery.safeParse(request.query);
    if (!parsed.success) return reply.code(400).send({ error: parsed.error.flatten() });
    return listPosts(parsed.data);
  });

  app.get("/posts/:id", async (request, reply) => {
    const params = idParam.safeParse(request.params);
    if (!params.success) return reply.code(400).send({ error: "Некорректный id" });
    const post = await getPostDetail(params.data.id);
    if (!post) return reply.code(404).send({ error: "Пост не найден" });
    return { post };
  });

  app.delete("/posts/:id", async (request, reply) => {
    const params = idParam.safeParse(request.params);
    if (!params.success) return reply.code(400).send({ error: "Некорректный id" });
    const body = deleteBody.safeParse(request.body);
    if (!body.success) return reply.code(400).send({ error: body.error.flatten() });
    try {
      await deletePost(actor(request), params.data.id, body.data.reason);
      return { success: true };
    } catch (err) {
      return handleError(err, reply);
    }
  });

  app.get("/comments", async (request, reply) => {
    const parsed = listQuery.safeParse(request.query);
    if (!parsed.success) return reply.code(400).send({ error: parsed.error.flatten() });
    return listComments(parsed.data);
  });

  app.delete("/comments/:id", async (request, reply) => {
    const params = idParam.safeParse(request.params);
    if (!params.success) return reply.code(400).send({ error: "Некорректный id" });
    const body = deleteBody.safeParse(request.body);
    if (!body.success) return reply.code(400).send({ error: body.error.flatten() });
    try {
      await deleteComment(actor(request), params.data.id, body.data.reason);
      return { success: true };
    } catch (err) {
      return handleError(err, reply);
    }
  });
}