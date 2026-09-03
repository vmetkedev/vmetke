import { and, desc, eq, inArray, lt, or, sql } from "drizzle-orm";
import { db } from "../db/client.js";
import { posts, users, likes, comments, bookmarks } from "../db/schema/index.js";
import type { FeedQuery } from "../schemas/posts.js";

export class NotOwnerError extends Error {}
export class NotFoundError extends Error {}

export async function createPost(authorId: string, title: string, content: string) {
  const [post] = await db.insert(posts).values({ authorId, title, content }).returning();
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

const postSelectFields = {
  id: posts.id,
  title: posts.title,
  content: posts.content,
  createdAt: posts.createdAt,
  viewsCount: posts.views,
  author: {
    id: users.id,
    username: users.username,
    displayName: users.displayName,
  },
};

async function attachEngagement<T extends { id: string }>(rows: T[], viewerId: string | null) {
  if (rows.length === 0) return [];

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

  const likeMap = new Map(likeCounts.map((l) => [l.postId, l.count]));
  const commentMap = new Map(commentCounts.map((c) => [c.postId, c.count]));

  let likedSet = new Set<string>();
  let bookmarkedSet = new Set<string>();

  if (viewerId) {
    const myLikes = await db
      .select({ postId: likes.postId })
      .from(likes)
      .where(and(inArray(likes.postId, postIds), eq(likes.userId, viewerId)));
    const myBookmarks = await db
      .select({ postId: bookmarks.postId })
      .from(bookmarks)
      .where(and(inArray(bookmarks.postId, postIds), eq(bookmarks.userId, viewerId)));
    likedSet = new Set(myLikes.map((l) => l.postId));
    bookmarkedSet = new Set(myBookmarks.map((b) => b.postId));
  }

  return rows.map((r) => ({
    ...r,
    likesCount: likeMap.get(r.id) ?? 0,
    commentsCount: commentMap.get(r.id) ?? 0,
    isLikedByMe: likedSet.has(r.id),
    isBookmarkedByMe: bookmarkedSet.has(r.id),
  }));
}

export async function getFeed(viewerId: string | null, { cursor, limit }: FeedQuery) {
  const decoded = decodeCursor(cursor);

  const rows = await db
    .select(postSelectFields)
    .from(posts)
    .innerJoin(users, eq(posts.authorId, users.id))
    .where(
      decoded
        ? or(
            lt(posts.createdAt, decoded.createdAt),
            and(eq(posts.createdAt, decoded.createdAt), lt(posts.id, decoded.id))
          )
        : undefined
    )
    .orderBy(desc(posts.createdAt), desc(posts.id))
    .limit(limit);

  const withEngagement = await attachEngagement(rows, viewerId);
  const nextCursor = rows.length === limit ? encodeCursor(rows[rows.length - 1].createdAt, rows[rows.length - 1].id) : null;
  return { posts: withEngagement, nextCursor };
}

export async function getUserPosts(authorId: string, viewerId: string | null, { cursor, limit }: FeedQuery) {
  const decoded = decodeCursor(cursor);

  const rows = await db
    .select(postSelectFields)
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
  const nextCursor = rows.length === limit ? encodeCursor(rows[rows.length - 1].createdAt, rows[rows.length - 1].id) : null;
  return { posts: withEngagement, nextCursor };
}

export async function getPostById(postId: string, viewerId: string | null, countView: boolean) {
  if (countView) {
    await db.update(posts).set({ views: sql`${posts.views} + 1` }).where(eq(posts.id, postId));
  }

  const [row] = await db
    .select(postSelectFields)
    .from(posts)
    .innerJoin(users, eq(posts.authorId, users.id))
    .where(eq(posts.id, postId));

  if (!row) return null;

  const [withEngagement] = await attachEngagement([row], viewerId);
  return withEngagement;
}

export async function getBookmarkedPosts(userId: string, { cursor, limit }: FeedQuery) {
  const decoded = decodeCursor(cursor);

  const rows = await db
    .select({ ...postSelectFields, bookmarkedAt: bookmarks.createdAt })
    .from(bookmarks)
    .innerJoin(posts, eq(bookmarks.postId, posts.id))
    .innerJoin(users, eq(posts.authorId, users.id))
    .where(
      and(
        eq(bookmarks.userId, userId),
        decoded
          ? or(
              lt(bookmarks.createdAt, decoded.createdAt),
              and(eq(bookmarks.createdAt, decoded.createdAt), lt(posts.id, decoded.id))
            )
          : undefined
      )
    )
    .orderBy(desc(bookmarks.createdAt), desc(posts.id))
    .limit(limit);

  const stripped = rows.map(({ bookmarkedAt, ...rest }) => rest);
  const withEngagement = await attachEngagement(stripped, userId);
  const nextCursor =
    rows.length === limit ? encodeCursor(rows[rows.length - 1].bookmarkedAt, rows[rows.length - 1].id) : null;

  return { posts: withEngagement, nextCursor };
}

export async function updatePost(postId: string, userId: string, title: string, content: string) {
  const [post] = await db.select().from(posts).where(eq(posts.id, postId));
  if (!post) throw new NotFoundError("Пост не найден");
  if (post.authorId !== userId) throw new NotOwnerError("Нельзя редактировать чужой пост");

  await db.update(posts).set({ title, content }).where(eq(posts.id, postId));
  return getPostById(postId, userId, false);
}

export async function deletePost(postId: string, userId: string) {
  const [post] = await db.select().from(posts).where(eq(posts.id, postId));
  if (!post) throw new NotFoundError("Пост не найден");
  if (post.authorId !== userId) throw new NotOwnerError("Нельзя удалить чужой пост");

  await db.delete(posts).where(eq(posts.id, postId));
}