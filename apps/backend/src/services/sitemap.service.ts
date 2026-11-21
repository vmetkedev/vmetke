import { and, desc, eq, isNull, max } from "drizzle-orm";
import { db } from "../db/client.js";
import { posts, users } from "../db/schema/index.js";

export async function getAllPostsForSitemap() {
  return db
    .select({ id: posts.id, createdAt: posts.createdAt })
    .from(posts)
    .orderBy(desc(posts.createdAt));
}

/** Только живые профили авторов хотя бы с одним постом (без пустых страниц). */
export async function getAllProfilesForSitemap() {
  return db
    .select({ username: users.username, lastPostAt: max(posts.createdAt) })
    .from(users)
    .innerJoin(posts, eq(posts.authorId, users.id))
    .where(and(isNull(users.deletedAt), isNull(users.bannedAt)))
    .groupBy(users.id, users.username)
    .orderBy(desc(max(posts.createdAt)));
}