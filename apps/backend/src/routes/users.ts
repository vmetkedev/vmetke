import type { FastifyInstance } from "fastify";
import { z } from "zod";
import {
  getUserProfile,
  updateAvatarColor,
  deleteAccount,
  InvalidPasswordError,
} from "../services/users.service.js";
import { getUserPosts } from "../services/posts.service.js";
import { feedQuerySchema } from "../schemas/posts.js";
import { updateAvatarSchema } from "../schemas/users.js";
import { handleOwnershipError } from "../lib/errors.js";
import { getViewerId } from "../lib/auth.js";

const usernameParamSchema = z.object({ username: z.string() });
const deleteAccountSchema = z.object({ password: z.string().min(1, "пароль обязателен") });

export default async function usersRoutes(app: FastifyInstance) {
  app.patch("/me/avatar", { preHandler: [app.authenticate] }, async (request, reply) => {
    const parsed = updateAvatarSchema.safeParse(request.body);
    if (!parsed.success) return reply.code(400).send({ error: parsed.error.flatten() });

    await updateAvatarColor(request.user.sub, parsed.data.avatarColor);
    return { success: true };
  });

  app.delete("/me", { preHandler: [app.authenticate] }, async (request, reply) => {
    const parsed = deleteAccountSchema.safeParse(request.body);
    if (!parsed.success) return reply.code(400).send({ error: parsed.error.flatten() });

    try {
      await deleteAccount(request.user.sub, parsed.data.password);
      reply.clearCookie("refresh_token", { path: "/api/auth" });
      return { success: true };
    } catch (err) {
      if (err instanceof InvalidPasswordError) return reply.code(401).send({ error: err.message });
      return handleOwnershipError(err, reply);
    }
  });

  app.get(
    "/:username",
    { preHandler: [app.optionalAuthenticate], config: { rateLimit: { max: 60, timeWindow: "1 minute" } } },
    async (request, reply) => {
      const parsed = usernameParamSchema.safeParse(request.params);
      if (!parsed.success) return reply.code(400).send({ error: "Некорректный username" });

      const profile = await getUserProfile(parsed.data.username, getViewerId(request));
      if (!profile) return reply.code(404).send({ error: "Пользователь не найден" });
      return { user: profile };
    }
  );

  app.get(
    "/:username/posts",
    { preHandler: [app.optionalAuthenticate], config: { rateLimit: { max: 60, timeWindow: "1 minute" } } },
    async (request, reply) => {
      const paramsParsed = usernameParamSchema.safeParse(request.params);
      if (!paramsParsed.success) return reply.code(400).send({ error: "Некорректный username" });

      const queryParsed = feedQuerySchema.safeParse(request.query);
      if (!queryParsed.success) return reply.code(400).send({ error: queryParsed.error.flatten() });

      const viewerId = getViewerId(request);
      const profile = await getUserProfile(paramsParsed.data.username, viewerId);
      if (!profile) return reply.code(404).send({ error: "Пользователь не найден" });

      return getUserPosts(profile.id, viewerId, queryParsed.data);
    }
  );
}