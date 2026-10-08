import type { FastifyInstance, FastifyReply } from "fastify";
import { z } from "zod";
import {
  blockUser,
  listBlockedUsers,
  MessagingError,
  unblockUser,
} from "../services/messages.service.js";

const blockBody = z.object({ userId: z.string().uuid() });
const userParams = z.object({ userId: z.string().uuid() });

function fail(reply: FastifyReply, e: unknown) {
  if (e instanceof MessagingError) return reply.code(e.statusCode).send({ error: e.message });
  throw e;
}

export default async function blocksRoutes(app: FastifyInstance) {
  app.get("/", { preHandler: [app.authenticate] }, async (request) => {
    const payload = request.user as { sub: string };
    return { blocked: await listBlockedUsers(payload.sub) };
  });

  app.post("/", { preHandler: [app.authenticate] }, async (request, reply) => {
    const body = blockBody.safeParse(request.body);
    if (!body.success) return reply.code(400).send({ error: "Некорректные данные" });

    const payload = request.user as { sub: string };
    try {
      await blockUser(payload.sub, body.data.userId);
      return { success: true };
    } catch (e) {
      return fail(reply, e);
    }
  });

  app.delete("/:userId", { preHandler: [app.authenticate] }, async (request, reply) => {
    const params = userParams.safeParse(request.params);
    if (!params.success) return reply.code(400).send({ error: "Некорректные данные" });

    const payload = request.user as { sub: string };
    await unblockUser(payload.sub, params.data.userId);
    return { success: true };
  });
}