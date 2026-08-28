import type { FastifyInstance } from "fastify";
import { createPostSchema, feedQuerySchema } from "../schemas/posts.js";
import { createPost, getFeed } from "../services/posts.service.js";

export default async function postsRoutes(app: FastifyInstance) {
  app.post("/", { preHandler: [app.authenticate] }, async (request, reply) => {
    const parsed = createPostSchema.safeParse(request.body);
    if (!parsed.success) {
      return reply.code(400).send({ error: parsed.error.flatten() });
    }

    const payload = request.user as { sub: string };
    const post = await createPost(payload.sub, parsed.data.content);
    return reply.code(201).send({ post });
  });

  app.get("/feed", { preHandler: [app.authenticate] }, async (request, reply) => {
    const parsed = feedQuerySchema.safeParse(request.query);
    if (!parsed.success) {
      return reply.code(400).send({ error: parsed.error.flatten() });
    }

    const payload = request.user as { sub: string };
    const result = await getFeed(payload.sub, parsed.data);
    return result;
  });
}