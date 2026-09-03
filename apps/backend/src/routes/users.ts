import type { FastifyInstance } from "fastify";
import { z } from "zod";
import { getUserProfile } from "../services/users.service.js";
import { getUserPosts } from "../services/posts.service.js";
import { feedQuerySchema } from "../schemas/posts.js";

const usernameParamSchema = z.object({ username: z.string() });

export default async function usersRoutes(app: FastifyInstance) {
  app.get("/:username", { preHandler: [app.optionalAuthenticate] }, async (request, reply) => {
    const parsed = usernameParamSchema.safeParse(request.params);
    if (!parsed.success) return reply.code(400).send({ error: "Некорректный username" });

    const payload = request.user as { sub: string } | undefined;
    const profile = await getUserProfile(parsed.data.username, payload?.sub ?? null);
    if (!profile) return reply.code(404).send({ error: "Пользователь не найден" });
    return { user: profile };
  });

  app.get("/:username/posts", { preHandler: [app.optionalAuthenticate] }, async (request, reply) => {
    const paramsParsed = usernameParamSchema.safeParse(request.params);
    if (!paramsParsed.success) return reply.code(400).send({ error: "Некорректный username" });

    const queryParsed = feedQuerySchema.safeParse(request.query);
    if (!queryParsed.success) return reply.code(400).send({ error: queryParsed.error.flatten() });

    const payload = request.user as { sub: string } | undefined;
    const profile = await getUserProfile(paramsParsed.data.username, payload?.sub ?? null);
    if (!profile) return reply.code(404).send({ error: "Пользователь не найден" });

    return getUserPosts(profile.id, payload?.sub ?? null, queryParsed.data);
  });
}