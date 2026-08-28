import { and, desc, eq, inArray, lt, or, sql } from "drizzle-orm";
import { db } from "../db/client.js";
import { posts, follows, users } from "../db/schema/index.js";
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

  const nextCursor =
    rows.length === limit ? encodeCursor(rows[rows.length - 1].createdAt, rows[rows.length - 1].id) : null;

  return { posts: rows, nextCursor };
}

export async function getUserPosts(authorId: string, { cursor, limit }: FeedQuery) {
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

  const nextCursor =
    rows.length === limit ? encodeCursor(rows[rows.length - 1].createdAt, rows[rows.length - 1].id) : null;

  return { posts: rows, nextCursor };
}