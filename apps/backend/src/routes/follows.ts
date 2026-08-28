import type { FastifyInstance } from "fastify";
import { z } from "zod";
import { followUser, unfollowUser, SelfFollowError } from "../services/follows.service.js";

const paramsSchema = z.object({ userId: z.string().uuid() });

export default async function followsRoutes(app: FastifyInstance) {
  app.post("/:userId", { preHandler: [app.authenticate] }, async (request, reply) => {
    const parsed = paramsSchema.safeParse(request.params);
    if (!parsed.success) {
      return reply.code(400).send({ error: "Некорректный ID пользователя" });
    }

    const payload = request.user as { sub: string };

    try {
      await followUser(payload.sub, parsed.data.userId);
      return { success: true };
    } catch (err) {
      if (err instanceof SelfFollowError) {
        return reply.code(400).send({ error: err.message });
      }
      throw err;
    }
  });

  app.delete("/:userId", { preHandler: [app.authenticate] }, async (request, reply) => {
    const parsed = paramsSchema.safeParse(request.params);
    if (!parsed.success) {
      return reply.code(400).send({ error: "Некорректный ID пользователя" });
    }

    const payload = request.user as { sub: string };
    await unfollowUser(payload.sub, parsed.data.userId);
    return { success: true };
  });
}