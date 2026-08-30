import { desc, eq, ilike, or } from "drizzle-orm";
import { db } from "../db/client.js";
import { users, posts } from "../db/schema/index.js";

export async function searchUsers(query: string, limit: number) {
  return db
    .select({
      id: users.id,
      username: users.username,
      displayName: users.displayName,
    })
    .from(users)
    .where(or(ilike(users.username, `%${query}%`), ilike(users.displayName, `%${query}%`)))
    .limit(limit);
}

export async function searchPosts(query: string, limit: number) {
  return db
    .select({
      id: posts.id,
      title: posts.title,
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
    .where(or(ilike(posts.title, `%${query}%`), ilike(posts.content, `%${query}%`)))
    .orderBy(desc(posts.createdAt))
    .limit(limit);
}