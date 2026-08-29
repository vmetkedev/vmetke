import { and, desc, eq, inArray, lt, or, sql } from "drizzle-orm";
import { db } from "../db/client.js";
import { posts, follows, users, likes, comments } from "../db/schema/index.js";
import type { FeedQuery } from "../schemas/posts.js";

export async function createPost(authorId: string, content: string) {
  const [post] = await db
    .insert(posts)
    .values({ authorId, content })
    .returning();
  return post;
}

function decodeCursor(cursor?: string) {
  if (!cursor) return null;
  try {
    const decoded = JSON.parse(Buffer.from(cursor, "base64").toString("utf8"));
    return { createdAt: new Date(decoded.createdAt), id: decoded.id as string };
  } catch {
    return null;
  }
}

function encodeCursor(createdAt: Date, id: string) {
  return Buffer.from(JSON.stringify({ createdAt: createdAt.toISOString(), id })).toString("base64");
}

async function attachEngagement<T extends { id: string }>(rows: T[], viewerId: string) {
  if (rows.length === 0) return rows.map((r) => ({ ...r, likesCount: 0, commentsCount: 0, isLikedByMe: false }));

  const postIds = rows.map((r) => r.id);

  const likeCounts = await db
    .select({ postId: likes.postId, count: sql<number>`count(*)::int` })
    .from(likes)
    .where(inArray(likes.postId, postIds))
    .groupBy(likes.postId);

  const commentCounts = await db
    .select({ postId: comments.postId, count: sql<number>`count(*)::int` })
    .from(comments)
    .where(inArray(comments.postId, postIds))
    .groupBy(comments.postId);

  const myLikes = await db
    .select({ postId: likes.postId })
    .from(likes)
    .where(and(inArray(likes.postId, postIds), eq(likes.userId, viewerId)));

  const likeMap = new Map(likeCounts.map((l) => [l.postId, l.count]));
  const commentMap = new Map(commentCounts.map((c) => [c.postId, c.count]));
  const likedSet = new Set(myLikes.map((l) => l.postId));

  return rows.map((r) => ({
    ...r,
    likesCount: likeMap.get(r.id) ?? 0,
    commentsCount: commentMap.get(r.id) ?? 0,
    isLikedByMe: likedSet.has(r.id),
  }));
}

export async function getFeed(userId: string, { cursor, limit }: FeedQuery) {
  const followingIds = db
    .select({ id: follows.followingId })
    .from(follows)
    .where(eq(follows.followerId, userId));

  const decoded = decodeCursor(cursor);

  const rows = await db
    .select({
      id: posts.id,
      content: posts.content,
      createdAt: posts.createdAt,
      author: {
        id: users.id,
        username: users.username,
        displayName: users.displayName,
      },
    })
    .from(posts)
    .innerJoin(users, eq(posts.authorId, users.id))
    .where(
      and(
        or(inArray(posts.authorId, followingIds), eq(posts.authorId, userId)),
        decoded
          ? or(
              lt(posts.createdAt, decoded.createdAt),
              and(eq(posts.createdAt, decoded.createdAt), lt(posts.id, decoded.id))
            )
          : undefined
      )
    )
    .orderBy(desc(posts.createdAt), desc(posts.id))
    .limit(limit);

  const withEngagement = await attachEngagement(rows, userId);

  const nextCursor =
    rows.length === limit ? encodeCursor(rows[rows.length - 1].createdAt, rows[rows.length - 1].id) : null;

  return { posts: withEngagement, nextCursor };
}

export async function getUserPosts(authorId: string, viewerId: string, { cursor, limit }: FeedQuery) {
  const decoded = decodeCursor(cursor);

  const rows = await db
    .select({
      id: posts.id,
      content: posts.content,
      createdAt: posts.createdAt,
      author: {
        id: users.id,
        username: users.username,
        displayName: users.displayName,
      },
    })
    .from(posts)
    .innerJoin(users, eq(posts.authorId, users.id))
    .where(
      and(
        eq(posts.authorId, authorId),
        decoded
          ? or(
              lt(posts.createdAt, decoded.createdAt),
              and(eq(posts.createdAt, decoded.createdAt), lt(posts.id, decoded.id))
            )
          : undefined
      )
    )
    .orderBy(desc(posts.createdAt), desc(posts.id))
    .limit(limit);

  const withEngagement = await attachEngagement(rows, viewerId);

  const nextCursor =
    rows.length === limit ? encodeCursor(rows[rows.length - 1].createdAt, rows[rows.length - 1].id) : null;

  return { posts: withEngagement, nextCursor };
}

export class NotOwnerError extends Error {}
export class NotFoundError extends Error {}

export async function updatePost(postId: string, userId: string, content: string) {
  const [post] = await db.select().from(posts).where(eq(posts.id, postId));
  if (!post) throw new NotFoundError("Пост не найден");
  if (post.authorId !== userId) throw new NotOwnerError("Нельзя редактировать чужой пост");

  const [updated] = await db
    .update(posts)
    .set({ content })
    .where(eq(posts.id, postId))
    .returning();
  return updated;
}

export async function deletePost(postId: string, userId: string) {
  const [post] = await db.select().from(posts).where(eq(posts.id, postId));
  if (!post) throw new NotFoundError("Пост не найден");
  if (post.authorId !== userId) throw new NotOwnerError("Нельзя удалить чужой пост");

  await db.delete(posts).where(eq(posts.id, postId));
}