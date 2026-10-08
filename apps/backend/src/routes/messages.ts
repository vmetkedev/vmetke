import type { FastifyInstance, FastifyReply, FastifyRequest } from "fastify";
import { z } from "zod";
import {
  deleteConversation,
  deleteMessage,
  getMessages,
  getOrCreateConversation,
  listConversations,
  markRead,
  MessagingError,
  sendMessage,
} from "../services/messages.service.js";

export const MAX_MESSAGE = 5000;
export const SEND_LIMIT = 20;
export const CREATE_LIMIT = 10;
const LIMIT_WINDOW = "1 minute";

const createBody = z.object({ userId: z.string().uuid() });
const idParams = z.object({ id: z.coerce.number().int().positive() });
const historyQuery = z.object({
  before: z.coerce.number().int().positive().optional(),
  limit: z.coerce.number().int().min(1).max(100).default(30),
});
const sendBody = z.object({ content: z.string().trim().min(1).max(MAX_MESSAGE) });
const messageParams = z.object({
  id: z.coerce.number().int().positive(),
  messageId: z.coerce.number().int().positive(),
});
// scope обязателен и без default, чтобы случайно не удалить диалог у всех
const deleteQuery = z.object({ scope: z.enum(["me", "all"]) });

function fail(reply: FastifyReply, e: unknown) {
  if (e instanceof MessagingError) return reply.code(e.statusCode).send({ error: e.message });
  throw e;
}

export default async function messagesRoutes(app: FastifyInstance) {
  // onRequest-хук rate-limit срабатывает до authenticate, поэтому request.user ещё пуст.
  // Проверяем подпись токена сами; без валидного токена лимитируем по IP.
  const userKey = (request: FastifyRequest) => {
    try {
      const token = request.headers.authorization?.replace(/^Bearer\s+/i, "");
      if (token) return `user:${app.jwt.verify<{ sub: string }>(token).sub}`;
    } catch {
      // невалидный токен: authenticate всё равно вернёт 401
    }
    return request.ip;
  };
  app.post(
  "/",
  {
    preHandler: [app.authenticate],
    config: { rateLimit: { max: CREATE_LIMIT, timeWindow: LIMIT_WINDOW, keyGenerator: userKey } },
  },
  async (request, reply) => {
    const body = createBody.safeParse(request.body);
    if (!body.success) return reply.code(400).send({ error: "Некорректные данные" });

    const payload = request.user as { sub: string };
    try {
      return { conversation: await getOrCreateConversation(payload.sub, body.data.userId) };
    } catch (e) {
      return fail(reply, e);
    }
  });

  app.get("/", { preHandler: [app.authenticate] }, async (request) => {
    const payload = request.user as { sub: string };
    return { conversations: await listConversations(payload.sub) };
  });

  app.get("/:id/messages", { preHandler: [app.authenticate] }, async (request, reply) => {
    const params = idParams.safeParse(request.params);
    const query = historyQuery.safeParse(request.query);
    if (!params.success || !query.success) {
      return reply.code(400).send({ error: "Некорректные данные" });
    }

    const payload = request.user as { sub: string };
    try {
      return await getMessages(params.data.id, payload.sub, query.data.before, query.data.limit);
    } catch (e) {
      return fail(reply, e);
    }
  });

  app.post(
  "/:id/messages",
  {
    preHandler: [app.authenticate],
    config: { rateLimit: { max: SEND_LIMIT, timeWindow: LIMIT_WINDOW, keyGenerator: userKey } },
  },
  async (request, reply) => {
    const params = idParams.safeParse(request.params);
    const body = sendBody.safeParse(request.body);
    if (!params.success || !body.success) {
      return reply.code(400).send({ error: "Некорректные данные" });
    }

    const payload = request.user as { sub: string };
    try {
      const message = await sendMessage(params.data.id, payload.sub, body.data.content);
      return reply.code(201).send({ message });
    } catch (e) {
      return fail(reply, e);
    }
  });

  app.post("/:id/read", { preHandler: [app.authenticate] }, async (request, reply) => {
    const params = idParams.safeParse(request.params);
    if (!params.success) return reply.code(400).send({ error: "Некорректные данные" });

    const payload = request.user as { sub: string };
    try {
      await markRead(params.data.id, payload.sub);
      return { success: true };
    } catch (e) {
      return fail(reply, e);
    }
  });

  app.delete("/:id", { preHandler: [app.authenticate] }, async (request, reply) => {
    const params = idParams.safeParse(request.params);
    const query = deleteQuery.safeParse(request.query);
    if (!params.success || !query.success) {
      return reply.code(400).send({ error: "Некорректные данные" });
    }

    const payload = request.user as { sub: string };
    try {
      await deleteConversation(params.data.id, payload.sub, query.data.scope);
      return { success: true };
    } catch (e) {
      return fail(reply, e);
    }
  });

  app.delete("/:id/messages/:messageId", { preHandler: [app.authenticate] }, async (request, reply) => {
    const params = messageParams.safeParse(request.params);
    if (!params.success) return reply.code(400).send({ error: "Некорректные данные" });

    const payload = request.user as { sub: string };
    try {
      await deleteMessage(params.data.id, params.data.messageId, payload.sub);
      return { success: true };
    } catch (e) {
      return fail(reply, e);
    }
  });
}