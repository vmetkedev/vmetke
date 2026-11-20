import type { FastifyInstance } from "fastify";
import { z } from "zod";
import { handleOwnershipError } from "../lib/errors.js";
import { createPostSchema, feedQuerySchema } from "../schemas/posts.js";
import { createCommentSchema } from "../schemas/comments.js";
import {
  createPost,
  getFeed,
  getPostById,
  getBookmarkedPosts,
  updatePost,
  deletePost,
} from "../services/posts.service.js";
import { likePost, unlikePost } from "../services/likes.service.js";
import { bookmarkPost, unbookmarkPost } from "../services/bookmarks.service.js";
import { 
  createComment,
  getPostComments,
  deleteComment,
  likeComment,
  unlikeComment,
} from "../services/comments.service.js";
import { getViewerId } from "../lib/auth.js";
import { registerPostView } from "../services/post-views.service.js";
import { viewerKeyFor } from "../lib/viewer-key.js";

const postIdParamSchema = z.object({ postId: z.string().uuid() });
const commentIdParamSchema = z.object({ commentId: z.string().uuid() });


export default async function postsRoutes(app: FastifyInstance) {
  app.post(
    "/",
    { preHandler: [app.authenticate], config: { rateLimit: { max: 10, timeWindow: "10 minutes" } } },
    async (request, reply) => {
      const parsed = createPostSchema.safeParse(request.body);
      if (!parsed.success) return reply.code(400).send({ error: parsed.error.flatten() });

      const payload = request.user;
      const post = await createPost(payload.sub, parsed.data.title, parsed.data.content, parsed.data.tags);
      return reply.code(201).send({ post });
    }
  );

  app.get(
    "/feed",
    { preHandler: [app.optionalAuthenticate], config: { rateLimit: { max: 60, timeWindow: "1 minute" } } },
    async (request, reply) => {
      const parsed = feedQuerySchema.safeParse(request.query);
      if (!parsed.success) return reply.code(400).send({ error: parsed.error.flatten() });

      const viewerId = getViewerId(request);
      return getFeed(viewerId, parsed.data);
    }
  );

  app.get("/bookmarks", { preHandler: [app.authenticate] }, async (request, reply) => {
    const parsed = feedQuerySchema.safeParse(request.query);
    if (!parsed.success) return reply.code(400).send({ error: parsed.error.flatten() });

    const payload = request.user;
    return getBookmarkedPosts(payload.sub, parsed.data);
  });

  app.get(
    "/:postId",
    { preHandler: [app.optionalAuthenticate], config: { rateLimit: { max: 60, timeWindow: "1 minute" } } },
    async (request, reply) => {
      const parsed = postIdParamSchema.safeParse(request.params);
      if (!parsed.success) return reply.code(400).send({ error: "Некорректный ID поста" });

      const viewerId = getViewerId(request);
      // countView=false: просмотры теперь считаются ниже, один на зрителя
      const post = await getPostById(parsed.data.postId, viewerId, false);
      if (!post) return reply.code(404).send({ error: "Пост не найден" });

      if (post.author.id === viewerId) return { post };

      const counted = await registerPostView(post.id, viewerKeyFor(request, viewerId));
      return { post: counted ? { ...post, viewsCount: post.viewsCount + 1 } : post };
    }
  );

  app.patch("/:postId", { preHandler: [app.authenticate] }, async (request, reply) => {
    const paramsParsed = postIdParamSchema.safeParse(request.params);
    if (!paramsParsed.success) return reply.code(400).send({ error: "Некорректный ID поста" });

    const bodyParsed = createPostSchema.safeParse(request.body);
    if (!bodyParsed.success) return reply.code(400).send({ error: bodyParsed.error.flatten() });

    const payload = request.user;
    try {
      const post = await updatePost(
        paramsParsed.data.postId,
        payload.sub,
        bodyParsed.data.title,
        bodyParsed.data.content,
        bodyParsed.data.tags
      );
      return { post };
    } catch (err) {
      return handleOwnershipError(err, reply);
    }
  });

  app.delete("/:postId", { preHandler: [app.authenticate] }, async (request, reply) => {
    const parsed = postIdParamSchema.safeParse(request.params);
    if (!parsed.success) return reply.code(400).send({ error: "Некорректный ID поста" });

    const payload = request.user;
    try {
      await deletePost(parsed.data.postId, payload.sub);
      return { success: true };
    } catch (err) {
      return handleOwnershipError(err, reply);
    }
  });

  app.post(
    "/:postId/like",
    { preHandler: [app.authenticate], config: { rateLimit: { max: 60, timeWindow: "1 minute" } } },
    async (request, reply) => {
      const parsed = postIdParamSchema.safeParse(request.params);
      if (!parsed.success) return reply.code(400).send({ error: "Некорректный ID поста" });

      const payload = request.user;
      try {
        await likePost(parsed.data.postId, payload.sub);
        return { success: true };
      } catch (err) {
        return handleOwnershipError(err, reply);
      }
    }
  );

  app.delete("/:postId/like", { preHandler: [app.authenticate] }, async (request, reply) => {
    const parsed = postIdParamSchema.safeParse(request.params);
    if (!parsed.success) return reply.code(400).send({ error: "Некорректный ID поста" });

    const payload = request.user;
    await unlikePost(parsed.data.postId, payload.sub);
    return { success: true };
  });

  app.post("/:postId/bookmark", { preHandler: [app.authenticate] }, async (request, reply) => {
    const parsed = postIdParamSchema.safeParse(request.params);
    if (!parsed.success) return reply.code(400).send({ error: "Некорректный ID поста" });

    const payload = request.user;
    await bookmarkPost(parsed.data.postId, payload.sub);
    return { success: true };
  });

  app.delete("/:postId/bookmark", { preHandler: [app.authenticate] }, async (request, reply) => {
    const parsed = postIdParamSchema.safeParse(request.params);
    if (!parsed.success) return reply.code(400).send({ error: "Некорректный ID поста" });

    const payload = request.user;
    await unbookmarkPost(parsed.data.postId, payload.sub);
    return { success: true };
  });

  app.get(
    "/:postId/comments",
    { preHandler: [app.optionalAuthenticate], config: { rateLimit: { max: 60, timeWindow: "1 minute" } } },
    async (request, reply) => {
      const parsed = postIdParamSchema.safeParse(request.params);
      if (!parsed.success) return reply.code(400).send({ error: "Некорректный ID поста" });

      const viewerId = getViewerId(request);
      const comments = await getPostComments(parsed.data.postId, viewerId);
      return { comments };
    }
  );

  app.post(
    "/:postId/comments",
    { preHandler: [app.authenticate], config: { rateLimit: { max: 20, timeWindow: "5 minutes" } } },
    async (request, reply) => {
      const paramsParsed = postIdParamSchema.safeParse(request.params);
      if (!paramsParsed.success) return reply.code(400).send({ error: "Некорректный ID поста" });

      const bodyParsed = createCommentSchema.safeParse(request.body);
      if (!bodyParsed.success) return reply.code(400).send({ error: bodyParsed.error.flatten() });

      const payload = request.user;
      const comment = await createComment(paramsParsed.data.postId, payload.sub, bodyParsed.data.content);
      return reply.code(201).send({ comment });
    }
  );

  app.delete("/comments/:commentId", { preHandler: [app.authenticate] }, async (request, reply) => {
    const parsed = commentIdParamSchema.safeParse(request.params);
    if (!parsed.success) return reply.code(400).send({ error: "Некорректный ID комментария" });

    const payload = request.user;
    try {
      await deleteComment(parsed.data.commentId, payload.sub);
      return { success: true };
    } catch (err) {
      return handleOwnershipError(err, reply);
    }
  });

  app.post(
  "/comments/:commentId/like",
  { preHandler: [app.authenticate], config: { rateLimit: { max: 60, timeWindow: "1 minute" } } },
  async (request, reply) => {
    const parsed = commentIdParamSchema.safeParse(request.params);
    if (!parsed.success) return reply.code(400).send({ error: "Некорректный ID комментария" });

    const payload = request.user;
    try {
      await likeComment(parsed.data.commentId, payload.sub);
      return { success: true };
    } catch (err) {
      return handleOwnershipError(err, reply);
    }
  }
);

  app.delete("/comments/:commentId/like", { preHandler: [app.authenticate] }, async (request, reply) => {
    const parsed = commentIdParamSchema.safeParse(request.params);
    if (!parsed.success) return reply.code(400).send({ error: "Некорректный ID комментария" });

    const payload = request.user;
    await unlikeComment(parsed.data.commentId, payload.sub);
    return { success: true };
  });
}