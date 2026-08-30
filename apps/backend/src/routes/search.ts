import type { FastifyInstance } from "fastify";
import { searchQuerySchema } from "../schemas/posts.js";
import { searchUsers, searchPosts } from "../services/search.service.js";

export default async function searchRoutes(app: FastifyInstance) {
  app.get("/", { preHandler: [app.authenticate] }, async (request, reply) => {
    const parsed = searchQuerySchema.safeParse(request.query);
    if (!parsed.success) return reply.code(400).send({ error: parsed.error.flatten() });

    const { q, type, limit } = parsed.data;

    if (type === "users") {
      const results = await searchUsers(q, limit);
      return { type, results };
    }

    const results = await searchPosts(q, limit);
    return { type, results };
  });
}