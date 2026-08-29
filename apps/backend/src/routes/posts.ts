import type { FastifyInstance } from "fastify";
import { z } from "zod";
import { createPostSchema, feedQuerySchema } from "../schemas/posts.js";
import { createCommentSchema } from "../schemas/comments.js";
import { createPost, getFeed } from "../services/posts.service.js";
import { likePost, unlikePost } from "../services/likes.service.js";
import { createComment, getPostComments } from "../services/comments.service.js";

const postIdParamSchema = z.object({ postId: z.string().uuid() });

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

  app.post("/:postId/like", { preHandler: [app.authenticate] }, async (request, reply) => {
    const parsed = postIdParamSchema.safeParse(request.params);
    if (!parsed.success) return reply.code(400).send({ error: "Некорректный ID поста" });

    const payload = request.user as { sub: string };
    await likePost(parsed.data.postId, payload.sub);
    return { success: true };
  });

  app.delete("/:postId/like", { preHandler: [app.authenticate] }, async (request, reply) => {
    const parsed = postIdParamSchema.safeParse(request.params);
    if (!parsed.success) return reply.code(400).send({ error: "Некорректный ID поста" });

    const payload = request.user as { sub: string };
    await unlikePost(parsed.data.postId, payload.sub);
    return { success: true };
  });

  app.get("/:postId/comments", { preHandler: [app.authenticate] }, async (request, reply) => {
    const parsed = postIdParamSchema.safeParse(request.params);
    if (!parsed.success) return reply.code(400).send({ error: "Некорректный ID поста" });

    const comments = await getPostComments(parsed.data.postId);
    return { comments };
  });

  app.post("/:postId/comments", { preHandler: [app.authenticate] }, async (request, reply) => {
    const paramsParsed = postIdParamSchema.safeParse(request.params);
    if (!paramsParsed.success) return reply.code(400).send({ error: "Некорректный ID поста" });

    const bodyParsed = createCommentSchema.safeParse(request.body);
    if (!bodyParsed.success) return reply.code(400).send({ error: bodyParsed.error.flatten() });

    const payload = request.user as { sub: string };
    const comment = await createComment(paramsParsed.data.postId, payload.sub, bodyParsed.data.content);
    return reply.code(201).send({ comment });
  });
}