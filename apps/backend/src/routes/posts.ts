import type { FastifyInstance } from "fastify";
import { z } from "zod";
import { createPostSchema, feedQuerySchema } from "../schemas/posts.js";
import { createCommentSchema } from "../schemas/comments.js";
import {
  createPost,
  getFeed,
  getPostById,
  getBookmarkedPosts,
  updatePost,
  deletePost,
  NotOwnerError,
  NotFoundError,
} from "../services/posts.service.js";
import { likePost, unlikePost } from "../services/likes.service.js";
import { bookmarkPost, unbookmarkPost } from "../services/bookmarks.service.js";
import { createComment, getPostComments, deleteComment } from "../services/comments.service.js";

const postIdParamSchema = z.object({ postId: z.string().uuid() });
const commentIdParamSchema = z.object({ commentId: z.string().uuid() });

function handleOwnershipError(err: unknown, reply: any) {
  if (err instanceof NotFoundError) return reply.code(404).send({ error: err.message });
  if (err instanceof NotOwnerError) return reply.code(403).send({ error: err.message });
  throw err;
}

export default async function postsRoutes(app: FastifyInstance) {
  app.post("/", { preHandler: [app.authenticate] }, async (request, reply) => {
    const parsed = createPostSchema.safeParse(request.body);
    if (!parsed.success) return reply.code(400).send({ error: parsed.error.flatten() });

    const payload = request.user as { sub: string };
    const post = await createPost(payload.sub, parsed.data.title, parsed.data.content);
    return reply.code(201).send({ post });
  });

  app.get("/feed", { preHandler: [app.authenticate] }, async (request, reply) => {
    const parsed = feedQuerySchema.safeParse(request.query);
    if (!parsed.success) return reply.code(400).send({ error: parsed.error.flatten() });

    const payload = request.user as { sub: string };
    return getFeed(payload.sub, parsed.data);
  });

  app.get("/bookmarks", { preHandler: [app.authenticate] }, async (request, reply) => {
    const parsed = feedQuerySchema.safeParse(request.query);
    if (!parsed.success) return reply.code(400).send({ error: parsed.error.flatten() });

    const payload = request.user as { sub: string };
    return getBookmarkedPosts(payload.sub, parsed.data);
  });

  app.get("/:postId", { preHandler: [app.authenticate] }, async (request, reply) => {
    const parsed = postIdParamSchema.safeParse(request.params);
    if (!parsed.success) return reply.code(400).send({ error: "Некорректный ID поста" });

    const payload = request.user as { sub: string };
    const post = await getPostById(parsed.data.postId, payload.sub, true);
    if (!post) return reply.code(404).send({ error: "Пост не найден" });
    return { post };
  });

  app.patch("/:postId", { preHandler: [app.authenticate] }, async (request, reply) => {
    const paramsParsed = postIdParamSchema.safeParse(request.params);
    if (!paramsParsed.success) return reply.code(400).send({ error: "Некорректный ID поста" });

    const bodyParsed = createPostSchema.safeParse(request.body);
    if (!bodyParsed.success) return reply.code(400).send({ error: bodyParsed.error.flatten() });

    const payload = request.user as { sub: string };
    try {
      const post = await updatePost(paramsParsed.data.postId, payload.sub, bodyParsed.data.title, bodyParsed.data.content);
      return { post };
    } catch (err) {
      return handleOwnershipError(err, reply);
    }
  });

  app.delete("/:postId", { preHandler: [app.authenticate] }, async (request, reply) => {
    const parsed = postIdParamSchema.safeParse(request.params);
    if (!parsed.success) return reply.code(400).send({ error: "Некорректный ID поста" });

    const payload = request.user as { sub: string };
    try {
      await deletePost(parsed.data.postId, payload.sub);
      return { success: true };
    } catch (err) {
      return handleOwnershipError(err, reply);
    }
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

  app.post("/:postId/bookmark", { preHandler: [app.authenticate] }, async (request, reply) => {
    const parsed = postIdParamSchema.safeParse(request.params);
    if (!parsed.success) return reply.code(400).send({ error: "Некорректный ID поста" });

    const payload = request.user as { sub: string };
    await bookmarkPost(parsed.data.postId, payload.sub);
    return { success: true };
  });

  app.delete("/:postId/bookmark", { preHandler: [app.authenticate] }, async (request, reply) => {
    const parsed = postIdParamSchema.safeParse(request.params);
    if (!parsed.success) return reply.code(400).send({ error: "Некорректный ID поста" });

    const payload = request.user as { sub: string };
    await unbookmarkPost(parsed.data.postId, payload.sub);
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

  app.delete("/comments/:commentId", { preHandler: [app.authenticate] }, async (request, reply) => {
    const parsed = commentIdParamSchema.safeParse(request.params);
    if (!parsed.success) return reply.code(400).send({ error: "Некорректный ID комментария" });

    const payload = request.user as { sub: string };
    try {
      await deleteComment(parsed.data.commentId, payload.sub);
      return { success: true };
    } catch (err) {
      return handleOwnershipError(err, reply);
    }
  });
}